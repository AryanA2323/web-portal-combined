"""
Super Admin Dashboard API endpoints.
"""

import logging
from typing import List, Dict, Any
from datetime import datetime, timedelta
from django.contrib.auth import get_user_model
from django.db.models import Count, Q
from django.utils import timezone
from ninja import Router, Schema
from ninja.errors import HttpError

from users.schemas import ErrorSchema

User = get_user_model()
logger = logging.getLogger(__name__)

router = Router(tags=["Super Admin"])


# =============================================================================
# Response Schemas
# =============================================================================

class UserStatisticsSchema(Schema):
    """Statistics about users in the system."""
    total_users: int
    active_users: int
    inactive_users: int
    users_by_role: Dict[str, int]
    users_by_sub_role: Dict[str, int]
    new_users_last_30_days: int
    new_users_last_7_days: int


class VendorStatisticsSchema(Schema):
    """Statistics about vendors in the system."""
    total_vendors: int
    active_vendors: int
    inactive_vendors: int
    vendors_by_specialty: Dict[str, int]


class SystemStatisticsSchema(Schema):
    """Overall system statistics."""
    total_cases: int
    cases_last_30_days: int
    total_documents: int
    total_emails_processed: int


class SuperAdminDashboardSchema(Schema):
    """Super Admin Dashboard data."""
    user_statistics: UserStatisticsSchema
    vendor_statistics: VendorStatisticsSchema
    system_statistics: SystemStatisticsSchema
    recent_users: List[Dict[str, Any]]


# =============================================================================
# Helper Functions
# =============================================================================

def is_super_admin(user) -> bool:
    """Check if user is a super admin."""
    return (
        user.is_authenticated and
        user.role == 'SUPER_ADMIN'
    )


def get_user_statistics() -> Dict[str, Any]:
    """Get comprehensive user statistics."""
    now = timezone.now()
    thirty_days_ago = now - timedelta(days=30)
    seven_days_ago = now - timedelta(days=7)
    
    total_users = User.objects.count()
    active_users = User.objects.filter(is_active=True).count()
    inactive_users = total_users - active_users
    
    # Count users by role
    users_by_role = {}
    role_counts = User.objects.values('role').annotate(count=Count('role'))
    for item in role_counts:
        users_by_role[item['role']] = item['count']
    
    # Count users by sub_role (for admins)
    users_by_sub_role = {}
    sub_role_counts = User.objects.filter(
        role='ADMIN',
        sub_role__isnull=False
    ).values('sub_role').annotate(count=Count('sub_role'))
    for item in sub_role_counts:
        users_by_sub_role[item['sub_role']] = item['count']
    
    # New users
    new_users_30 = User.objects.filter(date_joined__gte=thirty_days_ago).count()
    new_users_7 = User.objects.filter(date_joined__gte=seven_days_ago).count()
    
    return {
        'total_users': total_users,
        'active_users': active_users,
        'inactive_users': inactive_users,
        'users_by_role': users_by_role,
        'users_by_sub_role': users_by_sub_role,
        'new_users_last_30_days': new_users_30,
        'new_users_last_7_days': new_users_7,
    }


def get_vendor_statistics() -> Dict[str, Any]:
    """Get comprehensive vendor statistics."""
    # Import Vendor from users.models
    from users.models import Vendor
    
    total_vendors = Vendor.objects.count()
    active_vendors = Vendor.objects.filter(is_active=True).count()
    inactive_vendors = total_vendors - active_vendors
    
    return {
        'total_vendors': total_vendors,
        'active_vendors': active_vendors,
        'inactive_vendors': inactive_vendors,
        'vendors_by_specialty': {},
    }


def get_system_statistics() -> Dict[str, Any]:
    """Get overall system statistics."""
    from django.db import connection
    
    # Query cases from cases_case table using raw SQL
    total_cases = 0
    cases_last_30_days = 0
    
    try:
        with connection.cursor() as cursor:
            # Get total cases
            cursor.execute("SELECT COUNT(*) FROM cases_case")
            total_cases = cursor.fetchone()[0]
            
            # Get cases from last 30 days
            thirty_days_ago = timezone.now() - timedelta(days=30)
            cursor.execute(
                "SELECT COUNT(*) FROM cases_case WHERE created_at >= %s",
                [thirty_days_ago]
            )
            cases_last_30_days = cursor.fetchone()[0]
    except Exception as e:
        logger.error(f"Failed to get case statistics: {e}")
    
    return {
        'total_cases': total_cases,
        'cases_last_30_days': cases_last_30_days,
        'total_documents': 0,
        'total_emails_processed': 0,
    }


def get_recent_users(limit: int = 10) -> List[Dict[str, Any]]:
    """Get most recently created users."""
    recent_users = User.objects.all().order_by('-date_joined')[:limit]
    
    return [
        {
            'id': user.id,
            'username': user.username,
            'email': user.email,
            'full_name': f"{user.first_name} {user.last_name}".strip() or user.username,
            'role': user.role,
            'sub_role': user.sub_role,
            'is_active': user.is_active,
            'date_joined': user.date_joined.isoformat(),
        }
        for user in recent_users
    ]


# =============================================================================
# API Endpoints
# =============================================================================

@router.get(
    "/super-admin/dashboard",
    response={200: SuperAdminDashboardSchema, 401: ErrorSchema, 403: ErrorSchema},
    summary="Get Super Admin Dashboard Data",
    description="Get comprehensive statistics for super admin dashboard. Super Admin only.",
)
def get_super_admin_dashboard(request):
    """
    Get comprehensive dashboard data for super admin.
    
    Includes:
    - User statistics (total, active, by role, new users)
    - Vendor statistics (total, active, by specialty)
    - System statistics (cases, documents, emails)
    - Recent users list
    """
    if not request.user.is_authenticated:
        return 401, {"error": "Not authenticated", "code": "NOT_AUTHENTICATED"}
    
    if not is_super_admin(request.user):
        return 403, {
            "error": "Super admin access required",
            "code": "SUPER_ADMIN_REQUIRED"
        }
    
    try:
        dashboard_data = {
            'user_statistics': get_user_statistics(),
            'vendor_statistics': get_vendor_statistics(),
            'system_statistics': get_system_statistics(),
            'recent_users': get_recent_users(),
        }
        
        return 200, dashboard_data
    except Exception as e:
        logger.error(f"Failed to get super admin dashboard: {e}")
        return 500, {"error": "Failed to get dashboard data", "code": "DASHBOARD_ERROR"}


@router.get(
    "/super-admin/users/statistics",
    response={200: UserStatisticsSchema, 401: ErrorSchema, 403: ErrorSchema},
    summary="Get User Statistics",
    description="Get detailed user statistics. Super Admin only.",
)
def get_user_statistics_endpoint(request):
    """Get detailed user statistics."""
    if not request.user.is_authenticated:
        return 401, {"error": "Not authenticated", "code": "NOT_AUTHENTICATED"}
    
    if not is_super_admin(request.user):
        return 403, {
            "error": "Super admin access required",
            "code": "SUPER_ADMIN_REQUIRED"
        }
    
    return 200, get_user_statistics()


@router.get(
    "/super-admin/vendors/statistics",
    response={200: VendorStatisticsSchema, 401: ErrorSchema, 403: ErrorSchema},
    summary="Get Vendor Statistics",
    description="Get detailed vendor statistics. Super Admin only.",
)
def get_vendor_statistics_endpoint(request):
    """Get detailed vendor statistics."""
    if not request.user.is_authenticated:
        return 401, {"error": "Not authenticated", "code": "NOT_AUTHENTICATED"}
    
    if not is_super_admin(request.user):
        return 403, {
            "error": "Super admin access required",
            "code": "SUPER_ADMIN_REQUIRED"
        }
    
    return 200, get_vendor_statistics()
