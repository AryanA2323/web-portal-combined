"""
Vendor cases API endpoints.
Endpoints for vendors to manage their assigned cases.
"""

import logging
from typing import List, Optional
from datetime import datetime
from ninja import Router, Schema
from django.db import connection
from django.http import HttpRequest
from django.contrib.auth import get_user_model

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
            # Build WHERE clause
            where_conditions = [f"assigned_vendor_id = {vendor_id}"]
            params = []
            
            if status:
                where_conditions.append("status = %s")
                params.append(status)
            
            if search:
                where_conditions.append(
                    "(title ILIKE %s OR description ILIKE %s OR case_number ILIKE %s OR claim_number ILIKE %s)"
                )
                search_param = f"%{search}%"
                params.extend([search_param, search_param, search_param, search_param])
            
            where_clause = " AND ".join(where_conditions)
            
            # Get total count
            count_query = f"SELECT COUNT(*) FROM cases_case WHERE {where_clause}"
            cursor.execute(count_query, params)
            total = cursor.fetchone()[0]
            
            # Get paginated data
            offset = (page - 1) * page_size
            data_query = f"""
                SELECT * FROM cases_case 
                WHERE {where_clause}
                ORDER BY created_at DESC
                LIMIT %s OFFSET %s
            """
            cursor.execute(data_query, params + [page_size, offset])
            cases = dict_fetchall(cursor)
            
            # Get statistics
            stats_query = f"""
                SELECT 
                    COUNT(*) as total,
                    COUNT(CASE WHEN status = 'OPEN' THEN 1 END) as open,
                    COUNT(CASE WHEN status = 'IN_PROGRESS' THEN 1 END) as in_progress,
                    COUNT(CASE WHEN status = 'RESOLVED' THEN 1 END) as resolved,
                    COUNT(CASE WHEN status = 'CLOSED' THEN 1 END) as closed
                FROM cases_case 
                WHERE assigned_vendor_id = {vendor_id}
            """
            cursor.execute(stats_query)
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
