"""
Cases API endpoints.
"""

import logging
from typing import List, Optional
from datetime import datetime
from ninja import Router, Schema
from ninja.pagination import paginate, PageNumberPagination
from django.db import connection
from django.http import HttpRequest

logger = logging.getLogger(__name__)

router = Router(tags=["Cases"])


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
    # Checklist fields
    chk_spot: bool
    chk_hospital: bool
    chk_claimant: bool
    chk_insured: bool
    chk_witness: bool
    chk_driver: bool
    chk_dl: bool
    chk_rc: bool
    chk_permit: bool
    chk_court: bool
    chk_notice: bool
    chk_134_notice: bool
    chk_rti: bool
    chk_medical_verification: bool
    chk_income: bool


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
    title: str
    description: str
    category: str
    priority: str
    status: str = 'OPEN'
    claim_number: str
    client_code: str
    insured_name: str
    claimant_name: str
    incident_address: str
    incident_city: str
    incident_state: str
    incident_postal_code: str
    incident_country: str = 'India'
    latitude: Optional[float] = None
    longitude: Optional[float] = None


class CaseCreatedResponse(Schema):
    """Response schema for case creation."""
    id: int
    case_number: str
    title: str
    message: str


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
                where_conditions.append("status = %s")
                params.append(status)
            
            if category:
                where_conditions.append("category = %s")
                params.append(category)
            
            if search:
                where_conditions.append(
                    "(title ILIKE %s OR description ILIKE %s OR case_number ILIKE %s OR claim_number ILIKE %s)"
                )
                search_param = f"%{search}%"
                params.extend([search_param, search_param, search_param, search_param])
            
            where_clause = " AND ".join(where_conditions) if where_conditions else "1=1"
            
            # Get total count
            count_query = f"SELECT COUNT(*) FROM cases_case WHERE {where_clause}"
            cursor.execute(count_query, params)
            total = cursor.fetchone()[0]
            
            # Get paginated data with vendor name
            offset = (page - 1) * page_size
            data_query = f"""
                SELECT 
                    cc.*,
                    uv.company_name as assigned_vendor
                FROM cases_case cc
                LEFT JOIN users_vendor uv ON cc.assigned_vendor_id = uv.id
                WHERE {where_clause}
                ORDER BY cc.created_at DESC
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
            cursor.execute("SELECT * FROM cases_case WHERE id = %s", [case_id])
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
        from django.utils import timezone
        import uuid
        
        # Generate case number
        case_number = f"CASE-{uuid.uuid4().hex[:8].upper()}"
        
        with connection.cursor() as cursor:
            # Insert case into database with minimal required fields
            insert_query = """
                INSERT INTO cases_case (
                    case_number,
                    title,
                    description,
                    category,
                    priority,
                    status,
                    claim_number,
                    client_code,
                    insured_name,
                    claimant_name,
                    incident_address,
                    incident_city,
                    incident_state,
                    incident_postal_code,
                    incident_country,
                    latitude,
                    longitude,
                    formatted_address,
                    created_by_id,
                    client_id,
                    source,
                    workflow_type,
                    investigation_progress,
                    created_at,
                    updated_at,
                    chk_spot,
                    chk_hospital,
                    chk_claimant,
                    chk_insured,
                    chk_witness,
                    chk_driver,
                    chk_dl,
                    chk_rc,
                    chk_permit,
                    chk_court,
                    chk_notice,
                    chk_134_notice,
                    chk_rti,
                    chk_medical_verification,
                    chk_income
                ) VALUES (
                    %s, %s, %s, %s, %s, %s, %s, %s, %s, %s,
                    %s, %s, %s, %s, %s, %s, %s, %s, %s, %s,
                    %s, %s, %s, %s, %s, %s, %s, %s, %s, %s,
                    %s, %s, %s, %s, %s, %s, %s, %s, %s, %s
                ) RETURNING id
            """
            
            now = timezone.now()
            
            # Format address from components
            formatted_address = f"{payload.incident_address}, {payload.incident_city}, {payload.incident_state} {payload.incident_postal_code}, {payload.incident_country}"
            
            cursor.execute(insert_query, [
                case_number,
                payload.title,
                payload.description,
                payload.category,
                payload.priority,
                payload.status,
                payload.claim_number,
                payload.client_code,
                payload.insured_name,
                payload.claimant_name,
                payload.incident_address,
                payload.incident_city,
                payload.incident_state,
                payload.incident_postal_code,
                payload.incident_country,
                payload.latitude,
                payload.longitude,
                formatted_address,
                request.user.id,
                1,  # Default client_id
                'MANUAL',
                'STANDARD',
                0,  # investigation_progress
                now,
                now,
                False, False, False, False, False,  # chk_spot through chk_driver
                False, False, False, False, False,  # chk_dl through chk_notice
                False, False, False, False, False   # chk_134_notice through chk_income
            ])
            
            case_id = cursor.fetchone()[0]
            
            return 200, {
                "id": case_id,
                "case_number": case_number,
                "title": payload.title,
                "message": f"Case {case_number} created successfully"
            }
    
    except Exception as e:
        logger.error(f"Failed to create case: {e}")
        return 400, {"error": "Failed to create case", "detail": str(e)}


@router.get(
    "/dashboard/stats",
    response=CaseStatsSchema,
    summary="Get Dashboard Statistics",
    description="Get case statistics for the dashboard.",
)
def get_dashboard_stats(request: HttpRequest):
    """Get dashboard statistics."""
    if not is_admin_or_super_admin(request.user):
        return {
            "total_cases": 0,
            "active_investigations": 0,
            "completed_cases": 0,
            "overdue_cases": 0,
        }
    
    try:
        with connection.cursor() as cursor:
            # Total cases
            cursor.execute("SELECT COUNT(*) FROM cases_case")
            total_cases = cursor.fetchone()[0]
            
            # Active investigations (IN_PROGRESS status)
            cursor.execute("SELECT COUNT(*) FROM cases_case WHERE status = 'IN_PROGRESS'")
            active_investigations = cursor.fetchone()[0]
            
            # Completed cases (RESOLVED or CLOSED status)
            cursor.execute("SELECT COUNT(*) FROM cases_case WHERE status IN ('RESOLVED', 'CLOSED')")
            completed_cases = cursor.fetchone()[0]
            
            # For now, overdue_cases is 0 (would need due_date field)
            overdue_cases = 0
            
            # Pending cases (OPEN status)
            cursor.execute("SELECT COUNT(*) FROM cases_case WHERE status = 'OPEN'")
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
                FROM cases_case
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
                FROM cases_case
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
                FROM cases_case
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
                SELECT id, case_number, title, latitude, longitude, assigned_vendor_id
                FROM cases_case 
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
                UPDATE cases_case 
                SET assigned_vendor_id = %s 
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
