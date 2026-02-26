"""
Cases API endpoints.
"""

import logging
from typing import List, Optional
from datetime import datetime
from ninja import Router, Schema
from ninja.errors import HttpError
from ninja.pagination import paginate, PageNumberPagination
from django.db import connection, connections
from django.http import HttpRequest

logger = logging.getLogger(__name__)

router = Router(tags=["Cases"])


# =============================================================================
# Schemas
# =============================================================================

class ClientSchema(Schema):
    """Client response schema for dropdown."""
    id: int
    client_code: str
    client_name: str
    location: str


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
    case_receipt_date: Optional[str] = None
    receipt_month: Optional[str] = None
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


class CreateCaseSchema(Schema):
    """Schema for creating a new case."""
    # ---- Common fields (filled at top of New Case page) ----
    claim_number: str
    client_name: str = ''
    category: str = 'MACT'
    case_receipt_date: Optional[str] = None  # ISO date string YYYY-MM-DD
    receipt_month: str = ''
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

            if search:
                conditions.append(
                    "(c.claim_number ILIKE %s OR c.client_name ILIKE %s OR c.category ILIKE %s)"
                )
                sp = f"%{search}%"
                params.extend([sp, sp, sp])

            where = " AND ".join(conditions) if conditions else "1=1"

            # ── Total count ─────────────────────────────────────────────────
            cursor.execute(f"SELECT COUNT(*) FROM cases c WHERE {where}", params)
            total = cursor.fetchone()[0]

            # ── Paginated rows with sequential row number ───────────────────
            offset = (page - 1) * page_size
            cursor.execute(f"""
                SELECT
                    ROW_NUMBER() OVER (ORDER BY c.id) AS seq_num,
                    c.*
                FROM cases c
                WHERE {where}
                ORDER BY c.id
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


# ---------------------------------------------------------------------------
# CHECK DETAIL & UPDATE  (incident_case_db)
# ---------------------------------------------------------------------------

_CHECK_TABLE_MAP = {
    'claimant':    'claimant_checks',
    'insured':     'insured_checks',
    'driver':      'driver_checks',
    'spot':        'spot_checks',
    'chargesheet': 'chargesheets',
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
        raise HttpError(400, f"Unknown check type '{check_type}'. Valid: claimant, insured, driver, spot, chargesheet")

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
        'case_receipt_date', 'receipt_month',
        'completion_date', 'completion_month',
        'case_due_date', 'tat_days', 'sla',
        'case_type', 'investigation_report_status',
        'full_case_status', 'scope_of_work',
    }

    # Per-table updatable fields
    CHECK_FIELDS = {
        'claimant_checks': {
            'claimant_name', 'claimant_contact', 'claimant_address',
            'claimant_income', 'check_status', 'statement', 'observation',
        },
        'insured_checks': {
            'insured_name', 'insured_contact', 'insured_address',
            'policy_number', 'policy_period', 'rc', 'permit',
            'check_status', 'statement', 'observation',
        },
        'driver_checks': {
            'driver_name', 'driver_contact', 'driver_address',
            'dl', 'permit', 'occupation',
            'check_status', 'statement', 'observation',
        },
        'spot_checks': {
            'time_of_accident', 'place_of_accident', 'district',
            'fir_number', 'police_station', 'accident_brief',
            'check_status', 'observations',
        },
        'chargesheets': {
            'fir_number', 'court_name', 'mv_act', 'fir_delay_days',
            'bsn_section', 'ipc',
            'check_status', 'statement', 'observations',
        },
    }

    try:
        payload = _json.loads(request.body or b'{}')
    except _json.JSONDecodeError:
        raise HttpError(400, "Invalid JSON body")

    case_updates = payload.get('case', {})
    check_updates = payload.get('check', {})

    try:
        with connections['default'].cursor() as cursor:
            # Verify case exists
            cursor.execute("SELECT id FROM cases WHERE id = %s", [case_id])
            if not cursor.fetchone():
                raise HttpError(404, f"Case id={case_id} not found")

            # ── Update cases table ────────────────────────────────────────
            safe_case = {k: v for k, v in case_updates.items() if k in CASE_FIELDS}
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
                }.get(table)
                lat_col = {'claimant_checks': 'claimant_lat', 'insured_checks': 'insured_lat', 'driver_checks': 'driver_lat', 'spot_checks': 'spot_lat'}.get(table)
                lng_col = {'claimant_checks': 'claimant_lng', 'insured_checks': 'insured_lng', 'driver_checks': 'driver_lng', 'spot_checks': 'spot_lng'}.get(table)
                if addr_col and lat_col and addr_col in safe_check:
                    new_addr = safe_check[addr_col]
                    if table == 'spot_checks' and 'district' in safe_check:
                        new_addr = f"{safe_check.get('place_of_accident','')}, {safe_check.get('district','')}"
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
        raise HttpError(400, f"Unknown check type '{check_type}'. Valid: claimant, insured, driver, spot, chargesheet")

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
        
        # Generate case number
        case_number = f"CASE-{uuid.uuid4().hex[:8].upper()}"
        
        # Auto-generate title from claim_number + client_name if not provided
        title = payload.title or f"Case {payload.claim_number} - {payload.client_name or 'New Case'}"
        
        # Format address from components
        addr_parts = [p for p in [payload.incident_address, payload.incident_city, payload.incident_state, payload.incident_postal_code, payload.incident_country] if p]
        formatted_address = ", ".join(addr_parts) if addr_parts else ''
        
        # Parse date fields (ISO string -> date object)
        case_receipt_date = None
        if payload.case_receipt_date:
            case_receipt_date = dt.strptime(payload.case_receipt_date, '%Y-%m-%d').date()
        
        completion_date_val = None
        if payload.completion_date:
            completion_date_val = dt.strptime(payload.completion_date, '%Y-%m-%d').date()
        
        case_due_date_val = None
        if payload.case_due_date:
            case_due_date_val = dt.strptime(payload.case_due_date, '%Y-%m-%d').date()
        
        # Auto-compute receipt_month from case_receipt_date
        receipt_month = payload.receipt_month
        if not receipt_month and case_receipt_date:
            receipt_month = case_receipt_date.strftime('%B %Y')
        
        # Auto-compute completion_month from completion_date
        completion_month = payload.completion_month
        if not completion_month and completion_date_val:
            completion_month = completion_date_val.strftime('%B %Y')
        
        # Auto-compute TAT if dates available and not manually set
        tat_days = payload.tat_days
        if tat_days is None and case_receipt_date and completion_date_val:
            tat_days = (completion_date_val - case_receipt_date).days

        # ── PRIMARY write: incident_case_db.cases ────────────────────────────
        # This is the table the Cases page reads from. Write here first so the
        # UI is always in sync.  Any failure here aborts the whole request.
        incident_case_db_id = insert_case(
            claim_number=payload.claim_number,
            client_name=payload.client_name,
            category=payload.category,
            case_receipt_date=case_receipt_date,
            receipt_month=receipt_month or '',
            completion_date=completion_date_val,
            completion_month=completion_month or '',
            case_due_date=case_due_date_val,
            tat_days=tat_days,
            sla=payload.sla_status,           # maps to `sla` column
            case_type=payload.case_type,
            investigation_report_status=payload.investigation_report_status,
            full_case_status=payload.full_case_status,
            scope_of_work=payload.scope_of_work,
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
                case_receipt_date=case_receipt_date,
                receipt_month=receipt_month,
                completion_date=completion_date_val,
                completion_month=completion_month,
                case_due_date=case_due_date_val,
                tat_days=tat_days,
                sla_status=payload.sla_status,
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
