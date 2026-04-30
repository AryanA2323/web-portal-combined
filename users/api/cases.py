"""
Cases API endpoints.
"""

import json
import logging
import os
from typing import List, Optional
from datetime import datetime, timedelta
from urllib.parse import unquote, urlencode, urlparse
import urllib.request
from ninja import Router, Schema
from ninja.errors import HttpError
from ninja.pagination import paginate, PageNumberPagination
from django.db import connection, connections
from django.http import HttpRequest
from django.conf import settings
from django.utils import timezone

from users.services.ai_brief_service import AIBriefGenerationError, AIBriefService

logger = logging.getLogger(__name__)

router = Router(tags=["Cases"])
_COLUMN_EXISTS_CACHE = {}


def _build_absolute_media_url(request: HttpRequest, raw_url: str) -> str:
    """Build an absolute media URL using the current request host."""
    if not raw_url:
        return ""
    if str(raw_url).startswith(("http://", "https://")):
        return str(raw_url)

    normalized_path = str(raw_url)
    if normalized_path.startswith("media/"):
        normalized_path = f"/{normalized_path}"
    elif not normalized_path.startswith("/"):
        normalized_path = f"/media/{normalized_path}"

    return request.build_absolute_uri(normalized_path)


def _extract_evidence_filename(evidence_item) -> str:
    """Extract a stable filename from a vendor evidence item."""
    if isinstance(evidence_item, dict):
        filename = evidence_item.get("filename") or evidence_item.get("file_name")
        if filename:
            return str(filename)
        raw_url = evidence_item.get("url") or evidence_item.get("photo_url") or ""
    elif isinstance(evidence_item, str):
        raw_url = evidence_item
    else:
        return ""

    return urlparse(str(raw_url)).path.rstrip("/").split("/")[-1]


def _media_relative_path_from_url(raw_url: str) -> Optional[str]:
    """Convert a stored media URL into a path relative to MEDIA_ROOT."""
    if not raw_url:
        return None

    path = unquote(urlparse(str(raw_url)).path).lstrip("/")
    if not path:
        return None
    if path.startswith("media/"):
        path = path[len("media/"):]
    return path or None


def _coerce_exif_number(value) -> Optional[float]:
    """Convert PIL EXIF numeric values to floats."""
    try:
        if hasattr(value, "numerator") and hasattr(value, "denominator"):
            denominator = value.denominator or 1
            return float(value.numerator) / float(denominator)
        if isinstance(value, (tuple, list)) and len(value) == 2:
            denominator = value[1] or 1
            return float(value[0]) / float(denominator)
        return float(value)
    except (TypeError, ValueError, ZeroDivisionError):
        return None


def _convert_gps_to_degrees(value) -> Optional[float]:
    """Convert EXIF GPS coordinate tuples to decimal degrees."""
    if not value or len(value) < 3:
        return None

    degrees = _coerce_exif_number(value[0])
    minutes = _coerce_exif_number(value[1])
    seconds = _coerce_exif_number(value[2])
    if degrees is None or minutes is None or seconds is None:
        return None

    return degrees + (minutes / 60.0) + (seconds / 3600.0)


def _extract_image_exif_metadata(file_path: str) -> dict:
    """Extract capture time and GPS metadata from a stored image file."""
    try:
        from PIL import Image
        from PIL.ExifTags import GPSTAGS, TAGS
    except Exception:
        return {}

    try:
        with Image.open(file_path) as image:
            exif_data = image.getexif()
            if not exif_data:
                return {}

            exif_map = {}
            for tag_id, value in exif_data.items():
                exif_map[TAGS.get(tag_id, tag_id)] = value

            metadata = {}
            captured_at_raw = (
                exif_map.get("DateTimeOriginal")
                or exif_map.get("DateTimeDigitized")
                or exif_map.get("DateTime")
            )
            if captured_at_raw:
                try:
                    metadata["captured_at"] = datetime.strptime(
                        str(captured_at_raw), "%Y:%m:%d %H:%M:%S"
                    ).isoformat()
                except ValueError:
                    metadata["captured_at"] = str(captured_at_raw)

            gps_info_raw = exif_map.get("GPSInfo")
            if not gps_info_raw:
                return metadata

            gps_info = {
                GPSTAGS.get(tag_id, tag_id): value
                for tag_id, value in gps_info_raw.items()
            }
            latitude = _convert_gps_to_degrees(gps_info.get("GPSLatitude"))
            longitude = _convert_gps_to_degrees(gps_info.get("GPSLongitude"))
            if latitude is not None and gps_info.get("GPSLatitudeRef") == "S":
                latitude = -latitude
            if longitude is not None and gps_info.get("GPSLongitudeRef") == "W":
                longitude = -longitude

            if latitude is not None:
                metadata["latitude"] = round(latitude, 6)
            if longitude is not None:
                metadata["longitude"] = round(longitude, 6)

            return metadata
    except Exception as exc:
        logger.debug(f"Failed to extract EXIF metadata from {file_path}: {exc}")
        return {}


def _reverse_geocode_to_english(latitude: float, longitude: float) -> Optional[str]:
    """Convert decimal GPS coordinates to a readable English address."""
    try:
        params = urlencode(
            {
                "lat": latitude,
                "lon": longitude,
                "format": "jsonv2",
                "zoom": 18,
                "addressdetails": 1,
                "accept-language": "en",
            }
        )
        request = urllib.request.Request(
            f"https://nominatim.openstreetmap.org/reverse?{params}",
            headers={"User-Agent": "IncidentMgmtPlatform/1.0"},
        )
        with urllib.request.urlopen(request, timeout=10) as response:
            payload = json.loads(response.read().decode("utf-8"))
        display_name = payload.get("display_name")
        return str(display_name).strip() if display_name else None
    except Exception as exc:
        logger.debug(f"Reverse geocoding failed for ({latitude}, {longitude}): {exc}")
        return None


def _enrich_evidence_metadata(
    request: HttpRequest,
    evidence_item,
    fallback_location_name: str = "",
) -> dict:
    """Normalize a vendor evidence item and attach preview/time/location metadata."""
    normalized = dict(evidence_item) if isinstance(evidence_item, dict) else {"url": evidence_item}

    raw_url = normalized.get("url") or normalized.get("photo_url") or ""
    normalized["preview_url"] = _build_absolute_media_url(request, raw_url)
    if not normalized.get("filename"):
        normalized["filename"] = _extract_evidence_filename(normalized)

    existing_location_name = str(normalized.get("location_name") or "").strip()
    if existing_location_name.lower() in {"india"}:
        existing_location_name = ""
    captured_at = normalized.get("captured_at") or normalized.get("timestamp") or normalized.get("uploaded_at")
    latitude = normalized.get("latitude")
    longitude = normalized.get("longitude")

    if raw_url:
        relative_path = _media_relative_path_from_url(raw_url)
        if relative_path:
            file_path = os.path.join(settings.MEDIA_ROOT, relative_path)
            if os.path.exists(file_path):
                exif_metadata = _extract_image_exif_metadata(file_path)
                if not captured_at and exif_metadata.get("captured_at"):
                    captured_at = exif_metadata["captured_at"]
                if latitude in (None, "") and exif_metadata.get("latitude") is not None:
                    latitude = exif_metadata["latitude"]
                if longitude in (None, "") and exif_metadata.get("longitude") is not None:
                    longitude = exif_metadata["longitude"]

    if latitude not in (None, ""):
        try:
            normalized["latitude"] = float(latitude)
            latitude = normalized["latitude"]
        except (TypeError, ValueError):
            latitude = None
    else:
        latitude = None

    if longitude not in (None, ""):
        try:
            normalized["longitude"] = float(longitude)
            longitude = normalized["longitude"]
        except (TypeError, ValueError):
            longitude = None
    else:
        longitude = None

    location_name = existing_location_name
    if not location_name and latitude is not None and longitude is not None:
        location_name = _reverse_geocode_to_english(latitude, longitude) or ""
    if not location_name and fallback_location_name:
        location_name = fallback_location_name

    if location_name:
        normalized["location_name"] = location_name
    if captured_at:
        normalized["captured_at"] = captured_at

    return normalized


def _normalize_statement_entries(raw_value) -> List[dict]:
    """Parse and normalize statement_entries JSON data."""
    if not raw_value:
        return []

    if isinstance(raw_value, list):
        raw_items = raw_value
    elif isinstance(raw_value, str):
        try:
            parsed = json.loads(raw_value)
        except (json.JSONDecodeError, TypeError, ValueError):
            return []
        raw_items = parsed if isinstance(parsed, list) else []
    else:
        return []

    normalized_items: List[dict] = []
    for index, item in enumerate(raw_items, start=1):
        if not isinstance(item, dict):
            continue

        statement_text = str(item.get("translation_en") or item.get("text_en") or "").strip()
        transcript_mr = str(item.get("transcript_mr") or item.get("text_mr") or "").strip()
        if not statement_text:
            continue

        normalized_items.append(
            {
                "index": int(item.get("index") or index),
                "statement_text": statement_text,
                "transcript_mr": transcript_mr,
                "created_at": item.get("created_at") or "",
                "source": str(item.get("source") or "").strip(),
            }
        )
    return normalized_items


def _column_exists(table_name: str, column_name: str) -> bool:
    """Return whether a column exists in the current database table."""
    cache_key = f"{table_name}.{column_name}"
    if cache_key in _COLUMN_EXISTS_CACHE:
        return _COLUMN_EXISTS_CACHE[cache_key]

    try:
        with connections['default'].cursor() as cursor:
            cursor.execute(
                """
                SELECT EXISTS (
                    SELECT 1
                    FROM information_schema.columns
                    WHERE table_name = %s AND column_name = %s
                )
                """,
                [table_name, column_name],
            )
            exists = bool(cursor.fetchone()[0])
    except Exception as exc:
        logger.warning(f"Failed to inspect column {table_name}.{column_name}: {exc}")
        exists = False

    _COLUMN_EXISTS_CACHE[cache_key] = exists
    return exists


def _collect_vendor_statements(case_id: int) -> List[dict]:
    """Collect all vendor statements (including multi-entry statements) for AI brief generation."""
    vendor_statements: List[dict] = []
    statement_tables = (
        ("claimant_checks", "statement", "Claimant Check"),
        ("insured_checks", "statement", "Insured Check"),
        ("driver_checks", "statement", "Driver Check"),
        ("spot_checks", "observations", "Spot Check"),
        ("chargesheets", "statement", "Chargesheet"),
    )

    with connections['default'].cursor() as cursor:
        for table_name, legacy_column, check_label in statement_tables:
            if _column_exists(table_name, "statement_entries"):
                cursor.execute(
                    f"""
                    SELECT id,
                           COALESCE(statement_entries, '[]'::jsonb) AS statement_entries,
                           COALESCE({legacy_column}, '') AS legacy_statement
                    FROM {table_name}
                    WHERE case_id = %s
                    ORDER BY id
                    """,
                    [case_id],
                )
            else:
                cursor.execute(
                    f"""
                    SELECT id,
                           '[]'::jsonb AS statement_entries,
                           COALESCE({legacy_column}, '') AS legacy_statement
                    FROM {table_name}
                    WHERE case_id = %s
                    ORDER BY id
                    """,
                    [case_id],
                )

            for check_id, raw_entries, legacy_statement in cursor.fetchall():
                entries = _normalize_statement_entries(raw_entries)
                if entries:
                    for entry in entries:
                        vendor_statements.append(
                            {
                                "check_type": check_label,
                                "check_id": check_id,
                                "statement_index": entry["index"],
                                "statement_text": entry["statement_text"],
                                "transcript_mr": entry["transcript_mr"],
                                "created_at": entry["created_at"],
                                "source": entry["source"] or "audio",
                            }
                        )
                    continue

                legacy_text = str(legacy_statement or "").strip()
                if legacy_text:
                    vendor_statements.append(
                        {
                            "check_type": check_label,
                            "check_id": check_id,
                            "statement_index": 1,
                            "statement_text": legacy_text,
                            "transcript_mr": "",
                            "created_at": "",
                            "source": "legacy",
                        }
                    )

    vendor_statements.sort(
        key=lambda item: (
            str(item.get("created_at") or ""),
            str(item.get("check_type") or ""),
            int(item.get("statement_index") or 0),
        )
    )
    return vendor_statements


# =============================================================================
# Schemas
# =============================================================================

class ClientSchema(Schema):
    """Client response schema for dropdown."""
    id: int
    client_code: str
    client_name: str
    location: str


class ClientDetailSchema(Schema):
    """Full client response schema."""
    id: int
    client_code: str
    client_name: str
    location: str
    date_of_commencement: Optional[str] = None
    insured_rate: Optional[float] = None
    notice_134_rate: Optional[float] = None
    claimant_rate: Optional[float] = None
    income_rate: Optional[float] = None
    driver_rate: Optional[float] = None
    dl_rate: Optional[float] = None
    rc_rate: Optional[float] = None
    permit_rate: Optional[float] = None
    spot_rate: Optional[float] = None
    court_rate: Optional[float] = None
    notice_rate: Optional[float] = None
    rti_rate: Optional[float] = None
    hospital_rate: Optional[float] = None
    is_active: bool = True
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None


class CreateClientSchema(Schema):
    """Schema for creating/updating a client."""
    client_code: str
    client_name: str
    location: str = ''
    date_of_commencement: Optional[str] = None
    insured_rate: Optional[float] = None
    notice_134_rate: Optional[float] = None
    claimant_rate: Optional[float] = None
    income_rate: Optional[float] = None
    driver_rate: Optional[float] = None
    dl_rate: Optional[float] = None
    rc_rate: Optional[float] = None
    permit_rate: Optional[float] = None
    spot_rate: Optional[float] = None
    court_rate: Optional[float] = None
    notice_rate: Optional[float] = None
    rti_rate: Optional[float] = None
    hospital_rate: Optional[float] = None
    is_active: bool = True


class VendorSchema(Schema):
    """Vendor response schema for dropdown."""
    id: int
    company_name: str
    contact_email: str
    city: str
    state: str
    is_active: bool

class CaseSchema(Schema):
    """Case response schema."""
    id: int
    case_number: str
    title: str
    description: Optional[str] = None
    status: str
    priority: str
    category: str
    claim_number: Optional[str] = None
    client_name: Optional[str] = None
    claimant_name: Optional[str] = None
    insured_name: Optional[str] = None
    client_code: Optional[str] = None
    # Date and timing fields
    case_receive_date: Optional[str] = None
    receive_month: Optional[str] = None
    completion_date: Optional[str] = None
    completion_month: Optional[str] = None
    case_due_date: Optional[str] = None
    tat_days: Optional[int] = None
    sla_status: Optional[str] = None
    # Case classification
    case_type: Optional[str] = None
    investigation_report_status: Optional[str] = None
    full_case_status: Optional[str] = None
    scope_of_work: Optional[str] = None
    # Location
    incident_address: Optional[str] = None
    incident_city: Optional[str] = None
    incident_state: Optional[str] = None
    incident_country: Optional[str] = None
    incident_postal_code: Optional[str] = None
    formatted_address: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    vendor_id: Optional[int] = None
    assigned_vendor: Optional[str] = None
    client_id: Optional[int] = None
    created_by_id: Optional[int] = None
    created_at: datetime
    updated_at: datetime
    resolved_at: Optional[datetime] = None
    closed_at: Optional[datetime] = None
    source: Optional[str] = None
    workflow_type: Optional[str] = None
    investigation_progress: Optional[int] = 0
    # Checklist fields
    chk_spot: Optional[bool] = False
    chk_hospital: Optional[bool] = False
    chk_claimant: Optional[bool] = False
    chk_insured: Optional[bool] = False
    chk_witness: Optional[bool] = False
    chk_driver: Optional[bool] = False
    chk_dl: Optional[bool] = False
    chk_rc: Optional[bool] = False
    chk_permit: Optional[bool] = False
    chk_court: Optional[bool] = False
    chk_notice: Optional[bool] = False
    chk_134_notice: Optional[bool] = False
    chk_rti: Optional[bool] = False
    chk_medical_verification: Optional[bool] = False
    chk_income: Optional[bool] = False
    
    class Config:
        # Allow extra fields from database that aren't in schema
        extra = 'ignore'


class CasesListResponse(Schema):
    """Cases list response with pagination."""
    cases: List[CaseSchema]
    total: int


class CaseStatsSchema(Schema):
    """Case statistics schema."""
    total_cases: int
    active_investigations: int
    completed_cases: int
    overdue_cases: int
    pending_cases: int = 0
    total_change: int = 0
    active_change: int = 0
    completed_change: int = 0
    overdue_change: int = 0


class CaseVolumeSchema(Schema):
    """Case volume data for charts."""
    month: str
    total: int
    completed: int


class CaseStatusCountSchema(Schema):
    """Case status count schema."""
    label: str
    count: int


class RecentActivitySchema(Schema):
    """Recent activity schema."""
    type: str
    text: str
    time: str


class AuditLogEntrySchema(Schema):
    """Audit log entry for admin portal."""
    event_time: datetime
    event_type: str
    actor: str
    description: str
    case_number: Optional[str] = None
    source: str


class AIBriefReportResponse(Schema):
    """AI brief generation response."""
    case_id: int
    case_number: str
    report_text: str
    statement_excerpt: str
    evidence_photos: Optional[List[dict]] = None  # List of evidence photo URLs
    vendor_statements: Optional[List[dict]] = None  # All statements captured by vendor


class CreateCaseSchema(Schema):
    """Schema for creating a new case."""
    # ---- Common fields (filled at top of New Case page) ----
    claim_number: str
    client_name: str = ''
    category: str = 'MACT'
    case_receive_date: Optional[str] = None  # ISO date string YYYY-MM-DD
    receive_month: str = ''
    completion_date: Optional[str] = None
    completion_month: str = ''
    case_due_date: Optional[str] = None
    tat_days: Optional[int] = None
    sla_status: str = ''  # AT or WT
    case_type: str = ''   # Full Case / Partial Case / Reassessment / Connected Case
    investigation_report_status: str = 'Open'
    full_case_status: str = 'WIP'
    scope_of_work: str = ''
    
    # Basic / system fields
    title: str = ''
    description: str = ''
    priority: str = 'MEDIUM'
    status: str = 'OPEN'
    
    # Claim extra
    client_code: str = ''
    
    # People Information
    insured_name: str = ''
    claimant_name: str = ''
    
    # Incident Location
    incident_address: str = ''
    incident_city: str = ''
    incident_state: str = ''
    incident_postal_code: str = ''
    incident_country: str = 'India'
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    
    # Assignment
    client_id: Optional[int] = None
    vendor_id: Optional[int] = None
    
    # Workflow Information
    source: str = 'MANUAL'
    workflow_type: str = 'STANDARD'
    
    # Verification Checklist
    chk_spot: bool = False
    chk_hospital: bool = False
    chk_claimant: bool = False
    chk_insured: bool = False
    chk_witness: bool = False
    chk_driver: bool = False
    chk_dl: bool = False
    chk_rc: bool = False
    chk_permit: bool = False
    chk_court: bool = False
    chk_notice: bool = False
    chk_134_notice: bool = False
    chk_rti: bool = False
    chk_medical_verification: bool = False
    chk_income: bool = False


class CaseCreatedResponse(Schema):
    """Response schema for case creation."""
    id: int
    case_number: str
    title: str
    message: str
    incident_case_db_id: Optional[int] = None


class ErrorResponse(Schema):
    """Error response schema."""
    error: str
    detail: Optional[str] = None


# =============================================================================
# Helper Functions
# =============================================================================

def dict_fetchall(cursor):
    """Return all rows from a cursor as a dict."""
    columns = [col[0] for col in cursor.description]
    return [dict(zip(columns, row)) for row in cursor.fetchall()]


def is_admin_or_super_admin(user) -> bool:
    """Check if user is admin or super admin."""
    return (
        user.is_authenticated and
        user.role in ['ADMIN', 'SUPER_ADMIN']
    )


# =============================================================================
# API Endpoints
# =============================================================================

@router.get(
    "/cases",
    response=CasesListResponse,
    summary="Get All Cases",
    description="Retrieve all cases with optional filters and pagination.",
)
def get_cases(
    request: HttpRequest,
    page: int = 1,
    page_size: int = 10,
    status: Optional[str] = None,
    category: Optional[str] = None,
    search: Optional[str] = None,
):
    """
    Get all cases with filtering and pagination.
    
    Filters:
    - status: Filter by case status (OPEN, IN_PROGRESS, RESOLVED, CLOSED)
    - category: Filter by case category
    - search: Search in title, description, case_number, claim_number
    """
    if not is_admin_or_super_admin(request.user):
        return {"cases": [], "total": 0}
    
    try:
        with connection.cursor() as cursor:
            # Build WHERE clause
            where_conditions = []
            params = []
            
            if status:
                where_conditions.append("ic.status = %s")
                params.append(status)
            
            if category:
                where_conditions.append("ic.category = %s")
                params.append(category)
            
            if search:
                where_conditions.append(
                    "(ic.title ILIKE %s OR ic.description ILIKE %s OR ic.case_number ILIKE %s OR ic.claim_number ILIKE %s)"
                )
                search_param = f"%{search}%"
                params.extend([search_param, search_param, search_param, search_param])
            
            where_clause = " AND ".join(where_conditions) if where_conditions else "1=1"
            
            # Get total count
            count_query = f"SELECT COUNT(*) FROM insurance_case ic WHERE {where_clause}"
            cursor.execute(count_query, params)
            total = cursor.fetchone()[0]
            
            # Get paginated data with vendor name
            offset = (page - 1) * page_size
            data_query = f"""
                SELECT 
                    ic.*,
                    v.company_name as assigned_vendor
                FROM insurance_case ic
                LEFT JOIN users_vendor v ON ic.vendor_id = v.id
                WHERE {where_clause}
                ORDER BY ic.created_at DESC
                LIMIT %s OFFSET %s
            """
            cursor.execute(data_query, params + [page_size, offset])
            
            cases = dict_fetchall(cursor)
            
            return {
                "cases": cases,
                "total": total
            }
    
    except Exception as e:
        logger.error(f"Failed to fetch cases: {e}")
        return {"cases": [], "total": 0}


@router.get(
    "/cases/incident-db",
    summary="List Cases from incident_case_db",
    description="Returns all cases from incident_case_db with verification sub-items.",
)
def get_cases_incident_db(
    request: HttpRequest,
    page: int = 1,
    page_size: int = 10,
    search: Optional[str] = None,
    full_case_status: Optional[str] = None,
    case_type: Optional[str] = None,
    investigation_report_status: Optional[str] = None,
    assigned_vendor_name: Optional[str] = None,
):
    """
    Returns paginated cases from incident_case_db.cases joined with all 5 check
    tables so the frontend can render expandable sub-items numbered {seq}.{n}.
    """
    if not is_admin_or_super_admin(request.user):
        return {"cases": [], "total": 0}

    try:
        with connections['default'].cursor() as cursor:
            # ── Build WHERE clause ──────────────────────────────────────────
            conditions, params = [], []

            if full_case_status:
                conditions.append("c.full_case_status = %s")
                params.append(full_case_status)

            if case_type:
                conditions.append("c.case_type = %s")
                params.append(case_type)

            if investigation_report_status:
                conditions.append("c.investigation_report_status = %s")
                params.append(investigation_report_status)

            if assigned_vendor_name:
                conditions.append("EXISTS (SELECT 1 FROM claimant_checks cc LEFT JOIN users_vendor uv ON uv.id = cc.assigned_vendor_id WHERE cc.case_id = c.id AND uv.company_name ILIKE %s) OR "
                                  "EXISTS (SELECT 1 FROM insured_checks ic LEFT JOIN users_vendor uv ON uv.id = ic.assigned_vendor_id WHERE ic.case_id = c.id AND uv.company_name ILIKE %s) OR "
                                  "EXISTS (SELECT 1 FROM driver_checks dc LEFT JOIN users_vendor uv ON uv.id = dc.assigned_vendor_id WHERE dc.case_id = c.id AND uv.company_name ILIKE %s) OR "
                                  "EXISTS (SELECT 1 FROM spot_checks sc LEFT JOIN users_vendor uv ON uv.id = sc.assigned_vendor_id WHERE sc.case_id = c.id AND uv.company_name ILIKE %s) OR "
                                  "EXISTS (SELECT 1 FROM chargesheets cs LEFT JOIN users_vendor uv ON uv.id = cs.assigned_vendor_id WHERE cs.case_id = c.id AND uv.company_name ILIKE %s) OR "
                                  "EXISTS (SELECT 1 FROM rti_checks rt LEFT JOIN users_vendor uv ON uv.id = rt.assigned_vendor_id WHERE rt.case_id = c.id AND uv.company_name ILIKE %s) OR "
                                  "EXISTS (SELECT 1 FROM rto_checks ro LEFT JOIN users_vendor uv ON uv.id = ro.assigned_vendor_id WHERE ro.case_id = c.id AND uv.company_name ILIKE %s)")
                vendor_param = f"%{assigned_vendor_name}%"
                params.extend([vendor_param] * 7)

            if search:
                conditions.append(
                    "(c.claim_number ILIKE %s OR c.client_name ILIKE %s OR c.category ILIKE %s OR c.case_number ILIKE %s)"
                )
                sp = f"%{search}%"
                params.extend([sp, sp, sp, sp])

            where = " AND ".join(conditions) if conditions else "1=1"

            # ── Total count ─────────────────────────────────────────────────
            cursor.execute(f"SELECT COUNT(*) FROM cases c WHERE {where}", params)
            total = cursor.fetchone()[0]

            # ── Paginated rows with sequential row number ───────────────────
            offset = (page - 1) * page_size
            cursor.execute(f"""
                SELECT
                    ROW_NUMBER() OVER (ORDER BY c.created_at DESC NULLS LAST, c.id DESC) AS seq_num,
                    c.*
                FROM cases c
                WHERE {where}
                ORDER BY c.created_at DESC NULLS LAST, c.id DESC
                LIMIT %s OFFSET %s
            """, params + [page_size, offset])

            cols = [col[0] for col in cursor.description]
            rows = [dict(zip(cols, r)) for r in cursor.fetchall()]

            if not rows:
                return {"cases": [], "total": total}

            case_ids = [r["id"] for r in rows]
            ph = ",".join(["%s"] * len(case_ids))

            # ── Fetch sub-checks from all 5 tables ──────────────────────────
            check_tables = [
                ("claimant_checks", "Claimant Check"),
                ("insured_checks",  "Insured Check"),
                ("driver_checks",   "Driver Check"),
                ("spot_checks",     "Spot Check"),
                ("chargesheets",    "Chargesheet"),
            ]

            checks_by_case = {r["id"]: [] for r in rows}

            # ─── claimant_checks ───────────────────────────────────────────
            cursor.execute(f"""
                SELECT cc.case_id, cc.check_status,
                       cc.claimant_name  AS name,
                       cc.claimant_contact AS contact,
                       cc.claimant_address AS location,
                       CAST(cc.claimant_income AS TEXT) AS key_info,
                       cc.statement,
                       cc.observation AS observation,
                       cc.assigned_vendor_id,
                       v.company_name AS assigned_vendor_name
                FROM claimant_checks cc
                LEFT JOIN users_vendor v ON v.id = cc.assigned_vendor_id
                WHERE cc.case_id IN ({ph})
            """, case_ids)
            for r in cursor.fetchall():
                cid = r[0]
                if cid in checks_by_case:
                    checks_by_case[cid].append({
                        "type": "Claimant Check",
                        "check_status": r[1] or "WIP",
                        "name": r[2] or "—",
                        "contact": r[3] or "—",
                        "location": r[4] or "—",
                        "key_info": f"Income: {r[5]}" if r[5] else "—",
                        "statement": (r[6] or r[7] or "")[:120],
                        "assigned_vendor_id": r[8],
                        "assigned_vendor_name": r[9],
                    })

            # ─── insured_checks ────────────────────────────────────────────
            cursor.execute(f"""
                SELECT ic.case_id, ic.check_status,
                       ic.insured_name AS name,
                       ic.insured_contact AS contact,
                       ic.insured_address AS location,
                       ic.policy_number,
                       ic.policy_period,
                       ic.rc,
                       ic.permit,
                       ic.statement,
                       ic.observation AS observation,
                       ic.assigned_vendor_id,
                       v.company_name AS assigned_vendor_name
                FROM insured_checks ic
                LEFT JOIN users_vendor v ON v.id = ic.assigned_vendor_id
                WHERE ic.case_id IN ({ph})
            """, case_ids)
            for r in cursor.fetchall():
                cid = r[0]
                if cid in checks_by_case:
                    policy = " / ".join(filter(None, [r[5], r[6]])) or "—"
                    rc_permit = " | ".join(filter(None, [r[7] and f"RC:{r[7]}", r[8] and f"Permit:{r[8]}"])) or "—"
                    checks_by_case[cid].append({
                        "type": "Insured Check",
                        "check_status": r[1] or "WIP",
                        "name": r[2] or "—",
                        "contact": r[3] or "—",
                        "location": r[4] or "—",
                        "key_info": f"Policy: {policy} | {rc_permit}",
                        "statement": (r[9] or r[10] or "")[:120],
                        "assigned_vendor_id": r[11],
                        "assigned_vendor_name": r[12],
                    })

            # ─── driver_checks ─────────────────────────────────────────────
            cursor.execute(f"""
                SELECT dc.case_id, dc.check_status,
                       dc.driver_name AS name,
                       dc.driver_contact AS contact,
                       dc.driver_address AS location,
                       dc.dl,
                       dc.permit,
                       dc.occupation,
                       dc.statement,
                       dc.observation AS observation,
                       dc.assigned_vendor_id,
                       v.company_name AS assigned_vendor_name
                FROM driver_checks dc
                LEFT JOIN users_vendor v ON v.id = dc.assigned_vendor_id
                WHERE dc.case_id IN ({ph})
            """, case_ids)
            for r in cursor.fetchall():
                cid = r[0]
                if cid in checks_by_case:
                    dl_info = " | ".join(filter(None, [r[5] and f"DL:{r[5]}", r[6] and f"Permit:{r[6]}", r[7] and f"Occ:{r[7]}"])) or "—"
                    checks_by_case[cid].append({
                        "type": "Driver Check",
                        "check_status": r[1] or "WIP",
                        "name": r[2] or "—",
                        "contact": r[3] or "—",
                        "location": r[4] or "—",
                        "key_info": dl_info,
                        "statement": (r[8] or r[9] or "")[:120],
                        "assigned_vendor_id": r[10],
                        "assigned_vendor_name": r[11],
                    })

            # ─── spot_checks ───────────────────────────────────────────────
            cursor.execute(f"""
                SELECT sc.case_id, sc.check_status,
                       sc.place_of_accident AS name,
                       sc.police_station AS contact,
                       sc.district AS location,
                       sc.fir_number,
                       sc.time_of_accident,
                       sc.accident_brief,
                       sc.observations,
                       sc.assigned_vendor_id,
                       v.company_name AS assigned_vendor_name
                FROM spot_checks sc
                LEFT JOIN users_vendor v ON v.id = sc.assigned_vendor_id
                WHERE sc.case_id IN ({ph})
            """, case_ids)
            for r in cursor.fetchall():
                cid = r[0]
                if cid in checks_by_case:
                    fir_time = " | ".join(filter(None, [r[5] and f"FIR:{r[5]}", r[6] and f"Time:{r[6]}"])) or "—"
                    checks_by_case[cid].append({
                        "type": "Spot Check",
                        "check_status": r[1] or "WIP",
                        "name": r[2] or "—",
                        "contact": r[3] or "—",
                        "location": r[4] or "—",
                        "key_info": fir_time,
                        "statement": (r[7] or r[8] or "")[:120],
                        "assigned_vendor_id": r[9],
                        "assigned_vendor_name": r[10],
                    })

            # ─── chargesheets ──────────────────────────────────────────────
            cursor.execute(f"""
                SELECT cs.case_id, cs.check_status,
                       cs.court_name AS name,
                       cs.fir_number AS contact,
                       '' AS location,
                       cs.mv_act,
                       cs.fir_delay_days,
                       cs.bsn_section,
                       cs.ipc,
                       cs.statement,
                       cs.observations,
                       cs.assigned_vendor_id,
                       v.company_name AS assigned_vendor_name
                FROM chargesheets cs
                LEFT JOIN users_vendor v ON v.id = cs.assigned_vendor_id
                WHERE cs.case_id IN ({ph})
            """, case_ids)
            for r in cursor.fetchall():
                cid = r[0]
                if cid in checks_by_case:
                    cs_info = " | ".join(filter(None, [
                        r[5] and f"MV:{r[5]}",
                        r[6] is not None and f"Delay:{r[6]}d",
                        r[7] and f"BSN:{r[7]}",
                        r[8] and f"IPC:{r[8]}",
                    ])) or "—"
                    checks_by_case[cid].append({
                        "type": "Chargesheet",
                        "check_status": r[1] or "WIP",
                        "name": r[2] or "—",
                        "contact": f"FIR: {r[3]}" if r[3] else "—",
                        "location": "—",
                        "key_info": cs_info,
                        "statement": (r[9] or r[10] or "")[:120],
                        "assigned_vendor_id": r[11],
                        "assigned_vendor_name": r[12],
                    })

            # ─── rti_checks ───────────────────────────────────────────────
            cursor.execute(f"""
                SELECT rt.case_id, rt.check_status,
                       rt.fir_number,
                       rt.dl_number,
                       rt.permit_number,
                       rt.rc_number,
                       rt.chargesheet_checked,
                       rt.dl_checked,
                       rt.permit_checked,
                       rt.rc_checked,
                       rt.remarks,
                       rt.assigned_vendor_id,
                       v.company_name AS assigned_vendor_name
                FROM rti_checks rt
                LEFT JOIN users_vendor v ON v.id = rt.assigned_vendor_id
                WHERE rt.case_id IN ({ph})
            """, case_ids)
            for r in cursor.fetchall():
                cid = r[0]
                if cid in checks_by_case:
                    items = []
                    if r[6]: items.append("Chargesheet")
                    if r[7]: items.append(f"DL:{r[3]}" if r[3] else "DL")
                    if r[8]: items.append(f"Permit:{r[4]}" if r[4] else "Permit")
                    if r[9]: items.append(f"RC:{r[5]}" if r[5] else "RC")
                    key_info = " | ".join(items) or "—"
                    checks_by_case[cid].append({
                        "type": "RTI Check",
                        "check_status": r[1] or "WIP",
                        "name": f"FIR: {r[2]}" if r[2] else "RTI",
                        "contact": "—",
                        "location": "—",
                        "key_info": key_info,
                        "statement": (r[10] or "")[:120],
                        "assigned_vendor_id": r[11],
                        "assigned_vendor_name": r[12],
                    })

            # ─── rto_checks ───────────────────────────────────────────────
            cursor.execute(f"""
                SELECT ro.case_id, ro.check_status,
                       ro.rto_name,
                       ro.rto_address,
                       ro.dl_number,
                       ro.permit_number,
                       ro.rc_number,
                       ro.dl_checked,
                       ro.permit_checked,
                       ro.rc_checked,
                       ro.remarks,
                       ro.assigned_vendor_id,
                       v.company_name AS assigned_vendor_name
                FROM rto_checks ro
                LEFT JOIN users_vendor v ON v.id = ro.assigned_vendor_id
                WHERE ro.case_id IN ({ph})
            """, case_ids)
            for r in cursor.fetchall():
                cid = r[0]
                if cid in checks_by_case:
                    items = []
                    if r[7]: items.append(f"DL:{r[4]}" if r[4] else "DL")
                    if r[8]: items.append(f"Permit:{r[5]}" if r[5] else "Permit")
                    if r[9]: items.append(f"RC:{r[6]}" if r[6] else "RC")
                    key_info = " | ".join(items) or "—"
                    checks_by_case[cid].append({
                        "type": "RTO Check",
                        "check_status": r[1] or "WIP",
                        "name": r[2] or "RTO",
                        "contact": "—",
                        "location": r[3] or "—",
                        "key_info": key_info,
                        "statement": (r[10] or "")[:120],
                        "assigned_vendor_id": r[11],
                        "assigned_vendor_name": r[12],
                    })

            # ── Build final result ───────────────────────────────────────────
            result = []
            for row in rows:
                chks = checks_by_case.get(row["id"], [])
                sub_items = []
                for i, c in enumerate(chks, 1):
                    sub_items.append({
                        "sub_id":       f"{int(row['seq_num'])}.{i}",
                        "type":         c["type"],
                        "check_status": c["check_status"],
                        "name":         c.get("name", "—"),
                        "contact":      c.get("contact", "—"),
                        "location":     c.get("location", "—"),
                        "key_info":     c.get("key_info", "—"),
                        "statement":    c.get("statement", ""),
                        "assigned_vendor_id": c.get("assigned_vendor_id"),
                        "assigned_vendor_name": c.get("assigned_vendor_name", ""),
                    })
                row["sub_items"] = sub_items
                row["seq_num"] = int(row["seq_num"])
                # Serialize dates/datetimes to ISO strings
                for k, v in list(row.items()):
                    if hasattr(v, "isoformat"):
                        row[k] = v.isoformat()
                result.append(row)

            return {"cases": result, "total": total}

    except Exception as exc:
        logger.error(f"Failed to fetch cases from incident_case_db: {exc}")
        return {"cases": [], "total": 0}


def _fetch_ai_brief_case_context(case_id: int) -> dict:
    """Fetch comprehensive case context for AI report generation.

    Includes all key fields needed for a complete investigation report:
    - Case number and claim number
    - Incident location and date
    - Client details
    - Vendor details
    - Investigation summary
    - Statements from claimant, insured, and driver checks
    - Vendor evidence photos from all supported checks
    """
    with connections['default'].cursor() as cursor:
        cursor.execute(
            """
            SELECT
                c.id,
                c.case_number,
                c.claim_number,
                c.client_name,
                c.case_type,
                c.investigation_report_status,
                c.full_case_status,
                c.scope_of_work,
                c.case_receive_date,
                c.category,
                -- Incident brief from spot check
                COALESCE(sc.accident_brief, '') AS incident_brief,
                -- Incident date/time from spot check
                COALESCE(sc.time_of_accident, '') AS incident_date,
                -- Full incident location details
                CONCAT_WS(', ',
                    NULLIF(sc.place_of_accident, ''),
                    NULLIF(sc.city, ''),
                    NULLIF(sc.district, ''),
                    NULLIF(sc.police_station, '')
                ) AS incident_location,
                -- FIR details
                COALESCE(sc.fir_number, '') AS fir_number,
                -- Claimant details
                COALESCE(
                    (SELECT claimant_name FROM claimant_checks WHERE case_id = c.id LIMIT 1),
                    ''
                ) AS claimant_name,
                COALESCE(
                    (SELECT claimant_address FROM claimant_checks WHERE case_id = c.id LIMIT 1),
                    ''
                ) AS claimant_address,
                -- Claimant statement
                COALESCE(
                    (SELECT statement FROM claimant_checks WHERE case_id = c.id AND statement != '' LIMIT 1),
                    ''
                ) AS claimant_statement,
                -- Insured details
                COALESCE(
                    (SELECT insured_name FROM insured_checks WHERE case_id = c.id LIMIT 1),
                    ''
                ) AS insured_name,
                COALESCE(
                    (SELECT insured_address FROM insured_checks WHERE case_id = c.id LIMIT 1),
                    ''
                ) AS insured_address,
                COALESCE(
                    (SELECT policy_number FROM insured_checks WHERE case_id = c.id LIMIT 1),
                    ''
                ) AS policy_number,
                -- Insured statement
                COALESCE(
                    (SELECT statement FROM insured_checks WHERE case_id = c.id AND statement != '' LIMIT 1),
                    ''
                ) AS insured_statement,
                -- Driver details
                COALESCE(
                    (SELECT driver_name FROM driver_checks WHERE case_id = c.id LIMIT 1),
                    ''
                ) AS driver_name,
                -- Driver statement
                COALESCE(
                    (SELECT statement FROM driver_checks WHERE case_id = c.id AND statement != '' LIMIT 1),
                    ''
                ) AS driver_statement,
                -- Assigned vendor name (from any check type)
                COALESCE(
                    (SELECT uv.company_name FROM claimant_checks cc LEFT JOIN users_vendor uv ON uv.id = cc.assigned_vendor_id WHERE cc.case_id = c.id AND uv.company_name IS NOT NULL LIMIT 1),
                    (SELECT uv.company_name FROM insured_checks ic LEFT JOIN users_vendor uv ON uv.id = ic.assigned_vendor_id WHERE ic.case_id = c.id AND uv.company_name IS NOT NULL LIMIT 1),
                    (SELECT uv.company_name FROM driver_checks dc LEFT JOIN users_vendor uv ON uv.id = dc.assigned_vendor_id WHERE dc.case_id = c.id AND uv.company_name IS NOT NULL LIMIT 1),
                    (SELECT uv.company_name FROM spot_checks sp LEFT JOIN users_vendor uv ON uv.id = sp.assigned_vendor_id WHERE sp.case_id = c.id AND uv.company_name IS NOT NULL LIMIT 1),
                    (SELECT uv.company_name FROM chargesheets ch LEFT JOIN users_vendor uv ON uv.id = ch.assigned_vendor_id WHERE ch.case_id = c.id AND uv.company_name IS NOT NULL LIMIT 1),
                    (SELECT uv.company_name FROM rti_checks rt LEFT JOIN users_vendor uv ON uv.id = rt.assigned_vendor_id WHERE rt.case_id = c.id AND uv.company_name IS NOT NULL LIMIT 1),
                    (SELECT uv.company_name FROM rto_checks ro LEFT JOIN users_vendor uv ON uv.id = ro.assigned_vendor_id WHERE ro.case_id = c.id AND uv.company_name IS NOT NULL LIMIT 1),
                    ''
                ) AS assigned_vendor_name
            FROM cases c
            LEFT JOIN spot_checks sc ON sc.case_id = c.id
            WHERE c.id = %s
            """,
            [case_id],
        )
        row = cursor.fetchone()

    if not row:
        raise HttpError(404, f"Case id={case_id} not found")

    # Format case_receive_date if present
    case_receive_date = row[8]
    if case_receive_date:
        case_receive_date = case_receive_date.strftime('%Y-%m-%d') if hasattr(case_receive_date, 'strftime') else str(case_receive_date)

    def _parse_jsonb_list(value):
        if not value:
            return []
        if isinstance(value, list):
            return value
        if isinstance(value, str):
            try:
                parsed = json.loads(value)
            except (json.JSONDecodeError, TypeError, ValueError):
                return []
            return parsed if isinstance(parsed, list) else []
        return []

    vendor_evidence = []
    seen_evidence_urls = set()
    evidence_tables = (
        "claimant_checks",
        "insured_checks",
        "driver_checks",
        "spot_checks",
        "chargesheets",
    )
    try:
        with connections['default'].cursor() as cursor:
            for table in evidence_tables:
                cursor.execute(
                    f"SELECT vendor_evidence FROM {table} WHERE case_id = %s AND vendor_evidence IS NOT NULL",
                    [case_id],
                )
                for (raw_evidence,) in cursor.fetchall():
                    for item in _parse_jsonb_list(raw_evidence):
                        if isinstance(item, str):
                            evidence_item = {"url": item}
                        elif isinstance(item, dict):
                            evidence_item = item
                        else:
                            continue

                        evidence_url = (evidence_item.get("url") or "").strip()
                        if not evidence_url or evidence_url in seen_evidence_urls:
                            continue

                        seen_evidence_urls.add(evidence_url)
                        vendor_evidence.append(evidence_item)
    except Exception as exc:
        logger.warning(f"Failed to fetch vendor evidence for case {case_id}: {exc}")

    vendor_statements = _collect_vendor_statements(case_id)
    vendor_statement_text = "\n\n".join(
        [
            f"[{item.get('check_type')} - Statement {item.get('statement_index')}] {item.get('statement_text')}"
            for item in vendor_statements
            if str(item.get("statement_text") or "").strip()
        ]
    )

    return {
        "case_id": row[0],
        "case_number": row[1],
        "claim_number": row[2],
        "client_name": row[3],
        "case_type": row[4],
        "investigation_report_status": row[5],
        "full_case_status": row[6],
        "scope_of_work": row[7],
        "case_receive_date": case_receive_date or "",
        "category": row[9],
        "incident_brief": row[10],
        "incident_date": row[11],
        "incident_location": row[12],
        "fir_number": row[13],
        "claimant_name": row[14],
        "claimant_address": row[15],
        "claimant_statement": row[16],
        "insured_name": row[17],
        "insured_address": row[18],
        "policy_number": row[19],
        "insured_statement": row[20],
        "driver_name": row[21],
        "driver_statement": row[22],
        "assigned_vendor_name": row[23],
        "vendor_evidence": vendor_evidence,
        "vendor_statements": vendor_statements,
        "vendor_statement_text": vendor_statement_text,
    }


@router.post(
    "/cases/incident-db/{case_id}/ai-brief-report",
    response={200: AIBriefReportResponse},
    summary="Generate AI brief report",
    description="Generate an AI brief report from vendor statements stored in check tables for an incident-db case.",
)
def generate_ai_brief_report(
    request: HttpRequest,
    case_id: int,
):
    """Generate an AI report from stored vendor statements and case context."""
    if not is_admin_or_super_admin(request.user):
        raise HttpError(403, "Admin access required")

    try:
        case_context = _fetch_ai_brief_case_context(case_id)
        statement_text = str(case_context.get("vendor_statement_text") or "").strip()
        if not statement_text:
            raise HttpError(
                400,
                "No vendor statements are stored for this case. Please record statements in the vendor portal first.",
            )

        service = AIBriefService()
        result = service.generate_report_from_statement_text(case_context, statement_text)
        
        fallback_location_name = (
            str(case_context.get("incident_location") or "").strip()
            or str(case_context.get("claimant_address") or "").strip()
            or str(case_context.get("insured_address") or "").strip()
        )

        vendor_evidence = []
        for item in case_context.get('vendor_evidence', []):
            if not isinstance(item, (dict, str)):
                continue
            vendor_evidence.append(
                _enrich_evidence_metadata(
                    request,
                    item,
                    fallback_location_name=fallback_location_name,
                )
            )
        
        return {
            "case_id": case_context["case_id"],
            "case_number": case_context["case_number"] or "",
            "report_text": result["report_text"],
            "statement_excerpt": result["statement_text"][:1000],
            "evidence_photos": vendor_evidence if vendor_evidence else None,
            "vendor_statements": case_context.get("vendor_statements") or [],
        }
    except AIBriefGenerationError as exc:
        logger.error(f"AI brief generation failed for case {case_id}: {exc}")
        raise HttpError(400, str(exc))
    except HttpError:
        raise
    except Exception as exc:
        logger.error(f"Unexpected AI brief generation error for case {case_id}: {exc}")
        raise HttpError(500, "Failed to generate AI brief report")


@router.delete(
    "/cases/incident-db/{case_id}",
    summary="Delete Case",
    description="Delete a case and all its related verification checks. Admin access required.",
)
def delete_case_from_incident_db(request: HttpRequest, case_id: int):
    """Delete a case from incident_case_db and all its related verification checks."""
    if not is_admin_or_super_admin(request.user):
        raise HttpError(403, "Admin access required")

    try:
        from users.incident_case_db import delete_case
        result = delete_case(case_id)
        logger.info(f"[API] Case {case_id} deleted by user {request.user.username}")
        return result
    except ValueError as exc:
        logger.warning(f"[API] Case {case_id} not found: {exc}")
        raise HttpError(404, str(exc))
    except Exception as exc:
        logger.error(f"[API] Failed to delete case {case_id}: {exc}")
        raise HttpError(500, f"Failed to delete case: {str(exc)}")


# ---------------------------------------------------------------------------
# CHECK DETAIL & UPDATE  (incident_case_db)
# ---------------------------------------------------------------------------

_CHECK_TABLE_MAP = {
    'claimant':    'claimant_checks',
    'insured':     'insured_checks',
    'driver':      'driver_checks',
    'spot':        'spot_checks',
    'chargesheet': 'chargesheets',
    'rti':         'rti_checks',
    'rto':         'rto_checks',
}


@router.get(
    "/cases/incident-db/{case_id}/check/{check_type}",
    summary="Get Case + Check Detail",
    description="Return full case row and full check row for the given check type.",
)
def get_check_detail(request: HttpRequest, case_id: int, check_type: str):
    """Return case details + specific check details from incident_case_db."""
    if not is_admin_or_super_admin(request.user):
        raise HttpError(403, "Admin access required")

    table = _CHECK_TABLE_MAP.get(check_type.lower())
    if not table:
        raise HttpError(400, f"Unknown check type '{check_type}'. Valid: claimant, insured, driver, spot, chargesheet, rti, rto")

    try:
        with connections['default'].cursor() as cursor:
            # Fetch case row
            cursor.execute("SELECT * FROM cases WHERE id = %s", [case_id])
            col_names = [d[0] for d in cursor.description]
            case_row = cursor.fetchone()
            if not case_row:
                raise HttpError(404, f"Case id={case_id} not found")
            case_data = dict(zip(col_names, case_row))
            # Serialize dates
            for k, v in list(case_data.items()):
                if hasattr(v, 'isoformat'):
                    case_data[k] = v.isoformat()

            # Fetch check row
            cursor.execute(f"SELECT * FROM {table} WHERE case_id = %s", [case_id])
            col_names2 = [d[0] for d in cursor.description]
            check_row = cursor.fetchone()
            check_data = {}
            if check_row:
                check_data = dict(zip(col_names2, check_row))
                for k, v in list(check_data.items()):
                    if hasattr(v, 'isoformat'):
                        check_data[k] = v.isoformat()

            return {"case": case_data, "check": check_data, "check_type": check_type.lower()}

    except HttpError:
        raise
    except Exception as exc:
        logger.error(f"get_check_detail failed for case={case_id} type={check_type}: {exc}")
        raise HttpError(500, str(exc))


@router.put(
    "/cases/incident-db/{case_id}/check/{check_type}",
    summary="Update Case + Check Detail",
    description="Update case row and/or the check row in incident_case_db.",
)
def update_check_detail(request: HttpRequest, case_id: int, check_type: str):
    """Update case details and/or specific check details in incident_case_db."""
    import json as _json

    if not is_admin_or_super_admin(request.user):
        raise HttpError(403, "Admin access required")

    table = _CHECK_TABLE_MAP.get(check_type.lower())
    if not table:
        raise HttpError(400, f"Unknown check type '{check_type}'")

    # CASE fields that are safe to update
    CASE_FIELDS = {
        'claim_number', 'client_name', 'category',
        'case_receive_date', 'receive_month',
        'completion_date', 'completion_month',
        'case_due_date', 'tat_days', 'sla',
        'case_type', 'investigation_report_status',
        'full_case_status', 'scope_of_work',
    }

    # Per-table updatable fields
    CHECK_FIELDS = {
        'claimant_checks': {
            'claimant_name', 'claimant_contact', 'claimant_address',
            'claimant_income', 'dependants',
            'check_status', 'statement', 'observation',
            'case_documents', 'vendor_documents',
        },
        'insured_checks': {
            'insured_name', 'insured_contact', 'insured_address',
            'policy_number', 'policy_period', 'rc', 'permit',
            'check_status', 'statement', 'observation',
            'case_documents', 'vendor_documents',
        },
        'driver_checks': {
            'driver_name', 'driver_contact', 'driver_address',
            'dl', 'permit', 'occupation',
            'check_status', 'statement', 'observation',
            'case_documents', 'vendor_documents',
        },
        'spot_checks': {
            'time_of_accident', 'place_of_accident', 'district',
            'fir_number', 'city', 'police_station', 'accident_brief',
            'check_status', 'observations',
            'case_documents', 'vendor_documents',
        },
        'chargesheets': {
            'fir_number', 'city', 'court_name', 'mv_act', 'fir_delay_days',
            'bsn_section', 'ipc',
            'check_status', 'statement', 'observations',
            'case_documents', 'vendor_documents',
        },
        'rti_checks': {
            'chargesheet_checked', 'fir_number',
            'dl_checked', 'dl_number',
            'permit_checked', 'permit_number',
            'rc_checked', 'rc_number',
            'remarks',
            'check_status',
            'case_documents', 'vendor_documents',
        },
        'rto_checks': {
            'rto_name', 'rto_address',
            'dl_checked', 'dl_number',
            'permit_checked', 'permit_number',
            'rc_checked', 'rc_number',
            'remarks',
            'check_status',
            'case_documents', 'vendor_documents',
        },
    }

    try:
        payload = _json.loads(request.body or b'{}')
    except _json.JSONDecodeError:
        raise HttpError(400, "Invalid JSON body")

    case_updates = payload.get('case', {})
    check_updates = payload.get('check', {})

    # JSONB fields need json.dumps() before passing to psycopg2
    _JSONB_FIELDS = {'case_documents', 'vendor_documents', 'dependants'}

    try:
        with connections['default'].cursor() as cursor:
            # Verify case exists
            cursor.execute("SELECT id FROM cases WHERE id = %s", [case_id])
            if not cursor.fetchone():
                raise HttpError(404, f"Case id={case_id} not found")

            # ── Update cases table ────────────────────────────────────────
            safe_case = {k: v for k, v in case_updates.items() if k in CASE_FIELDS}

            # Auto-compute case_due_date and SLA when receive date changes
            if safe_case:
                from datetime import date as _date, timedelta as _td
                receive_dt = safe_case.get('case_receive_date')
                if receive_dt:
                    if isinstance(receive_dt, str) and receive_dt:
                        try:
                            receive_dt = _date.fromisoformat(receive_dt)
                        except ValueError:
                            receive_dt = None
                    if receive_dt:
                        safe_case['case_due_date'] = receive_dt + _td(days=30)
                        safe_case['sla'] = 'AT' if _date.today() > safe_case['case_due_date'] else 'WT'
                # Also recompute SLA if only due_date is being written
                due_dt = safe_case.get('case_due_date')
                if due_dt and 'sla' not in safe_case:
                    if isinstance(due_dt, str) and due_dt:
                        try:
                            due_dt = _date.fromisoformat(due_dt)
                        except ValueError:
                            due_dt = None
                    if due_dt:
                        safe_case['sla'] = 'AT' if _date.today() > due_dt else 'WT'

            if safe_case:
                set_clause = ', '.join(f'{k} = %s' for k in safe_case)
                vals = list(safe_case.values()) + [case_id]
                cursor.execute(
                    f"UPDATE cases SET {set_clause}, updated_at = NOW() WHERE id = %s",
                    vals
                )

            # ── Update check table ────────────────────────────────────────
            allowed_check_fields = CHECK_FIELDS.get(table, set())
            safe_check = {k: v for k, v in check_updates.items() if k in allowed_check_fields}
            # Serialize JSONB fields
            for jf in _JSONB_FIELDS:
                if jf in safe_check and not isinstance(safe_check[jf], str):
                    safe_check[jf] = _json.dumps(safe_check[jf])
            if safe_check:
                # Check if row exists
                cursor.execute(f"SELECT id FROM {table} WHERE case_id = %s", [case_id])
                existing = cursor.fetchone()
                if existing:
                    set_clause2 = ', '.join(f'{k} = %s' for k in safe_check)
                    vals2 = list(safe_check.values()) + [case_id]
                    cursor.execute(
                        f"UPDATE {table} SET {set_clause2}, updated_at = NOW() WHERE case_id = %s",
                        vals2
                    )
                    check_row_id = existing[0]
                else:
                    raise HttpError(404, f"No {check_type} check found for case {case_id}")

                # If address changed, re-geocode in background
                addr_col = {
                    'claimant_checks': 'claimant_address',
                    'insured_checks':  'insured_address',
                    'driver_checks':   'driver_address',
                    'spot_checks':     'place_of_accident',
                    'chargesheets':    'court_name',
                    'rto_checks':      'rto_address',
                }.get(table)
                lat_col = {'claimant_checks': 'claimant_lat', 'insured_checks': 'insured_lat', 'driver_checks': 'driver_lat', 'spot_checks': 'spot_lat', 'chargesheets': 'chargesheet_lat', 'rto_checks': 'rto_lat'}.get(table)
                lng_col = {'claimant_checks': 'claimant_lng', 'insured_checks': 'insured_lng', 'driver_checks': 'driver_lng', 'spot_checks': 'spot_lng', 'chargesheets': 'chargesheet_lng', 'rto_checks': 'rto_lng'}.get(table)
                if addr_col and lat_col and addr_col in safe_check:
                    new_addr = safe_check[addr_col]
                    if table == 'spot_checks' and 'district' in safe_check:
                        new_addr = f"{safe_check.get('place_of_accident','')}, {safe_check.get('district','')}"
                    elif table == 'chargesheets':
                        new_addr = ', '.join(filter(None, [safe_check.get('court_name',''), safe_check.get('city','')]))
                    if new_addr and new_addr.strip():
                        try:
                            from users.incident_case_db import _geocode_and_update
                            _geocode_and_update(table, check_row_id, lat_col, lng_col, new_addr)
                        except Exception:
                            pass

            return {"success": True, "message": "Updated successfully"}

    except HttpError:
        raise
    except Exception as exc:
        logger.error(f"update_check_detail failed for case={case_id} type={check_type}: {exc}")
        raise HttpError(500, str(exc))


# ---------------------------------------------------------------------------
# ASSIGN VENDOR TO SUB-CHECK
# ---------------------------------------------------------------------------

@router.post(
    "/cases/incident-db/{case_id}/check/{check_type}/assign-vendor",
    summary="Assign Vendor to Sub-Check",
    description="Assign a vendor to a specific sub-check row.",
)
def assign_vendor_to_check(request: HttpRequest, case_id: int, check_type: str):
    """Assign a vendor to a sub-check in the appropriate check table."""
    import json as _json

    if not is_admin_or_super_admin(request.user):
        raise HttpError(403, "Admin access required")

    table = _CHECK_TABLE_MAP.get(check_type.lower())
    if not table:
        raise HttpError(400, f"Unknown check type '{check_type}'. Valid: claimant, insured, driver, spot, chargesheet, rti, rto")

    try:
        payload = _json.loads(request.body or b'{}')
    except _json.JSONDecodeError:
        raise HttpError(400, "Invalid JSON body")

    vendor_id = payload.get("vendor_id")
    if vendor_id is None:
        raise HttpError(400, "vendor_id is required")

    try:
        with connections['default'].cursor() as cursor:
            # Verify the check row exists
            cursor.execute(f"SELECT id FROM {table} WHERE case_id = %s", [case_id])
            check_row = cursor.fetchone()
            if not check_row:
                raise HttpError(404, f"No {check_type} check found for case {case_id}")

            if vendor_id:
                # Verify vendor exists
                cursor.execute("SELECT id, company_name FROM users_vendor WHERE id = %s", [vendor_id])
                vendor = cursor.fetchone()
                if not vendor:
                    raise HttpError(404, f"Vendor id={vendor_id} not found")
                vendor_name = vendor[1]
            else:
                vendor_name = None

            # Update the check table
            cursor.execute(
                f"UPDATE {table} SET assigned_vendor_id = %s, updated_at = NOW() WHERE case_id = %s",
                [vendor_id if vendor_id else None, case_id]
            )

            return {
                "success": True,
                "message": f"Vendor {'assigned' if vendor_id else 'unassigned'} successfully",
                "assigned_vendor_id": vendor_id,
                "assigned_vendor_name": vendor_name,
            }

    except HttpError:
        raise
    except Exception as exc:
        logger.error(f"assign_vendor_to_check failed for case={case_id} type={check_type}: {exc}")
        raise HttpError(500, str(exc))


@router.get(
    "/cases/{case_id}",
    response=CaseSchema,
    summary="Get Case Details",
    description="Retrieve detailed information about a specific case.",
)
def get_case(request: HttpRequest, case_id: int):
    """Get case details by ID."""
    if not is_admin_or_super_admin(request.user):
        return 403, {"error": "Admin access required"}
    
    try:
        with connection.cursor() as cursor:
            cursor.execute("""
                SELECT 
                    ic.*,
                    v.company_name as assigned_vendor
                FROM insurance_case ic
                LEFT JOIN users_vendor v ON ic.vendor_id = v.id
                WHERE ic.id = %s
            """, [case_id])
            result = dict_fetchall(cursor)
            
            if not result:
                return 404, {"error": "Case not found"}
            
            return result[0]
    
    except Exception as e:
        logger.error(f"Failed to fetch case {case_id}: {e}")
        return 500, {"error": "Failed to fetch case"}


@router.post(
    "/cases",
    response={200: CaseCreatedResponse, 403: ErrorResponse, 400: ErrorResponse},
    summary="Create New Case",
    description="Create a new case in the system.",
)
def create_case(request: HttpRequest, payload: CreateCaseSchema):
    """Create a new case."""
    if not is_admin_or_super_admin(request.user):
        return 403, {"error": "Admin access required"}
    
    try:
        from users.models import InsuranceCase
        from users.incident_case_db import insert_case
        import uuid
        import re
        from datetime import datetime as dt

        # ── Duplicate claim_number guard ─────────────────────────────────────
        # The cases table has a UNIQUE constraint on claim_number.  Check first
        # so we can return a helpful error instead of a silent failure.
        if payload.claim_number:
            with connections['default'].cursor() as _chk:
                _chk.execute(
                    "SELECT id FROM cases WHERE claim_number = %s LIMIT 1",
                    [payload.claim_number],
                )
                existing = _chk.fetchone()
            if existing:
                return 400, {
                    "error": f"A case with claim number '{payload.claim_number}' already exists "
                             f"(cases table id={existing[0]}). "
                             "Please use a unique claim number.",
                    "detail": "duplicate_claim_number",
                }
        
        # ── Generate case number: <client-code>-<serial>-SS-<year> ───────────
        # Extract client_code from client_name (format: "Name – Code")
        client_code = payload.client_code or ''
        if not client_code and payload.client_name:
            # client_name may be "Company Name – CODE" (en dash) or "Company Name - CODE"
            match = re.search(r'[\u2013\-]\s*([A-Za-z0-9]+)\s*$', payload.client_name)
            if match:
                client_code = match.group(1).upper()

        # Determine year from case_receive_date or current year
        case_year = dt.now().year
        if payload.case_receive_date:
            try:
                case_year = dt.strptime(payload.case_receive_date, '%Y-%m-%d').year
            except ValueError:
                pass

        # Get next serial number for this client_code + year combination
        prefix = f"{client_code}-" if client_code else "GEN-"
        suffix = f"-SS-{case_year}"
        with connections['default'].cursor() as _seq:
            _seq.execute(
                "SELECT case_number FROM cases WHERE case_number LIKE %s ORDER BY case_number DESC LIMIT 1",
                [f"{prefix}%{suffix}"],
            )
            last_row = _seq.fetchone()
        serial = 1
        if last_row and last_row[0]:
            # Extract serial from e.g. "R001-5-SS-2026"
            m = re.search(r'^' + re.escape(prefix) + r'(\d+)' + re.escape(suffix) + r'$', last_row[0])
            if m:
                serial = int(m.group(1)) + 1

        case_number = f"{prefix}{serial:04d}{suffix}"
        
        # Auto-generate title from claim_number + client_name if not provided
        title = payload.title or f"Case {payload.claim_number} - {payload.client_name or 'New Case'}"
        
        # Format address from components
        addr_parts = [p for p in [payload.incident_address, payload.incident_city, payload.incident_state, payload.incident_postal_code, payload.incident_country] if p]
        formatted_address = ", ".join(addr_parts) if addr_parts else ''
        
        # Parse date fields (ISO string -> date object)
        case_receive_date = None
        if payload.case_receive_date:
            case_receive_date = dt.strptime(payload.case_receive_date, '%Y-%m-%d').date()
        
        completion_date_val = None
        if payload.completion_date:
            completion_date_val = dt.strptime(payload.completion_date, '%Y-%m-%d').date()
        
        case_due_date_val = None
        if payload.case_due_date:
            case_due_date_val = dt.strptime(payload.case_due_date, '%Y-%m-%d').date()
        
        # Auto-compute receive_month from case_receive_date
        receive_month = payload.receive_month
        if not receive_month and case_receive_date:
            receive_month = case_receive_date.strftime('%B %Y')
        
        # Auto-compute completion_month from completion_date
        completion_month = payload.completion_month
        if not completion_month and completion_date_val:
            completion_month = completion_date_val.strftime('%B %Y')
        
        # Auto-compute TAT if dates available and not manually set
        tat_days = payload.tat_days
        if tat_days is None and case_receive_date and completion_date_val:
            tat_days = (completion_date_val - case_receive_date).days

        # Auto-compute case_due_date = receive_date + 30 days
        if not case_due_date_val and case_receive_date:
            from datetime import timedelta
            case_due_date_val = case_receive_date + timedelta(days=30)

        # Auto-compute SLA: AT (Above TAT) if past due date, else WT (Within TAT)
        from datetime import date as _date
        sla_status = payload.sla_status
        if case_due_date_val:
            sla_status = 'AT' if _date.today() > case_due_date_val else 'WT'

        # ── PRIMARY write: incident_case_db.cases ────────────────────────────
        # This is the table the Cases page reads from. Write here first so the
        # UI is always in sync.  Any failure here aborts the whole request.
        incident_case_db_id = insert_case(
            claim_number=payload.claim_number,
            client_name=payload.client_name,
            category=payload.category,
            case_receive_date=case_receive_date,
            receive_month=receive_month or '',
            completion_date=completion_date_val,
            completion_month=completion_month or '',
            case_due_date=case_due_date_val,
            tat_days=tat_days,
            sla=sla_status,           # maps to `sla` column
            case_type=payload.case_type,
            investigation_report_status=payload.investigation_report_status,
            full_case_status=payload.full_case_status,
            scope_of_work=payload.scope_of_work,
            case_number=case_number,
        )
        logger.info(f"[incident_case_db] case inserted id={incident_case_db_id} claim={payload.claim_number}")

        # ── SECONDARY write: Django ORM InsuranceCase ─────────────────────────
        # Kept for admin/ORM compatibility. Non-fatal if it fails.
        orm_case_id = None
        try:
            case = InsuranceCase.objects.create(
                case_number=case_number,
                title=title,
                description=payload.description,
                category=payload.category,
                priority=payload.priority,
                status=payload.status,
                # Common fields
                claim_number=payload.claim_number,
                client_name=payload.client_name,
                client_code=payload.client_code,
                case_receive_date=case_receive_date,
                receive_month=receive_month,
                completion_date=completion_date_val,
                completion_month=completion_month,
                case_due_date=case_due_date_val,
                tat_days=tat_days,
                sla_status=sla_status,
                case_type=payload.case_type,
                investigation_report_status=payload.investigation_report_status,
                full_case_status=payload.full_case_status,
                scope_of_work=payload.scope_of_work,
                # People
                insured_name=payload.insured_name,
                claimant_name=payload.claimant_name,
                # Location
                incident_address=payload.incident_address,
                incident_city=payload.incident_city,
                incident_state=payload.incident_state,
                incident_postal_code=payload.incident_postal_code,
                incident_country=payload.incident_country,
                latitude=payload.latitude,
                longitude=payload.longitude,
                formatted_address=formatted_address,
                # Assignment
                created_by=request.user,
                client_id=payload.client_id,
                vendor_id=payload.vendor_id,
                source=payload.source,
                workflow_type=payload.workflow_type,
                investigation_progress=0,
                # Checklist
                chk_spot=payload.chk_spot,
                chk_hospital=payload.chk_hospital,
                chk_claimant=payload.chk_claimant,
                chk_insured=payload.chk_insured,
                chk_witness=payload.chk_witness,
                chk_driver=payload.chk_driver,
                chk_dl=payload.chk_dl,
                chk_rc=payload.chk_rc,
                chk_permit=payload.chk_permit,
                chk_court=payload.chk_court,
                chk_notice=payload.chk_notice,
                chk_134_notice=payload.chk_134_notice,
                chk_rti=payload.chk_rti,
                chk_medical_verification=payload.chk_medical_verification,
                chk_income=payload.chk_income,
            )
            orm_case_id = case.id
            logger.info(f"[ORM] InsuranceCase created case_number={case_number} id={orm_case_id}")
        except Exception as orm_err:
            logger.error(f"[ORM] InsuranceCase.objects.create() failed (non-fatal): {orm_err}")
            orm_case_id = incident_case_db_id   # fallback so frontend gets a valid id
        
        return 200, {
            "id": orm_case_id or incident_case_db_id,
            "case_number": case_number,
            "title": title,
            "message": "Case created successfully",
            "incident_case_db_id": incident_case_db_id,
        }
    
    except Exception as e:
        logger.error(f"Failed to create case: {e}")
        import traceback
        logger.error(traceback.format_exc())
        return 400, {"error": "Failed to create case", "detail": str(e)}


@router.get(
    "/dashboard/stats",
    response=CaseStatsSchema,
    summary="Get Dashboard Statistics",
    description="Get case statistics for the dashboard.",
)
def get_dashboard_stats(request: HttpRequest):
    """Get dashboard statistics - counts from incident_case_db.cases (source of truth)."""
    if not is_admin_or_super_admin(request.user):
        return {
            "total_cases": 0,
            "active_investigations": 0,
            "completed_cases": 0,
            "overdue_cases": 0,
        }
    
    try:
        with connections['default'].cursor() as cursor:
            # Total cases — the single authoritative count
            cursor.execute("SELECT COUNT(*) FROM cases")
            total_cases = cursor.fetchone()[0]
            
            # Active investigations: WIP status
            cursor.execute("SELECT COUNT(*) FROM cases WHERE full_case_status = 'WIP'")
            active_investigations = cursor.fetchone()[0]
            
            # Completed cases
            cursor.execute("SELECT COUNT(*) FROM cases WHERE full_case_status = 'Completed'")
            completed_cases = cursor.fetchone()[0]
            
            # Overdue: past due date and not completed/withdrawn
            cursor.execute(
                "SELECT COUNT(*) FROM cases "
                "WHERE case_due_date < CURRENT_DATE "
                "AND full_case_status NOT IN ('Completed', 'Withdraw', 'Portal Upload')"
            )
            overdue_cases = cursor.fetchone()[0]
            
            # Pending / stuck cases
            cursor.execute(
                "SELECT COUNT(*) FROM cases "
                "WHERE full_case_status IN ('Pending CS', 'Pending Additional Docs', 'NI', 'RCU Pending')"
            )
            pending_cases = cursor.fetchone()[0]
            
            return {
                "total_cases": total_cases,
                "active_investigations": active_investigations,
                "completed_cases": completed_cases,
                "overdue_cases": overdue_cases,
                "pending_cases": pending_cases,
            }
    
    except Exception as e:
        logger.error(f"Failed to fetch dashboard stats: {e}")
        return {
            "total_cases": 0,
            "active_investigations": 0,
            "completed_cases": 0,
            "overdue_cases": 0,
            "pending_cases": 0,
        }


@router.get(
    "/dashboard/case-volume",
    response=List[CaseVolumeSchema],
    summary="Get Case Volume Data",
    description="Get case volume trend data for charts.",
)
def get_case_volume(request: HttpRequest):
    """Get case volume data for the last 6 months."""
    if not is_admin_or_super_admin(request.user):
        return []
    
    try:
        with connection.cursor() as cursor:
            # Get case counts per month for the last 6 months
            cursor.execute("""
                SELECT 
                    TO_CHAR(DATE_TRUNC('month', created_at), 'Mon') as month,
                    COUNT(*) as total,
                    COUNT(CASE WHEN status IN ('RESOLVED', 'CLOSED') THEN 1 END) as completed
                FROM insurance_case
                WHERE created_at >= NOW() - INTERVAL '6 months'
                GROUP BY DATE_TRUNC('month', created_at)
                ORDER BY DATE_TRUNC('month', created_at)
            """)
            
            results = dict_fetchall(cursor)
            
            # If no data, return dummy data for last 6 months
            if not results:
                from datetime import timedelta
                from calendar import month_abbr
                
                now = datetime.now()
                months = []
                for i in range(5, -1, -1):
                    # Calculate month offset
                    month_offset = now.month - i - 1
                    year_offset = now.year
                    if month_offset <= 0:
                        month_offset += 12
                        year_offset -= 1
                    
                    month_name = month_abbr[month_offset]
                    months.append({
                        "month": month_name,
                        "total": 0,
                        "completed": 0
                    })
                return months
            
            return results
    
    except Exception as e:
        logger.error(f"Failed to fetch case volume: {e}")
        return []


@router.get(
    "/dashboard/case-status",
    response=List[CaseStatusCountSchema],
    summary="Get Case Status Distribution",
    description="Get case counts by status for pie chart.",
)
def get_case_status_distribution(request: HttpRequest):
    """Get case status distribution."""
    if not is_admin_or_super_admin(request.user):
        return []
    
    try:
        with connection.cursor() as cursor:
            cursor.execute("""
                SELECT 
                    CASE status
                        WHEN 'OPEN' THEN 'New'
                        WHEN 'IN_PROGRESS' THEN 'In Progress'
                        WHEN 'PENDING' THEN 'Under Review'
                        WHEN 'RESOLVED' THEN 'Completed'
                        WHEN 'CLOSED' THEN 'Closed'
                        ELSE status
                    END as label,
                    COUNT(*) as count
                FROM insurance_case
                GROUP BY status
                ORDER BY count DESC
            """)
            
            results = dict_fetchall(cursor)
            return results if results else []
    
    except Exception as e:
        logger.error(f"Failed to fetch case status distribution: {e}")
        return []


@router.get(
    "/dashboard/recent-activity",
    response=List[RecentActivitySchema],
    summary="Get Recent Activity",
    description="Get recent case activities.",
)
def get_recent_activity(request: HttpRequest):
    """Get recent activity from cases."""
    if not is_admin_or_super_admin(request.user):
        return []
    
    try:
        with connection.cursor() as cursor:
            # Get most recent cases
            cursor.execute("""
                SELECT 
                    case_number,
                    title,
                    status,
                    created_at,
                    updated_at
                FROM insurance_case
                ORDER BY updated_at DESC
                LIMIT 10
            """)
            
            results = dict_fetchall(cursor)
            
            activities = []
            for case in results:
                from datetime import datetime, timezone
                
                # Calculate time ago
                updated_at = case['updated_at']
                if not updated_at.tzinfo:
                    updated_at = updated_at.replace(tzinfo=timezone.utc)
                now = datetime.now(timezone.utc)
                diff = now - updated_at
                
                if diff.days > 0:
                    time_ago = f"{diff.days} day{'s' if diff.days > 1 else ''} ago"
                elif diff.seconds >= 3600:
                    hours = diff.seconds // 3600
                    time_ago = f"{hours} hour{'s' if hours > 1 else ''} ago"
                elif diff.seconds >= 60:
                    minutes = diff.seconds // 60
                    time_ago = f"{minutes} min ago"
                else:
                    time_ago = "just now"
                
                # Determine activity type and text
                activity_type = "status_change"
                text = f"Case {case['case_number']} - {case['title']}"
                
                activities.append({
                    "type": activity_type,
                    "text": text,
                    "time": time_ago
                })
            
            return activities
    
    except Exception as e:
        logger.error(f"Failed to fetch recent activity: {e}")
        return []


@router.get(
    "/audit-logs",
    response=List[AuditLogEntrySchema],
    summary="Get Audit Logs",
    description="Get project-wide audit activity logs (case creation, assignments, AI report generation).",
)
def get_audit_logs(
    request: HttpRequest,
    event_type: Optional[str] = None,
    actor: Optional[str] = None,
    date_range: str = "all",
    search: Optional[str] = None,
    limit: int = 500,
):
    """Get aggregated audit logs for admin portal."""
    if not is_admin_or_super_admin(request.user):
        return []

    safe_limit = max(1, min(int(limit or 500), 2000))
    activities: List[dict] = []
    ninety_day_cutoff = timezone.now() - timedelta(days=90)

    def _normalize_event_time(event_time_value):
        """Normalize timestamp values to timezone-aware datetimes for safe sorting."""
        if not event_time_value:
            return None

        parsed = event_time_value
        if isinstance(event_time_value, str):
            iso_value = event_time_value.replace("Z", "+00:00")
            try:
                parsed = datetime.fromisoformat(iso_value)
            except ValueError:
                return None

        if not isinstance(parsed, datetime):
            return None

        if timezone.is_naive(parsed):
            parsed = timezone.make_aware(parsed, timezone.get_current_timezone())

        return parsed

    def _add_event(event_time, event_type_value, actor_value, description, case_number="", source="System"):
        normalized_event_time = _normalize_event_time(event_time)
        if not normalized_event_time:
            return
        if normalized_event_time < ninety_day_cutoff:
            return
        activities.append(
            {
                "event_time": normalized_event_time,
                "event_type": event_type_value,
                "actor": actor_value or "System",
                "description": description,
                "case_number": case_number or None,
                "source": source,
            }
        )

    try:
        with connections['default'].cursor() as cursor:
            # Case creation events
            cursor.execute(
                """
                SELECT
                    ic.case_number,
                    ic.created_at,
                    COALESCE(NULLIF(TRIM(CONCAT(cu.first_name, ' ', cu.last_name)), ''), cu.username, 'System') AS actor_name
                FROM insurance_case ic
                LEFT JOIN users_customuser cu ON cu.id = ic.created_by_id
                WHERE ic.created_at IS NOT NULL
                ORDER BY ic.created_at DESC
                LIMIT %s
                """,
                [safe_limit],
            )
            for case_number, created_at, actor_name in cursor.fetchall():
                _add_event(
                    created_at,
                    "CASE_CREATED",
                    actor_name,
                    f"Case {case_number} created",
                    case_number,
                    "Cases",
                )

            # Vendor assignment events from check tables
            assignment_tables = [
                ("claimant_checks", "Claimant Check"),
                ("insured_checks", "Insured Check"),
                ("driver_checks", "Driver Check"),
                ("spot_checks", "Spot Check"),
                ("chargesheets", "Chargesheet"),
                ("rti_checks", "RTI Check"),
                ("rto_checks", "RTO Check"),
            ]

            for table_name, check_label in assignment_tables:
                if not _column_exists(table_name, "assigned_vendor_id"):
                    continue

                if _column_exists(table_name, "updated_at"):
                    event_time_column = "updated_at"
                elif _column_exists(table_name, "created_at"):
                    event_time_column = "created_at"
                else:
                    continue

                try:
                    cursor.execute(
                        f"""
                        SELECT
                            c.case_number,
                            t.{event_time_column} AS event_time,
                            uv.company_name
                        FROM {table_name} t
                        JOIN cases c ON c.id = t.case_id
                        JOIN users_vendor uv ON uv.id = t.assigned_vendor_id
                        WHERE t.assigned_vendor_id IS NOT NULL
                          AND t.{event_time_column} IS NOT NULL
                        ORDER BY t.{event_time_column} DESC
                        LIMIT %s
                        """,
                        [safe_limit],
                    )

                    for case_number, event_time, vendor_name in cursor.fetchall():
                        _add_event(
                            event_time,
                            "VENDOR_ASSIGNED",
                            "Admin/System",
                            f"Vendor '{vendor_name}' assigned to {check_label}",
                            case_number,
                            "Vendor Assignment",
                        )
                except Exception as table_exc:
                    logger.warning(f"Skipping vendor assignment logs for table {table_name}: {table_exc}")

            # Lawyer assignment events
            cursor.execute(
                """
                SELECT
                    ic.case_number,
                    r.assigned_at,
                    COALESCE(NULLIF(TRIM(CONCAT(lu.first_name, ' ', lu.last_name)), ''), lu.username, 'Lawyer') AS lawyer_name
                FROM reports r
                JOIN insurance_case ic ON ic.id = r.case_id
                LEFT JOIN users_customuser lu ON lu.id = r.assigned_lawyer_id
                WHERE r.assigned_at IS NOT NULL
                ORDER BY r.assigned_at DESC
                LIMIT %s
                """,
                [safe_limit],
            )
            for case_number, assigned_at, lawyer_name in cursor.fetchall():
                _add_event(
                    assigned_at,
                    "LAWYER_ASSIGNED",
                    "Admin/System",
                    f"Report assigned to lawyer '{lawyer_name}'",
                    case_number,
                    "Legal Review",
                )

            # AI report generation events
            cursor.execute(
                """
                SELECT
                    ic.case_number,
                    r.created_at,
                    COALESCE(NULLIF(TRIM(CONCAT(cu.first_name, ' ', cu.last_name)), ''), cu.username, 'System') AS actor_name
                FROM reports r
                JOIN insurance_case ic ON ic.id = r.case_id
                LEFT JOIN users_customuser cu ON cu.id = r.created_by_id
                WHERE r.created_at IS NOT NULL
                ORDER BY r.created_at DESC
                LIMIT %s
                """,
                [safe_limit],
            )
            for case_number, created_at, actor_name in cursor.fetchall():
                _add_event(
                    created_at,
                    "AI_REPORT_GENERATED",
                    actor_name,
                    f"AI brief report generated for case {case_number}",
                    case_number,
                    "Reports",
                )

            # Lawyer review decision events (accept/reject)
            cursor.execute(
                """
                SELECT
                    ic.case_number,
                    r.reviewed_at,
                    r.status,
                    COALESCE(NULLIF(TRIM(CONCAT(lu.first_name, ' ', lu.last_name)), ''), lu.username, 'Lawyer') AS lawyer_name
                FROM reports r
                JOIN insurance_case ic ON ic.id = r.case_id
                LEFT JOIN users_customuser lu ON lu.id = r.assigned_lawyer_id
                WHERE r.reviewed_at IS NOT NULL
                  AND r.status IN ('ACCEPTED', 'REJECTED')
                ORDER BY r.reviewed_at DESC
                LIMIT %s
                """,
                [safe_limit],
            )
            for case_number, reviewed_at, review_status, lawyer_name in cursor.fetchall():
                status_upper = str(review_status or "").upper()
                is_accepted = status_upper == "ACCEPTED"
                _add_event(
                    reviewed_at,
                    "LAWYER_ACCEPTED_REPORT" if is_accepted else "LAWYER_REJECTED_REPORT",
                    lawyer_name,
                    f"Lawyer '{lawyer_name}' {'approved' if is_accepted else 'rejected'} report for case {case_number}",
                    case_number,
                    "Legal Review",
                )

        # Sort latest first globally
        activities.sort(key=lambda item: item["event_time"], reverse=True)

        # Apply optional filters
        if event_type and event_type.lower() != "all":
            activities = [
                item for item in activities
                if item["event_type"].lower() == event_type.lower()
            ]

        if actor and actor.lower() != "all":
            actor_query = actor.lower()
            activities = [
                item for item in activities
                if actor_query in (item.get("actor") or "").lower()
            ]

        if search:
            term = search.lower()
            activities = [
                item for item in activities
                if term in (item.get("description") or "").lower()
                or term in (item.get("case_number") or "").lower()
                or term in (item.get("actor") or "").lower()
            ]

        if date_range and date_range.lower() != "all":
            now_date = timezone.now().date()
            if date_range.lower() == "today":
                min_date = now_date
            elif date_range.lower() == "week":
                min_date = now_date - timedelta(days=7)
            elif date_range.lower() == "month":
                min_date = now_date - timedelta(days=30)
            else:
                min_date = None

            if min_date:
                activities = [
                    item for item in activities
                    if item["event_time"].date() >= min_date
                ]

        return activities[:safe_limit]

    except Exception as e:
        logger.error(f"Failed to fetch audit logs: {e}")
        return []


# =============================================================================
# Auto-Assign Vendor Logic
# =============================================================================

def calculate_distance(lat1, lon1, lat2, lon2):
    """
    Calculate distance between two coordinates using Haversine formula.
    Returns distance in kilometers.
    Uses OpenStreetMap coordinate system (WGS84).
    """
    from math import radians, cos, sin, asin, sqrt
    
    # Convert decimal degrees to radians
    lon1, lat1, lon2, lat2 = map(radians, [lon1, lat1, lon2, lat2])
    
    # Haversine formula
    dlon = lon2 - lon1
    dlat = lat2 - lat1
    a = sin(dlat/2)**2 + cos(lat1) * cos(lat2) * sin(dlon/2)**2
    c = 2 * asin(sqrt(a))
    r = 6371  # Radius of earth in kilometers
    
    return c * r


class AutoAssignResponseSchema(Schema):
    """Response schema for auto-assign endpoint."""
    success: bool
    message: str
    assigned_vendor: Optional[dict] = None
    error: Optional[str] = None


@router.post(
    "/cases/{case_id}/auto-assign-vendor",
    response=AutoAssignResponseSchema,
    summary="Auto-Assign Case to Closest Vendor",
    description="Automatically assign a case to the vendor with the closest location.",
)
def auto_assign_vendor(request: HttpRequest, case_id: int):
    """
    Auto-assign a case to the closest vendor based on location.
    Uses OpenStreetMap coordinates and Haversine distance calculation.
    """
    if not is_admin_or_super_admin(request.user):
        return {
            "success": False,
            "error": "Admin access required",
            "message": "Only admin users can assign vendors."
        }
    
    try:
        from users.models import Vendor
        
        with connection.cursor() as cursor:
            # Get case details
            cursor.execute("""
                SELECT id, case_number, title, latitude, longitude, vendor_id
                FROM insurance_case 
                WHERE id = %s
            """, [case_id])
            
            case = cursor.fetchone()
            
            if not case:
                return {
                    "success": False,
                    "error": "Case not found",
                    "message": "The specified case does not exist."
                }
            
            case_id, case_number, case_title, case_lat, case_lon, assigned_vendor_id = case
            
            # Check if case already has assigned vendor
            if assigned_vendor_id:
                return {
                    "success": False,
                    "error": "Case already assigned",
                    "message": "This case is already assigned to a vendor."
                }
            
            # Check if case has coordinates
            if not case_lat or not case_lon:
                return {
                    "success": False,
                    "error": "Missing coordinates",
                    "message": "Case does not have valid location coordinates."
                }
            
            # Get all active vendors with locations
            vendors = Vendor.objects.filter(
                is_active=True,
                latitude__isnull=False,
                longitude__isnull=False
            ).values('id', 'company_name', 'latitude', 'longitude', 'city', 'state')
            
            if not vendors.exists():
                return {
                    "success": False,
                    "error": "No vendors available",
                    "message": "No active vendors with location data are available."
                }
            
            # Calculate distances and find closest vendor
            closest_vendor = None
            min_distance = float('inf')
            
            for vendor in vendors:
                distance = calculate_distance(
                    float(case_lat),
                    float(case_lon),
                    float(vendor['latitude']),
                    float(vendor['longitude'])
                )
                
                if distance < min_distance:
                    min_distance = distance
                    closest_vendor = vendor
            
            if not closest_vendor:
                return {
                    "success": False,
                    "error": "No vendor found",
                    "message": "Could not find a suitable vendor for assignment."
                }
            
            # Update case with assigned vendor
            cursor.execute("""
                UPDATE insurance_case 
                SET vendor_id = %s 
                WHERE id = %s
            """, [closest_vendor['id'], case_id])
            
            return {
                "success": True,
                "message": f"Case #{case_number} assigned to {closest_vendor['company_name']}",
                "assigned_vendor": {
                    "id": closest_vendor['id'],
                    "company_name": closest_vendor['company_name'],
                    "distance_km": round(min_distance, 2),
                    "city": closest_vendor['city'],
                    "state": closest_vendor['state'],
                }
            }
    
    except Exception as e:
        logger.error(f"Failed to auto-assign vendor for case {case_id}: {e}")
        return {
            "success": False,
            "error": "Assignment failed",
            "message": f"An error occurred while assigning the vendor: {str(e)}"
        }


# =============================================================================
# Client & Vendor List Endpoints
# =============================================================================

@router.get(
    "/clients",
    response=List[ClientSchema],
    summary="Get Clients",
    description="Get list of all active clients for dropdown selection."
)
def list_clients(request):
    """Get list of all active clients."""
    from users.models import Client
    
    clients = Client.objects.filter(is_active=True).order_by('client_name')
    
    return [
        ClientSchema(
            id=client.id,
            client_code=client.client_code,
            client_name=client.client_name,
            location=client.location or ''
        )
        for client in clients
    ]


@router.get(
    "/clients/all",
    response=List[ClientDetailSchema],
    summary="Get All Clients (Admin)",
    description="Get list of all clients with full details for admin management."
)
def list_all_clients(request):
    """Get all clients for admin management."""
    if not is_admin_or_super_admin(request.user):
        raise HttpError(403, "Admin access required")

    from users.models import Client

    clients = Client.objects.all().order_by('client_name')
    result = []
    for c in clients:
        result.append(ClientDetailSchema(
            id=c.id,
            client_code=c.client_code,
            client_name=c.client_name,
            location=c.location or '',
            date_of_commencement=c.date_of_commencement.isoformat() if c.date_of_commencement else None,
            insured_rate=float(c.insured_rate) if c.insured_rate else None,
            notice_134_rate=float(c.notice_134_rate) if c.notice_134_rate else None,
            claimant_rate=float(c.claimant_rate) if c.claimant_rate else None,
            income_rate=float(c.income_rate) if c.income_rate else None,
            driver_rate=float(c.driver_rate) if c.driver_rate else None,
            dl_rate=float(c.dl_rate) if c.dl_rate else None,
            rc_rate=float(c.rc_rate) if c.rc_rate else None,
            permit_rate=float(c.permit_rate) if c.permit_rate else None,
            spot_rate=float(c.spot_rate) if c.spot_rate else None,
            court_rate=float(c.court_rate) if c.court_rate else None,
            notice_rate=float(c.notice_rate) if c.notice_rate else None,
            rti_rate=float(c.rti_rate) if c.rti_rate else None,
            hospital_rate=float(c.hospital_rate) if c.hospital_rate else None,
            is_active=c.is_active,
            created_at=c.created_at,
            updated_at=c.updated_at,
        ))
    return result


@router.post(
    "/clients",
    summary="Create Client",
    description="Create a new client. Admin access required."
)
def create_client(request: HttpRequest, payload: CreateClientSchema):
    """Create a new client."""
    if not is_admin_or_super_admin(request.user):
        raise HttpError(403, "Admin access required")

    from users.models import Client
    from datetime import datetime as _dt

    # Check for duplicate client_code
    if Client.objects.filter(client_code=payload.client_code).exists():
        raise HttpError(400, f"Client with code '{payload.client_code}' already exists.")

    date_val = None
    if payload.date_of_commencement:
        try:
            date_val = _dt.strptime(payload.date_of_commencement, '%Y-%m-%d').date()
        except ValueError:
            raise HttpError(400, "Invalid date format. Use YYYY-MM-DD.")

    client = Client.objects.create(
        client_code=payload.client_code,
        client_name=payload.client_name,
        location=payload.location,
        date_of_commencement=date_val,
        insured_rate=payload.insured_rate,
        notice_134_rate=payload.notice_134_rate,
        claimant_rate=payload.claimant_rate,
        income_rate=payload.income_rate,
        driver_rate=payload.driver_rate,
        dl_rate=payload.dl_rate,
        rc_rate=payload.rc_rate,
        permit_rate=payload.permit_rate,
        spot_rate=payload.spot_rate,
        court_rate=payload.court_rate,
        notice_rate=payload.notice_rate,
        rti_rate=payload.rti_rate,
        hospital_rate=payload.hospital_rate,
        is_active=payload.is_active,
    )
    return {"success": True, "message": "Client created successfully", "id": client.id}


@router.put(
    "/clients/{client_id}",
    summary="Update Client",
    description="Update an existing client. Admin access required."
)
def update_client(request: HttpRequest, client_id: int, payload: CreateClientSchema):
    """Update a client."""
    if not is_admin_or_super_admin(request.user):
        raise HttpError(403, "Admin access required")

    from users.models import Client
    from datetime import datetime as _dt

    try:
        client = Client.objects.get(id=client_id)
    except Client.DoesNotExist:
        raise HttpError(404, "Client not found")

    # Check for duplicate client_code (excluding current client)
    if Client.objects.filter(client_code=payload.client_code).exclude(id=client_id).exists():
        raise HttpError(400, f"Client with code '{payload.client_code}' already exists.")

    date_val = None
    if payload.date_of_commencement:
        try:
            date_val = _dt.strptime(payload.date_of_commencement, '%Y-%m-%d').date()
        except ValueError:
            raise HttpError(400, "Invalid date format. Use YYYY-MM-DD.")

    client.client_code = payload.client_code
    client.client_name = payload.client_name
    client.location = payload.location
    client.date_of_commencement = date_val
    client.insured_rate = payload.insured_rate
    client.notice_134_rate = payload.notice_134_rate
    client.claimant_rate = payload.claimant_rate
    client.income_rate = payload.income_rate
    client.driver_rate = payload.driver_rate
    client.dl_rate = payload.dl_rate
    client.rc_rate = payload.rc_rate
    client.permit_rate = payload.permit_rate
    client.spot_rate = payload.spot_rate
    client.court_rate = payload.court_rate
    client.notice_rate = payload.notice_rate
    client.rti_rate = payload.rti_rate
    client.hospital_rate = payload.hospital_rate
    client.is_active = payload.is_active
    client.save()

    return {"success": True, "message": "Client updated successfully"}


@router.delete(
    "/clients/{client_id}",
    summary="Delete Client",
    description="Delete a client. Admin access required."
)
def delete_client(request: HttpRequest, client_id: int):
    """Delete a client."""
    if not is_admin_or_super_admin(request.user):
        raise HttpError(403, "Admin access required")

    from users.models import Client

    try:
        client = Client.objects.get(id=client_id)
    except Client.DoesNotExist:
        raise HttpError(404, "Client not found")

    client.delete()
    return {"success": True, "message": "Client deleted successfully"}


@router.get(
    "/check-vendors",
    response=List[VendorSchema],
    summary="Get Vendors for Assignment",
    description="Get list of all active vendors for dropdown selection in case assignment."
)
def list_vendors_for_cases(request):
    """Get list of all active vendors."""
    from users.models import Vendor
    
    vendors = Vendor.objects.filter(is_active=True).order_by('company_name')
    
    return [
        VendorSchema(
            id=vendor.id,
            company_name=vendor.company_name,
            contact_email=vendor.contact_email,
            city=vendor.city or '',
            state=vendor.state or '',
            is_active=vendor.is_active
        )
        for vendor in vendors
    ]


# =============================================================================
# Court Details lookup endpoints
# =============================================================================

@router.get(
    "/court-details/cities",
    summary="Get all cities from court_details",
    description="Returns distinct city names for dropdowns.",
)
def get_court_cities(request: HttpRequest):
    """Return distinct cities from court_details table."""
    try:
        with connections['default'].cursor() as cursor:
            cursor.execute(
                "SELECT DISTINCT city FROM court_details WHERE city IS NOT NULL ORDER BY city"
            )
            cities = [r[0] for r in cursor.fetchall()]
        return {"cities": cities}
    except Exception as e:
        logger.error(f"Failed to fetch court cities: {e}")
        return {"cities": []}


@router.get(
    "/court-details/police-stations",
    summary="Get police stations by city",
    description="Returns police stations filtered by city.",
)
def get_police_stations(request: HttpRequest, city: str):
    """Return police stations for a given city."""
    try:
        with connections['default'].cursor() as cursor:
            cursor.execute(
                "SELECT DISTINCT jurisdiction_police_station FROM court_details "
                "WHERE city = %s AND jurisdiction_police_station IS NOT NULL "
                "ORDER BY jurisdiction_police_station",
                [city],
            )
            stations = [r[0] for r in cursor.fetchall()]
        return {"police_stations": stations}
    except Exception as e:
        logger.error(f"Failed to fetch police stations for city={city}: {e}")
        return {"police_stations": []}


@router.get(
    "/court-details/courts",
    summary="Get court names by city",
    description="Returns taluka court names filtered by city.",
)
def get_court_names(request: HttpRequest, city: str):
    """Return court names for a given city."""
    try:
        with connections['default'].cursor() as cursor:
            cursor.execute(
                "SELECT DISTINCT taluka_court FROM court_details "
                "WHERE city = %s AND taluka_court IS NOT NULL "
                "ORDER BY taluka_court",
                [city],
            )
            courts = [r[0] for r in cursor.fetchall()]
        return {"courts": courts}
    except Exception as e:
        logger.error(f"Failed to fetch courts for city={city}: {e}")
        return {"courts": []}
