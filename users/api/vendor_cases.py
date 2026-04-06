"""
Vendor cases API endpoints.
Endpoints for vendors to manage their assigned cases.
"""

import logging
import json
import os
from typing import List, Optional
from datetime import datetime
from urllib.parse import unquote, urlparse
from ninja import Router, Schema
from django.db import connection, connections
from django.http import HttpRequest
from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import UploadedFile
from django.conf import settings
from users.services.speech_statement_service import get_speech_service

logger = logging.getLogger(__name__)

User = get_user_model()
router = Router(tags=["Vendor Cases"])


# =============================================================================
# Schemas
# =============================================================================

class CaseSchema(Schema):
    """Case response schema."""
    id: int
    case_number: str
    title: str
    description: str
    status: str
    priority: str
    category: str
    claim_number: str
    claimant_name: str
    insured_name: str
    client_code: str
    incident_address: str
    incident_city: str
    incident_state: str
    incident_country: str
    incident_postal_code: str
    formatted_address: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    assigned_vendor_id: Optional[int] = None
    assigned_vendor: Optional[str] = None
    client_id: int
    created_by_id: Optional[int] = None
    created_at: datetime
    updated_at: datetime
    resolved_at: Optional[datetime] = None
    closed_at: Optional[datetime] = None
    source: str
    workflow_type: str
    investigation_progress: int


class VendorCasesListResponse(Schema):
    """Vendor cases list response."""
    cases: List[CaseSchema]
    total: int
    statistics: dict


class ApiErrorSchema(Schema):
    """Generic API error response."""
    error: str


# =============================================================================
# Helper Functions
# =============================================================================

def dict_fetchall(cursor):
    """Convert database cursor results to list of dicts."""
    columns = [col[0] for col in cursor.description]
    return [
        dict(zip(columns, row))
        for row in cursor.fetchall()
    ]


def get_vendor_id_from_user(user):
    """Get vendor ID from authenticated user."""
    if not user.is_authenticated or user.role != 'VENDOR':
        return None
    
    try:
        from users.models import Vendor
        vendor = Vendor.objects.get(user=user)
        return vendor.id
    except Exception as e:
        logger.error(f"Failed to get vendor ID for user {user.id}: {e}")
        return None


CHECK_ASSIGNMENT_TABLES = (
    'claimant_checks',
    'insured_checks',
    'driver_checks',
    'spot_checks',
    'chargesheets',
    'rti_checks',
    'rto_checks',
)


def get_vendor_assigned_case_numbers(cursor, vendor_id: int) -> List[str]:
    """Return distinct insurance case numbers that have at least one assigned sub-check."""
    union_query = " UNION ".join(
        [
            f"""
            SELECT c.case_number
            FROM {table} t
            JOIN cases c ON c.id = t.case_id
            WHERE t.assigned_vendor_id = %s
              AND c.case_number IS NOT NULL
              AND c.case_number <> ''
            """
            for table in CHECK_ASSIGNMENT_TABLES
        ]
    )

    cursor.execute(
        f"SELECT DISTINCT case_number FROM ({union_query}) assigned_cases ORDER BY case_number",
        [vendor_id] * len(CHECK_ASSIGNMENT_TABLES),
    )
    return [row[0] for row in cursor.fetchall()]


def vendor_has_case_assignment(cursor, vendor_id: int, case_number: str) -> bool:
    """Check whether a vendor has any assigned sub-check for the given case number."""
    for table in CHECK_ASSIGNMENT_TABLES:
        cursor.execute(
            f"""
            SELECT 1
            FROM {table} t
            JOIN cases c ON c.id = t.case_id
            WHERE t.assigned_vendor_id = %s
              AND c.case_number = %s
            LIMIT 1
            """,
            [vendor_id, case_number],
        )
        if cursor.fetchone():
            return True
    return False


def parse_json_list(value) -> List:
    """Parse a JSON/JSONB field into a Python list."""
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


def extract_evidence_filename(evidence_entry) -> str:
    """Extract a filename from a vendor_evidence entry."""
    if isinstance(evidence_entry, dict):
        filename = evidence_entry.get("filename") or evidence_entry.get("file_name")
        if filename:
            return str(filename)
        raw_url = evidence_entry.get("url") or evidence_entry.get("photo_url") or ""
    elif isinstance(evidence_entry, str):
        raw_url = evidence_entry
    else:
        return ""

    return os.path.basename(urlparse(str(raw_url)).path.rstrip("/"))


def media_relative_path_from_url(raw_url: str) -> Optional[str]:
    """Convert a stored media URL into a path relative to MEDIA_ROOT."""
    if not raw_url:
        return None

    path = unquote(urlparse(str(raw_url)).path).lstrip("/")
    if not path:
        return None
    if path.startswith("media/"):
        path = path[len("media/"):]
    return path or None


def build_absolute_media_url(request: HttpRequest, raw_url: str) -> str:
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


# =============================================================================
# Endpoints
# =============================================================================

@router.get(
    "/vendor-cases",
    response=VendorCasesListResponse,
    summary="Get Vendor's Assigned Cases",
    description="Retrieve all cases assigned to the authenticated vendor.",
)
def get_vendor_cases(
    request: HttpRequest,
    page: int = 1,
    page_size: int = 20,
    status: Optional[str] = None,
    search: Optional[str] = None,
):
    """
    Get all cases assigned to the authenticated vendor.
    
    Filters:
    - status: Filter by case status (OPEN, IN_PROGRESS, RESOLVED, CLOSED)
    - search: Search in title, description, case_number, claim_number
    """
    if not request.user.is_authenticated:
        return 401, {"error": "Not authenticated"}
    
    if request.user.role != 'VENDOR':
        return 403, {"error": "Vendor access required"}
    
    vendor_id = get_vendor_id_from_user(request.user)
    if not vendor_id:
        return 403, {"error": "Vendor profile not found"}
    
    try:
        with connection.cursor() as cursor:
            case_numbers = get_vendor_assigned_case_numbers(cursor, vendor_id)
            if not case_numbers:
                return {
                    "cases": [],
                    "total": 0,
                    "statistics": {
                        "total": 0,
                        "open": 0,
                        "in_progress": 0,
                        "resolved": 0,
                        "closed": 0,
                    },
                }

            case_placeholders = ", ".join(["%s"] * len(case_numbers))

            # Build WHERE clause
            where_conditions = [f"ic.case_number IN ({case_placeholders})"]
            params = list(case_numbers)
            
            if status:
                where_conditions.append("ic.status = %s")
                params.append(status)
            
            if search:
                where_conditions.append(
                    "(ic.title ILIKE %s OR ic.description ILIKE %s OR ic.case_number ILIKE %s OR ic.claim_number ILIKE %s)"
                )
                search_param = f"%{search}%"
                params.extend([search_param, search_param, search_param, search_param])
            
            where_clause = " AND ".join(where_conditions)
            
            # Get total count
            count_query = f"SELECT COUNT(*) FROM insurance_case ic WHERE {where_clause}"
            cursor.execute(count_query, params)
            total = cursor.fetchone()[0]
            
            # Get paginated data
            offset = (page - 1) * page_size
            data_query = f"""
                SELECT
                    ic.*,
                    ic.vendor_id AS assigned_vendor_id,
                    v.company_name AS assigned_vendor
                FROM insurance_case ic
                LEFT JOIN users_vendor v ON v.id = ic.vendor_id
                WHERE {where_clause}
                ORDER BY ic.created_at DESC
                LIMIT %s OFFSET %s
            """
            cursor.execute(data_query, params + [page_size, offset])
            cases = dict_fetchall(cursor)
            
            # Get statistics
            stats_query = f"""
                SELECT 
                    COUNT(*) as total,
                    COUNT(CASE WHEN ic.status = 'OPEN' THEN 1 END) as open,
                    COUNT(CASE WHEN ic.status = 'IN_PROGRESS' THEN 1 END) as in_progress,
                    COUNT(CASE WHEN ic.status = 'RESOLVED' THEN 1 END) as resolved,
                    COUNT(CASE WHEN ic.status = 'CLOSED' THEN 1 END) as closed
                FROM insurance_case ic
                WHERE ic.case_number IN ({case_placeholders})
            """
            cursor.execute(stats_query, case_numbers)
            stats_row = cursor.fetchone()
            statistics = {
                'total': stats_row[0] or 0,
                'open': stats_row[1] or 0,
                'in_progress': stats_row[2] or 0,
                'resolved': stats_row[3] or 0,
                'closed': stats_row[4] or 0,
            }
            
            return {
                "cases": cases,
                "total": total,
                "statistics": statistics
            }
    
    except Exception as e:
        logger.error(f"Failed to fetch vendor cases: {e}")
        return 500, {"error": "Failed to fetch cases"}


# =============================================================================
# Vendor Assigned Checks Endpoints (sub-check level assignments)
# =============================================================================

_CHECK_TABLE_MAP = {
    'claimant':    'claimant_checks',
    'insured':     'insured_checks',
    'driver':      'driver_checks',
    'spot':        'spot_checks',
    'chargesheet': 'chargesheets',
}

_CHECK_DETAIL_COLUMNS = {
    'claimant_checks': {
        'select': '''cc.id, cc.case_id, cc.check_status,
                     cc.claimant_name, cc.claimant_contact, cc.claimant_address,
                     cc.claimant_income, cc.statement, cc.observation, cc.vendor_evidence AS evidence''',
        'alias': 'cc',
        'fields': ['id','case_id','check_status','claimant_name','claimant_contact',
                    'claimant_address','claimant_income','statement','observation','evidence'],
    },
    'insured_checks': {
        'select': '''ic.id, ic.case_id, ic.check_status,
                     ic.insured_name, ic.insured_contact, ic.insured_address,
                     ic.policy_number, ic.policy_period, ic.rc, ic.permit,
                     ic.statement, ic.observation, ic.vendor_evidence AS evidence''',
        'alias': 'ic',
        'fields': ['id','case_id','check_status','insured_name','insured_contact',
                    'insured_address','policy_number','policy_period','rc','permit',
                    'statement','observation','evidence'],
    },
    'driver_checks': {
        'select': '''dc.id, dc.case_id, dc.check_status,
                     dc.driver_name, dc.driver_contact, dc.driver_address,
                     dc.dl, dc.permit, dc.occupation,
                     dc.statement, dc.observation, dc.vendor_evidence AS evidence''',
        'alias': 'dc',
        'fields': ['id','case_id','check_status','driver_name','driver_contact',
                    'driver_address','dl','permit','occupation',
                    'statement','observation','evidence'],
    },
    'spot_checks': {
        'select': '''sc.id, sc.case_id, sc.check_status,
                     sc.place_of_accident, sc.police_station, sc.district,
                     sc.fir_number, sc.time_of_accident, sc.accident_brief,
                     sc.observations, sc.vendor_evidence AS evidence''',
        'alias': 'sc',
        'fields': ['id','case_id','check_status','place_of_accident','police_station',
                    'district','fir_number','time_of_accident','accident_brief',
                    'observations','evidence'],
    },
    'chargesheets': {
        'select': '''cs.id, cs.case_id, cs.check_status,
                     cs.court_name, cs.fir_number, cs.mv_act,
                     cs.fir_delay_days, cs.bsn_section, cs.ipc,
                     cs.statement, cs.observations, cs.vendor_evidence AS evidence''',
        'alias': 'cs',
        'fields': ['id','case_id','check_status','court_name','fir_number','mv_act',
                    'fir_delay_days','bsn_section','ipc',
                    'statement','observations','evidence'],
    },
}

_CHECK_TYPE_LABELS = {
    'claimant_checks':  'Claimant Check',
    'insured_checks':   'Insured Check',
    'driver_checks':    'Driver Check',
    'spot_checks':      'Spot Check',
    'chargesheets':     'Chargesheet',
}


@router.get(
    "/vendor-assigned-checks",
    response={200: dict, 401: ApiErrorSchema, 403: ApiErrorSchema, 500: ApiErrorSchema},
    summary="Get Vendor's Assigned Checks",
    description="Get all sub-checks assigned to the authenticated vendor across all cases.",
)
def get_vendor_assigned_checks(request: HttpRequest):
    """Return all sub-check rows where assigned_vendor_id matches the logged-in vendor."""
    logger.info(f"vendor-assigned-checks called, user authenticated: {request.user.is_authenticated}")
    if not request.user.is_authenticated:
        logger.warning("vendor-assigned-checks: User not authenticated")
        return 401, {"error": "Not authenticated"}
    logger.info(f"vendor-assigned-checks: User role = {request.user.role}")
    if request.user.role != 'VENDOR':
        logger.warning(f"vendor-assigned-checks: Non-vendor role: {request.user.role}")
        return 403, {"error": "Vendor access required"}

    vendor_id = get_vendor_id_from_user(request.user)
    if not vendor_id:
        return 403, {"error": "Vendor profile not found"}

    try:
        assigned_checks = []
        with connections['default'].cursor() as cursor:
            for table, label in _CHECK_TYPE_LABELS.items():
                meta = _CHECK_DETAIL_COLUMNS[table]
                alias = meta['alias']
                cursor.execute(f"""
                    SELECT {alias}.id, {alias}.case_id, {alias}.check_status,
                           c.claim_number, c.client_name, c.category, c.full_case_status
                    FROM {table} {alias}
                    JOIN cases c ON c.id = {alias}.case_id
                    WHERE {alias}.assigned_vendor_id = %s
                    ORDER BY {alias}.updated_at DESC NULLS LAST
                """, [vendor_id])
                for r in cursor.fetchall():
                    assigned_checks.append({
                        "check_id": r[0],
                        "case_id": r[1],
                        "check_status": r[2] or "WIP",
                        "check_type": label,
                        "claim_number": r[3] or "",
                        "client_name": r[4] or "",
                        "category": r[5] or "",
                        "case_status": r[6] or "",
                    })

        stats = {
            "total": len(assigned_checks),
            "wip": sum(1 for c in assigned_checks if c["check_status"] == "WIP"),
            "completed": sum(1 for c in assigned_checks if c["check_status"] == "Completed"),
            "not_initiated": sum(1 for c in assigned_checks if c["check_status"] == "Not Initiated"),
        }
        return {"checks": assigned_checks, "statistics": stats}

    except Exception as e:
        logger.error(f"Failed to fetch vendor assigned checks: {e}")
        return 500, {"error": "Failed to fetch assigned checks"}


@router.get(
    "/vendor-check-detail/{case_id}/{check_type}",
    response={200: dict, 400: ApiErrorSchema, 401: ApiErrorSchema, 403: ApiErrorSchema, 404: ApiErrorSchema, 500: ApiErrorSchema},
    summary="Get Vendor Check Detail",
    description="Get case details + specific check details for a vendor-assigned check.",
)
def get_vendor_check_detail(request: HttpRequest, case_id: int, check_type: str):
    """Return case info + check row detail for a specific assigned check."""
    if not request.user.is_authenticated:
        return 401, {"error": "Not authenticated"}
    if request.user.role != 'VENDOR':
        return 403, {"error": "Vendor access required"}

    vendor_id = get_vendor_id_from_user(request.user)
    if not vendor_id:
        return 403, {"error": "Vendor profile not found"}

    table = _CHECK_TABLE_MAP.get(check_type.lower())
    if not table:
        return 400, {"error": f"Unknown check type '{check_type}'"}

    meta = _CHECK_DETAIL_COLUMNS[table]
    alias = meta['alias']

    try:
        with connections['default'].cursor() as cursor:
            # Get case info
            cursor.execute("""
                SELECT id, claim_number, client_name, category,
                       case_receive_date, case_due_date, tat_days, sla,
                       case_type, full_case_status, scope_of_work,
                       investigation_report_status
                FROM cases WHERE id = %s
            """, [case_id])
            case_row = cursor.fetchone()
            if not case_row:
                return 404, {"error": "Case not found"}

            case_info = {
                "id": case_row[0],
                "claim_number": case_row[1] or "",
                "client_name": case_row[2] or "",
                "category": case_row[3] or "",
                "case_receive_date": str(case_row[4]) if case_row[4] else "",
                "case_due_date": str(case_row[5]) if case_row[5] else "",
                "tat_days": case_row[6],
                "sla": case_row[7] or "",
                "case_type": case_row[8] or "",
                "full_case_status": case_row[9] or "",
                "scope_of_work": case_row[10] or "",
                "investigation_report_status": case_row[11] or "",
            }

            # Get check detail
            cursor.execute(f"""
                SELECT {meta['select']}
                FROM {table} {alias}
                WHERE {alias}.case_id = %s AND {alias}.assigned_vendor_id = %s
            """, [case_id, vendor_id])
            check_row = cursor.fetchone()
            if not check_row:
                return 404, {"error": "Check not found or not assigned to you"}

            check_detail = {}
            for i, field in enumerate(meta['fields']):
                val = check_row[i]
                if hasattr(val, 'isoformat'):
                    val = val.isoformat()
                check_detail[field] = val

            # Parse evidence JSON list
            evidence_raw = check_detail.get('evidence')
            evidence_list = []
            if evidence_raw:
                try:
                    if isinstance(evidence_raw, list):
                        evidence_list = evidence_raw
                    elif isinstance(evidence_raw, str):
                        evidence_list = json.loads(evidence_raw)
                    else:
                        evidence_list = []
                except (json.JSONDecodeError, TypeError, ValueError):
                    evidence_list = []
            normalized_evidence_list = []
            for item in evidence_list:
                if isinstance(item, dict):
                    evidence_item = dict(item)
                elif isinstance(item, str):
                    evidence_item = {
                        "url": item,
                        "filename": extract_evidence_filename(item),
                    }
                else:
                    continue

                raw_url = evidence_item.get("url") or evidence_item.get("photo_url") or ""
                evidence_item["preview_url"] = build_absolute_media_url(request, raw_url)
                if not evidence_item.get("filename"):
                    evidence_item["filename"] = extract_evidence_filename(evidence_item)
                normalized_evidence_list.append(evidence_item)
            check_detail['evidence_photos'] = normalized_evidence_list

            return {
                "case": case_info,
                "check_type": check_type,
                "check_type_label": _CHECK_TYPE_LABELS.get(table, check_type),
                "check": check_detail,
            }

    except Exception as e:
        logger.error(f"Failed to fetch vendor check detail: {e}")
        return 500, {"error": "Failed to fetch check detail"}


@router.post(
    "/vendor-check-upload/{case_id}/{check_type}",
    response={200: dict, 400: ApiErrorSchema, 401: ApiErrorSchema, 403: ApiErrorSchema, 404: ApiErrorSchema, 500: ApiErrorSchema},
    summary="Upload Evidence to Check",
    description="Upload evidence photo and store path in the check's vendor_evidence column.",
)
def vendor_check_upload_evidence(request: HttpRequest, case_id: int, check_type: str):
    """Upload evidence photo for a vendor-assigned check."""
    if not request.user.is_authenticated:
        return 401, {"error": "Not authenticated"}
    if request.user.role != 'VENDOR':
        return 403, {"error": "Vendor access required"}

    vendor_id = get_vendor_id_from_user(request.user)
    if not vendor_id:
        return 403, {"error": "Vendor profile not found"}

    table = _CHECK_TABLE_MAP.get(check_type.lower())
    if not table:
        return 400, {"error": f"Unknown check type '{check_type}'"}

    # Verify the check is assigned to this vendor
    try:
        with connections['default'].cursor() as cursor:
            cursor.execute(f"""
                SELECT id, vendor_evidence FROM {table}
                WHERE case_id = %s AND assigned_vendor_id = %s
            """, [case_id, vendor_id])
            check_row = cursor.fetchone()
            if not check_row:
                return 404, {"error": "Check not found or not assigned to you"}
            check_id = check_row[0]
            existing_evidence = check_row[1]
    except Exception as e:
        logger.error(f"Failed to verify check assignment: {e}")
        return 500, {"error": "Failed to verify check"}

    # Get uploaded files
    files = request.FILES.getlist('photos') if hasattr(request, 'FILES') else []
    if not files:
        return 400, {"error": "No photos provided"}

    # Parse existing evidence list
    evidence_list = parse_json_list(existing_evidence)

    upload_dir = os.path.join(
        settings.MEDIA_ROOT, 'evidence_photos', f'case_{case_id}', check_type
    )
    os.makedirs(upload_dir, exist_ok=True)

    uploaded = []
    for f in files:
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S_%f')
        safe_name = f.name.replace(' ', '_')
        filename = f'{timestamp}_{safe_name}'
        filepath = os.path.join(upload_dir, filename)

        with open(filepath, 'wb') as dest:
            for chunk in f.chunks():
                dest.write(chunk)

        relative_path = f'evidence_photos/case_{case_id}/{check_type}/{filename}'
        photo_url = f'/media/{relative_path}'
        evidence_entry = {
            "filename": filename,
            "url": photo_url,
            "uploaded_at": datetime.now().isoformat(),
        }
        evidence_list.append(evidence_entry)
        uploaded.append(evidence_entry)
        logger.info(f"[Evidence] Saved {filename} for case={case_id} check={check_type}")

    # Update the check table's vendor_evidence column
    try:
        with connections['default'].cursor() as cursor:
            cursor.execute(f"""
                UPDATE {table} SET vendor_evidence = %s, updated_at = NOW()
                WHERE id = %s
            """, [json.dumps(evidence_list), check_id])
    except Exception as e:
        logger.error(f"Failed to update evidence column: {e}")
        return 500, {"error": "Failed to save evidence metadata"}

    return {
        "success": True,
        "message": f"Uploaded {len(uploaded)} photo(s)",
        "uploaded": uploaded,
        "total_evidence": len(evidence_list),
    }


@router.delete(
    "/vendor-check-evidence/{case_id}/{check_type}",
    response={200: dict, 400: ApiErrorSchema, 401: ApiErrorSchema, 403: ApiErrorSchema, 404: ApiErrorSchema, 500: ApiErrorSchema},
    summary="Delete uploaded evidence from a vendor check",
    description="Remove one evidence photo from the check's vendor_evidence column and delete the file from storage.",
)
def delete_vendor_check_evidence(request: HttpRequest, case_id: int, check_type: str, filename: str):
    """Delete a specific evidence photo from a vendor-assigned check."""
    if not request.user.is_authenticated:
        return 401, {"error": "Not authenticated"}
    if request.user.role != 'VENDOR':
        return 403, {"error": "Vendor access required"}

    vendor_id = get_vendor_id_from_user(request.user)
    if not vendor_id:
        return 403, {"error": "Vendor profile not found"}

    table = _CHECK_TABLE_MAP.get(check_type.lower())
    if not table:
        return 400, {"error": f"Unknown check type '{check_type}'"}
    if not filename:
        return 400, {"error": "filename is required"}

    try:
        with connections['default'].cursor() as cursor:
            cursor.execute(f"""
                SELECT id, vendor_evidence FROM {table}
                WHERE case_id = %s AND assigned_vendor_id = %s
            """, [case_id, vendor_id])
            check_row = cursor.fetchone()
            if not check_row:
                return 404, {"error": "Check not found or not assigned to you"}

            check_id = check_row[0]
            evidence_list = parse_json_list(check_row[1])

            delete_index = next(
                (idx for idx, item in enumerate(evidence_list) if extract_evidence_filename(item) == filename),
                None,
            )
            if delete_index is None:
                return 404, {"error": "Evidence photo not found"}

            deleted_item = evidence_list.pop(delete_index)

            cursor.execute(f"""
                UPDATE {table} SET vendor_evidence = %s, updated_at = NOW()
                WHERE id = %s
            """, [json.dumps(evidence_list), check_id])
    except Exception as exc:
        logger.error(f"Failed to delete vendor evidence for case={case_id} check={check_type}: {exc}")
        return 500, {"error": "Failed to delete evidence photo"}

    file_url = deleted_item if isinstance(deleted_item, str) else (
        deleted_item.get("url") or deleted_item.get("photo_url") or ""
    )
    relative_media_path = media_relative_path_from_url(file_url)
    if relative_media_path:
        try:
            media_root = os.path.abspath(settings.MEDIA_ROOT)
            absolute_file_path = os.path.abspath(os.path.join(media_root, relative_media_path))
            if absolute_file_path.startswith(media_root + os.sep) and os.path.exists(absolute_file_path):
                os.remove(absolute_file_path)
        except Exception as exc:
            logger.warning(f"Failed to delete evidence file {relative_media_path}: {exc}")

    return {
        "success": True,
        "message": "Evidence photo removed successfully",
        "deleted_filename": filename,
        "remaining": len(evidence_list),
    }


# =============================================================================
# Upload Evidence Endpoint
# =============================================================================

class EvidencePhotoSchema(Schema):
    """Evidence photo schema."""
    id: int
    file_name: str
    photo_url: str
    latitude: float
    longitude: float
    uploaded_at: datetime


class UploadEvidenceResponse(Schema):
    """Upload evidence response schema."""
    message: str
    uploaded_files: int
    case_id: int
    photos: List[dict]


class GetEvidencePhotosResponse(Schema):
    """Get evidence photos response."""
    case_id: int
    total: int
    photos: List[EvidencePhotoSchema]


class ErrorResponse(Schema):
    """Error response schema."""
    error: str


@router.get(
    "/cases/{case_id}/evidence-photos",
    response={200: GetEvidencePhotosResponse, 400: ErrorResponse, 401: ErrorResponse, 403: ErrorResponse, 404: ErrorResponse},
    summary="Get Evidence Photos for Case",
    description="Retrieve all uploaded evidence photos for a specific case.",
)
def get_evidence_photos(
    request: HttpRequest,
    case_id: int,
):
    """
    Get all evidence photos uploaded for a case.
    
    Requirements:
    - Vendor must be assigned to the case
    
    Returns:
    - List of evidence photos with URLs and GPS coordinates
    """
    from users.models import Vendor, EvidencePhoto
    from django.conf import settings
    
    # Verify user is authenticated vendor
    if not request.user.is_authenticated:
        return 401, {"error": "Not authenticated"}
    
    if request.user.role != 'VENDOR':
        return 403, {"error": "Vendor access required"}
    
    # Get vendor profile
    try:
        vendor = Vendor.objects.get(user=request.user)
    except Vendor.DoesNotExist:
        return 403, {"error": "Vendor profile not found"}
    
    # Verify case exists and is assigned to this vendor
    try:
        with connection.cursor() as cursor:
            cursor.execute(
                "SELECT id, case_number FROM insurance_case WHERE id = %s",
                [case_id]
            )
            case_row = cursor.fetchone()
            
            if not case_row:
                return 404, {"error": "Case not found"}

            if not vendor_has_case_assignment(cursor, vendor.id, case_row[1]):
                return 403, {"error": "You are not assigned to this case"}
    except Exception as e:
        logger.error(f"Failed to verify case assignment: {e}")
        return 500, {"error": "Failed to verify case"}
    
    # Get evidence photos for this case
    try:
        evidence_photos = EvidencePhoto.objects.filter(
            case_id=case_id,
            vendor=vendor
        ).order_by('-uploaded_at')
        
        photos_list = []
        for photo in evidence_photos:
            # Build photo URL
            photo_url = request.build_absolute_uri(photo.photo.url) if photo.photo else ''
            
            photos_list.append({
                'id': photo.id,
                'file_name': photo.file_name,
                'photo_url': photo_url,
                'latitude': float(photo.latitude),
                'longitude': float(photo.longitude),
                'uploaded_at': photo.uploaded_at,
            })
        
        logger.info(f"[Evidence] Retrieved {len(photos_list)} photos for case {case_id}")
        
        return {
            "case_id": case_id,
            "total": len(photos_list),
            "photos": photos_list,
        }
        
    except Exception as e:
        logger.error(f"[Evidence] Failed to retrieve photos: {e}")
        return 500, {"error": "Failed to retrieve evidence photos"}


class DeleteEvidenceResponse(Schema):
    """Delete evidence response schema."""
    message: str
    deleted_photo_id: int


@router.delete(
    "/evidence-photos/{photo_id}",
    response={200: DeleteEvidenceResponse, 400: ErrorResponse, 401: ErrorResponse, 403: ErrorResponse, 404: ErrorResponse},
    summary="Delete Evidence Photo",
    description="Delete an uploaded evidence photo from the database and storage.",
)
def delete_evidence_photo(
    request: HttpRequest,
    photo_id: int,
):
    """
    Delete an evidence photo.
    
    Requirements:
    - Vendor must be the owner of the photo
    - Photo file will be deleted from storage
    - Database record will be removed
    
    Returns:
    - Success message with deleted photo ID
    """
    from users.models import Vendor, EvidencePhoto
    import os
    from django.conf import settings
    
    # Verify user is authenticated vendor
    if not request.user.is_authenticated:
        return 401, {"error": "Not authenticated"}
    
    if request.user.role != 'VENDOR':
        return 403, {"error": "Vendor access required"}
    
    # Get vendor profile
    try:
        vendor = Vendor.objects.get(user=request.user)
    except Vendor.DoesNotExist:
        return 403, {"error": "Vendor profile not found"}
    
    # Get and verify photo ownership
    try:
        evidence_photo = EvidencePhoto.objects.get(id=photo_id, vendor=vendor)
    except EvidencePhoto.DoesNotExist:
        return 404, {"error": "Evidence photo not found or you don't have permission to delete it"}
    
    # Delete physical file from storage
    try:
        if evidence_photo.photo:
            photo_path = evidence_photo.photo.path
            if os.path.exists(photo_path):
                os.remove(photo_path)
                logger.info(f"[Evidence] Deleted file: {photo_path}")
    except Exception as e:
        logger.warning(f"[Evidence] Failed to delete file: {e}")
        # Continue with database deletion even if file deletion fails
    
    # Delete database record
    photo_id_backup = evidence_photo.id
    case_id = evidence_photo.case_id
    evidence_photo.delete()
    
    logger.info(f"[Evidence] Deleted photo {photo_id_backup} from case {case_id}")
    
    return {
        "message": "Evidence photo deleted successfully",
        "deleted_photo_id": photo_id_backup,
    }


@router.post(
    "/cases/{case_id}/upload-evidence",
    response={200: UploadEvidenceResponse, 400: ErrorResponse, 401: ErrorResponse, 403: ErrorResponse, 404: ErrorResponse, 500: ErrorResponse},
    summary="Upload Evidence Photos with GPS",
    description="Upload geotagged photos as evidence for a case. GPS coordinates are REQUIRED.",
)
def upload_evidence(
    request: HttpRequest,
    case_id: int,
):
    """
    Upload evidence photos for a case.
    
    Requirements:
    - Vendor must be assigned to the case
    - Photos must have GPS coordinates (latitude and longitude)
    - Photos without geotags will be rejected
    
    Form data:
    - files: Multiple image files
    - latitude: GPS latitude (required)
    - longitude: GPS longitude (required)
    """
    from users.models import Vendor, EvidencePhoto
    from PIL import Image
    from PIL.ExifTags import TAGS, GPSTAGS
    
    # Verify user is authenticated vendor
    if not request.user.is_authenticated:
        return 401, {"error": "Not authenticated"}
    
    if request.user.role != 'VENDOR':
        return 403, {"error": "Vendor access required"}
    
    # Get vendor profile
    try:
        vendor = Vendor.objects.get(user=request.user)
    except Vendor.DoesNotExist:
        return 403, {"error": "Vendor profile not found"}
    
    # Verify case exists and is assigned to this vendor
    case_location = None
    try:
        with connection.cursor() as cursor:
            cursor.execute(
                "SELECT id, case_number, title, latitude, longitude FROM insurance_case WHERE id = %s",
                [case_id]
            )
            case_row = cursor.fetchone()
            
            if not case_row:
                return 404, {"error": "Case not found"}

            if not vendor_has_case_assignment(cursor, vendor.id, case_row[1]):
                return 403, {"error": "You are not assigned to this case"}
            
            # Get case location for validation
            if case_row[3] is not None and case_row[4] is not None:
                case_location = {
                    'latitude': float(case_row[3]),
                    'longitude': float(case_row[4])
                }
                logger.info(f"[Evidence Upload] Case location: {case_location}")
    except Exception as e:
        logger.error(f"Failed to verify case assignment: {e}")
        return 500, {"error": "Failed to verify case"}
    
    # Get uploaded files
    files = request.FILES.getlist('photos') if hasattr(request, 'FILES') else []
    
    if not files:
        return 400, {"error": "No photos provided. Please upload at least one photo."}
    
    logger.info(f"[Evidence Upload] Received {len(files)} files for case {case_id}")
    
    uploaded_photos = []
    errors = []
    
    for file in files:
        try:
            # Extract GPS from EXIF
            latitude, longitude = extract_gps_from_image(file)
            
            if latitude is None or longitude is None:
                errors.append(f"{file.name}: Missing GPS coordinates")
                continue
            
            # Validate location match with case location (within 100 meters)
            if case_location is not None:
                from geopy.distance import geodesic
                
                photo_location = (latitude, longitude)
                case_coords = (case_location['latitude'], case_location['longitude'])
                
                # Calculate distance in meters
                distance_meters = geodesic(case_coords, photo_location).meters
                
                logger.info(
                    f"[Evidence Upload] Location validation for {file.name}: "
                    f"Distance = {distance_meters:.2f} meters"
                )
                
                # Reject if distance > 100 meters
                if distance_meters > 100:
                    errors.append(
                        f"{file.name}: Location mismatch. Photo taken {distance_meters:.0f}m away from case location. "
                        f"Maximum allowed distance is 100m."
                    )
                    logger.warning(
                        f"[Evidence Upload] Photo {file.name} rejected: "
                        f"{distance_meters:.2f}m away from case location"
                    )
                    continue
                else:
                    logger.info(
                        f"[Evidence Upload] Photo {file.name} location validated: "
                        f"{distance_meters:.2f}m from case location (within 100m tolerance)"
                    )
            else:
                logger.warning(f"[Evidence Upload] Case has no location set, skipping location validation")
            
            # Convert to Decimal with 6 decimal places precision
            from decimal import Decimal, ROUND_HALF_UP
            lat_decimal = Decimal(str(latitude)).quantize(Decimal('0.000001'), rounding=ROUND_HALF_UP)
            lon_decimal = Decimal(str(longitude)).quantize(Decimal('0.000001'), rounding=ROUND_HALF_UP)
            
            # Create EvidencePhoto record
            evidence_photo = EvidencePhoto(
                case_id=case_id,
                vendor=vendor,
                photo=file,
                latitude=lat_decimal,
                longitude=lon_decimal,
                file_name=file.name,
                file_size=file.size,
            )
            evidence_photo.full_clean()  # Validates GPS are not None
            evidence_photo.save()
            
            uploaded_photos.append({
                'id': evidence_photo.id,
                'file_name': evidence_photo.file_name,
                'latitude': float(evidence_photo.latitude),
                'longitude': float(evidence_photo.longitude),
                'uploaded_at': evidence_photo.uploaded_at.isoformat(),
            })
            
            logger.info(
                f"[Evidence Upload] Saved photo {file.name} with GPS: "
                f"({latitude}, {longitude})"
            )
            
        except Exception as e:
            logger.error(f"[Evidence Upload] Failed to save {file.name}: {e}")
            errors.append(f"{file.name}: {str(e)}")
            continue
    
    # Return response
    if not uploaded_photos and errors:
        error_msg = "All photos rejected. " + "; ".join(errors[:3])
        return 400, {"error": error_msg}
    
    response_message = f"Successfully uploaded {len(uploaded_photos)} photo(s)"
    if errors:
        response_message += f". {len(errors)} photo(s) rejected: " + "; ".join(errors[:2])
    
    return {
        "message": response_message,
        "uploaded_files": len(uploaded_photos),
        "case_id": case_id,
        "photos": uploaded_photos,
    }


def extract_gps_from_image(image_file: UploadedFile):
    """
    Extract GPS coordinates from image EXIF data.
    
    Returns:
        tuple: (latitude, longitude) or (None, None) if GPS data not found
    """
    from PIL import Image
    from PIL.ExifTags import TAGS, GPSTAGS
    
    try:
        # Read image
        image = Image.open(image_file)
        exif_data = image._getexif()
        
        if not exif_data:
            logger.warning(f"No EXIF data in {image_file.name}")
            return None, None
        
        # Find GPS IFD tag
        gps_ifd = None
        for tag_id, value in exif_data.items():
            tag_name = TAGS.get(tag_id, tag_id)
            if tag_name == 'GPSInfo':
                gps_ifd = value
                break
        
        if not gps_ifd:
            logger.warning(f"No GPS data in {image_file.name}")
            return None, None
        
        # Extract GPS coordinates
        gps_data = {}
        for tag_id in gps_ifd:
            tag_name = GPSTAGS.get(tag_id, tag_id)
            gps_data[tag_name] = gps_ifd[tag_id]
        
        # Convert to decimal degrees
        lat = gps_data.get('GPSLatitude')
        lat_ref = gps_data.get('GPSLatitudeRef')
        lon = gps_data.get('GPSLongitude')
        lon_ref = gps_data.get('GPSLongitudeRef')
        
        if not all([lat, lat_ref, lon, lon_ref]):
            logger.warning(f"Incomplete GPS data in {image_file.name}")
            return None, None
        
        latitude = convert_to_degrees(lat)
        if lat_ref == 'S':
            latitude = -latitude
        
        longitude = convert_to_degrees(lon)
        if lon_ref == 'W':
            longitude = -longitude
        
        # Round to 6 decimal places to match database field precision
        latitude = round(latitude, 6)
        longitude = round(longitude, 6)
        
        logger.info(f"Extracted GPS from {image_file.name}: ({latitude}, {longitude})")
        return latitude, longitude
        
    except Exception as e:
        logger.error(f"Failed to extract GPS from {image_file.name}: {e}")
        return None, None


def convert_to_degrees(value):
    """
    Convert GPS coordinates from degrees/minutes/seconds to decimal degrees.

    Args:
        value: tuple of (degrees, minutes, seconds)

    Returns:
        float: Decimal degrees
    """
    d, m, s = value
    return float(d) + float(m) / 60.0 + float(s) / 3600.0


# =============================================================================
# Vendor Statement Audio Endpoints
# =============================================================================

# Mapping from check_type to table and final statement column
_CHECK_STATEMENT_COLUMN_MAP = {
    'claimant': ('claimant_checks', 'statement'),
    'insured': ('insured_checks', 'statement'),
    'driver': ('driver_checks', 'statement'),
    'chargesheet': ('chargesheets', 'statement'),
    'spot': ('spot_checks', 'observations'),  # spot uses observations instead of statement
}

# Max file size for audio (configurable via env)
import os
SPEECH_MAX_FILE_MB = int(os.environ.get('SPEECH_MAX_FILE_MB', '15'))
SPEECH_MAX_FILE_BYTES = SPEECH_MAX_FILE_MB * 1024 * 1024


def _validate_vendor_check_assignment(request, case_id: int, check_type: str):
    """
    Validate vendor authentication and check assignment.

    Returns:
        Tuple of (error_response, vendor_id, check_id, table_name, statement_column)
        error_response is None if validation passes
    """
    if not request.user.is_authenticated:
        return (401, {"error": "Not authenticated"}), None, None, None, None
    if request.user.role != 'VENDOR':
        return (403, {"error": "Vendor access required"}), None, None, None, None

    vendor_id = get_vendor_id_from_user(request.user)
    if not vendor_id:
        return (403, {"error": "Vendor profile not found"}), None, None, None, None

    check_type_lower = check_type.lower()
    if check_type_lower not in _CHECK_STATEMENT_COLUMN_MAP:
        return (400, {"error": f"Unknown check type '{check_type}'"}), None, None, None, None

    table_name, statement_column = _CHECK_STATEMENT_COLUMN_MAP[check_type_lower]

    try:
        with connections['default'].cursor() as cursor:
            cursor.execute(f"""
                SELECT id FROM {table_name}
                WHERE case_id = %s AND assigned_vendor_id = %s
            """, [case_id, vendor_id])
            row = cursor.fetchone()
            if not row:
                return (404, {"error": "Check not found or not assigned to you"}), None, None, None, None
            check_id = row[0]
    except Exception as e:
        logger.error(f"[Statement] Failed to verify check assignment: {e}")
        return (500, {"error": "Failed to verify check assignment"}), None, None, None, None

    return None, vendor_id, check_id, table_name, statement_column


def _save_audio_file(audio_file, case_id: int, check_type: str, vendor_id: int) -> str:
    """
    Save uploaded audio file and return relative path.
    """
    from django.conf import settings

    upload_dir = os.path.join(
        settings.MEDIA_ROOT, 'statement_audio', f'case_{case_id}', check_type
    )
    os.makedirs(upload_dir, exist_ok=True)

    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S_%f')
    safe_name = audio_file.name.replace(' ', '_') if audio_file.name else 'audio.m4a'
    filename = f'v{vendor_id}_{timestamp}_{safe_name}'
    filepath = os.path.join(upload_dir, filename)

    with open(filepath, 'wb') as dest:
        for chunk in audio_file.chunks():
            dest.write(chunk)

    relative_path = f'statement_audio/case_{case_id}/{check_type}/{filename}'
    logger.info(f"[Statement] Saved audio file: {relative_path}")
    return relative_path


def _create_audit_record(
    vendor_id: int,
    case_id: int,
    check_type: str,
    audio_path: str,
    mime_type: str,
    size_bytes: int,
    transcript_mr: str,
    translation_en: str,
    result,
    source: str = 'audio',
    is_applied: bool = False,
) -> int:
    """
    Create an audit record in statement_audio_audit table.
    Returns the audit record ID.
    """
    try:
        with connections['default'].cursor() as cursor:
            cursor.execute("""
                INSERT INTO statement_audio_audit (
                    vendor_id, case_id, check_type,
                    audio_file, audio_mime_type, audio_size_bytes, audio_duration_seconds,
                    transcript_mr, translation_en, detected_language,
                    stt_provider, stt_model, translation_model, confidence,
                    raw_provider_response, is_applied_to_check, applied_at, source
                ) VALUES (
                    %s, %s, %s,
                    %s, %s, %s, %s,
                    %s, %s, %s,
                    %s, %s, %s, %s,
                    %s, %s, %s, %s
                ) RETURNING id
            """, [
                vendor_id, case_id, check_type,
                audio_path, mime_type, size_bytes,
                result.audio_duration_seconds if result else None,
                transcript_mr, translation_en,
                result.detected_language if result else 'mr',
                result.provider if result else 'manual',
                result.stt_model if result else None,
                result.translation_model if result else None,
                result.confidence if result else None,
                json.dumps(result.provider_metadata) if result and result.provider_metadata else None,
                is_applied,
                datetime.now() if is_applied else None,
                source,
            ])
            audit_id = cursor.fetchone()[0]
            return audit_id
    except Exception as e:
        logger.error(f"[Statement] Failed to create audit record: {e}")
        raise


def _update_check_transcript_columns(
    table_name: str,
    check_id: int,
    audio_path: Optional[str],
    transcript_mr: str,
    transcript_en: str,
    provider: str,
    confidence: Optional[float],
):
    """
    Update the transcript columns in the check table.
    """
    try:
        with connections['default'].cursor() as cursor:
            cursor.execute(f"""
                UPDATE {table_name} SET
                    statement_audio_path = COALESCE(%s, statement_audio_path),
                    statement_transcript_mr = %s,
                    statement_transcript_en = %s,
                    statement_transcript_provider = %s,
                    statement_transcript_confidence = %s,
                    statement_transcript_updated_at = NOW(),
                    updated_at = NOW()
                WHERE id = %s
            """, [
                audio_path, transcript_mr, transcript_en,
                provider, confidence, check_id
            ])
    except Exception as e:
        logger.error(f"[Statement] Failed to update transcript columns: {e}")
        raise


def _update_final_statement_column(
    table_name: str,
    statement_column: str,
    check_id: int,
    text: str,
):
    """
    Update the final workflow statement/observations column.
    """
    try:
        # Clamp text length to prevent DB overflow (max 65535 for TEXT)
        clamped_text = text[:65000] if text else ""
        with connections['default'].cursor() as cursor:
            cursor.execute(f"""
                UPDATE {table_name} SET
                    {statement_column} = %s,
                    updated_at = NOW()
                WHERE id = %s
            """, [clamped_text, check_id])
    except Exception as e:
        logger.error(f"[Statement] Failed to update statement column: {e}")
        raise


@router.post(
    "/vendor-check-statement-audio-preview/{case_id}/{check_type}",
    response={200: dict, 400: ApiErrorSchema, 401: ApiErrorSchema, 403: ApiErrorSchema, 404: ApiErrorSchema, 500: ApiErrorSchema},
    summary="Preview Statement Audio Transcription",
    description="Upload Marathi audio, transcribe, and translate to English. Does NOT update the final statement.",
)
def vendor_check_statement_audio_preview(request: HttpRequest, case_id: int, check_type: str):
    """
    Process audio recording and return preview of transcript/translation.

    - Validates vendor is assigned to this check
    - Validates audio file (format, size)
    - Transcribes Marathi speech using Groq Whisper
    - Translates to English using Groq LLM
    - Saves audit record and updates transcript columns
    - Does NOT update the final workflow statement column
    """
    from users.services.speech_statement_service import (
        SpeechStatementError,
        AudioValidationError,
    )

    # Validate vendor and check assignment
    error_response, vendor_id, check_id, table_name, statement_column = \
        _validate_vendor_check_assignment(request, case_id, check_type)
    if error_response:
        return error_response

    # Get uploaded audio file
    audio_file = request.FILES.get('audio')
    if not audio_file:
        return 400, {"error": "No audio file provided. Upload with field name 'audio'."}

    # Basic file size check
    if audio_file.size > SPEECH_MAX_FILE_BYTES:
        return 400, {"error": f"Audio file too large. Maximum size is {SPEECH_MAX_FILE_MB}MB."}

    try:
        # Read audio bytes
        audio_bytes = audio_file.read()
        content_type = audio_file.content_type
        filename = audio_file.name

        logger.info(
            f"[Statement] Preview request: case={case_id}, check={check_type}, "
            f"vendor={vendor_id}, size={len(audio_bytes)}, type={content_type}"
        )

        # Process audio
        service = get_speech_service()
        result = service.process_audio(audio_bytes, content_type, filename)

        # Save audio file
        audio_path = _save_audio_file(audio_file, case_id, check_type, vendor_id)

        # Create audit record (not applied)
        audit_id = _create_audit_record(
            vendor_id=vendor_id,
            case_id=case_id,
            check_type=check_type.lower(),
            audio_path=audio_path,
            mime_type=content_type or 'audio/m4a',
            size_bytes=len(audio_bytes),
            transcript_mr=result.transcript_mr,
            translation_en=result.translation_en,
            result=result,
            source='audio_preview',
            is_applied=False,
        )

        # Update transcript columns (but not final statement)
        _update_check_transcript_columns(
            table_name=table_name,
            check_id=check_id,
            audio_path=audio_path,
            transcript_mr=result.transcript_mr,
            transcript_en=result.translation_en,
            provider=result.provider,
            confidence=result.confidence,
        )

        logger.info(
            f"[Statement] Preview success: case={case_id}, check={check_type}, "
            f"audit_id={audit_id}, mr_len={len(result.transcript_mr)}, en_len={len(result.translation_en)}"
        )

        return {
            "success": True,
            "audit_id": audit_id,
            "transcript_mr": result.transcript_mr,
            "translation_en": result.translation_en,
            "detected_language": result.detected_language,
            "confidence": result.confidence,
            "provider": result.provider,
            "audio_duration_seconds": result.audio_duration_seconds,
        }

    except AudioValidationError as e:
        logger.warning(f"[Statement] Audio validation failed: {e.message}")
        return 400, {"error": e.message}
    except SpeechStatementError as e:
        logger.error(f"[Statement] Processing failed: {e.message}")
        return 500, {"error": e.message}
    except Exception as e:
        logger.exception(f"[Statement] Unexpected error in preview: {e}")
        return 500, {"error": "Failed to process audio. Please try again."}


@router.post(
    "/vendor-check-statement-audio-apply/{case_id}/{check_type}",
    response={200: dict, 400: ApiErrorSchema, 401: ApiErrorSchema, 403: ApiErrorSchema, 404: ApiErrorSchema, 500: ApiErrorSchema},
    summary="Apply Statement Audio Transcription",
    description="Upload Marathi audio, transcribe, translate, and save to the case statement field.",
)
def vendor_check_statement_audio_apply(request: HttpRequest, case_id: int, check_type: str):
    """
    Process audio recording and apply translation to the case statement.

    - Validates vendor is assigned to this check
    - Validates audio file (format, size)
    - Transcribes Marathi speech using Groq Whisper
    - Translates to English using Groq LLM
    - Updates all transcript columns
    - Updates the final workflow statement/observations column
    - Creates audit record marked as applied
    """
    from django.db import transaction
    from users.services.speech_statement_service import (
        SpeechStatementError,
        AudioValidationError,
    )

    # Validate vendor and check assignment
    error_response, vendor_id, check_id, table_name, statement_column = \
        _validate_vendor_check_assignment(request, case_id, check_type)
    if error_response:
        return error_response

    # Get uploaded audio file
    audio_file = request.FILES.get('audio')
    if not audio_file:
        return 400, {"error": "No audio file provided. Upload with field name 'audio'."}

    if audio_file.size > SPEECH_MAX_FILE_BYTES:
        return 400, {"error": f"Audio file too large. Maximum size is {SPEECH_MAX_FILE_MB}MB."}

    try:
        audio_bytes = audio_file.read()
        content_type = audio_file.content_type
        filename = audio_file.name

        logger.info(
            f"[Statement] Apply request: case={case_id}, check={check_type}, "
            f"vendor={vendor_id}, size={len(audio_bytes)}, type={content_type}"
        )

        # Process audio
        service = get_speech_service()
        result = service.process_audio(audio_bytes, content_type, filename)

        # Save audio file
        audio_path = _save_audio_file(audio_file, case_id, check_type, vendor_id)

        # Use transaction to ensure all updates succeed together
        with transaction.atomic():
            # Create audit record (applied)
            audit_id = _create_audit_record(
                vendor_id=vendor_id,
                case_id=case_id,
                check_type=check_type.lower(),
                audio_path=audio_path,
                mime_type=content_type or 'audio/m4a',
                size_bytes=len(audio_bytes),
                transcript_mr=result.transcript_mr,
                translation_en=result.translation_en,
                result=result,
                source='audio',
                is_applied=True,
            )

            # Update transcript columns
            _update_check_transcript_columns(
                table_name=table_name,
                check_id=check_id,
                audio_path=audio_path,
                transcript_mr=result.transcript_mr,
                transcript_en=result.translation_en,
                provider=result.provider,
                confidence=result.confidence,
            )

            # Update final statement column
            _update_final_statement_column(
                table_name=table_name,
                statement_column=statement_column,
                check_id=check_id,
                text=result.translation_en,
            )

        logger.info(
            f"[Statement] Apply success: case={case_id}, check={check_type}, "
            f"audit_id={audit_id}, column={statement_column}"
        )

        return {
            "success": True,
            "audit_id": audit_id,
            "transcript_mr": result.transcript_mr,
            "translation_en": result.translation_en,
            "applied_to_column": statement_column,
            "detected_language": result.detected_language,
            "confidence": result.confidence,
            "provider": result.provider,
            "audio_duration_seconds": result.audio_duration_seconds,
        }

    except AudioValidationError as e:
        logger.warning(f"[Statement] Audio validation failed: {e.message}")
        return 400, {"error": e.message}
    except SpeechStatementError as e:
        logger.error(f"[Statement] Processing failed: {e.message}")
        return 500, {"error": e.message}
    except Exception as e:
        logger.exception(f"[Statement] Unexpected error in apply: {e}")
        return 500, {"error": "Failed to process audio. Please try again."}


@router.post(
    "/vendor-check-statement-text-apply/{case_id}/{check_type}",
    response={200: dict, 400: ApiErrorSchema, 401: ApiErrorSchema, 403: ApiErrorSchema, 404: ApiErrorSchema, 500: ApiErrorSchema},
    summary="Apply Manual Statement Text",
    description="Apply manually edited English statement text to the case.",
)
def vendor_check_statement_text_apply(request: HttpRequest, case_id: int, check_type: str):
    """
    Apply manually edited statement text to the case.

    JSON body:
    - edited_english_text: The final English text to apply (required)
    - transcript_mr: Original Marathi text (optional, for audit)

    This endpoint allows vendors to edit the translated text before applying.
    """
    from django.db import transaction

    # Validate vendor and check assignment
    error_response, vendor_id, check_id, table_name, statement_column = \
        _validate_vendor_check_assignment(request, case_id, check_type)
    if error_response:
        return error_response

    # Parse JSON body
    try:
        import json
        body = json.loads(request.body.decode('utf-8'))
    except (json.JSONDecodeError, UnicodeDecodeError):
        return 400, {"error": "Invalid JSON body"}

    edited_english_text = body.get('edited_english_text', '').strip()
    transcript_mr = body.get('transcript_mr', '').strip()

    if not edited_english_text:
        return 400, {"error": "edited_english_text is required and cannot be empty"}

    # Validate text length
    if len(edited_english_text) > 65000:
        return 400, {"error": "Statement text too long. Maximum 65000 characters."}

    try:
        logger.info(
            f"[Statement] Manual text apply: case={case_id}, check={check_type}, "
            f"vendor={vendor_id}, text_len={len(edited_english_text)}"
        )

        with transaction.atomic():
            # Create audit record for manual edit
            with connections['default'].cursor() as cursor:
                cursor.execute("""
                    INSERT INTO statement_audio_audit (
                        vendor_id, case_id, check_type,
                        audio_file, audio_mime_type, audio_size_bytes,
                        transcript_mr, translation_en, detected_language,
                        stt_provider, is_applied_to_check, applied_at, source
                    ) VALUES (
                        %s, %s, %s,
                        %s, %s, %s,
                        %s, %s, %s,
                        %s, %s, %s, %s
                    ) RETURNING id
                """, [
                    vendor_id, case_id, check_type.lower(),
                    '', 'text/plain', len(edited_english_text),
                    transcript_mr, edited_english_text, 'mr',
                    'manual', True, datetime.now(), 'manual_edit',
                ])
                audit_id = cursor.fetchone()[0]

            # Update transcript columns
            _update_check_transcript_columns(
                table_name=table_name,
                check_id=check_id,
                audio_path=None,  # No audio for manual edit
                transcript_mr=transcript_mr,
                transcript_en=edited_english_text,
                provider='manual',
                confidence=None,
            )

            # Update final statement column
            _update_final_statement_column(
                table_name=table_name,
                statement_column=statement_column,
                check_id=check_id,
                text=edited_english_text,
            )

        logger.info(
            f"[Statement] Manual text apply success: case={case_id}, check={check_type}, "
            f"audit_id={audit_id}, column={statement_column}"
        )

        return {
            "success": True,
            "audit_id": audit_id,
            "applied_text": edited_english_text[:200] + "..." if len(edited_english_text) > 200 else edited_english_text,
            "applied_to_column": statement_column,
        }

    except Exception as e:
        logger.exception(f"[Statement] Unexpected error in manual text apply: {e}")
        return 500, {"error": "Failed to save statement. Please try again."}
