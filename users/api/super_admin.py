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
    total_clients: int = 0
    active_clients: int = 0


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
    case_managers: List[Dict[str, Any]] = []
    activity_logs: List[Dict[str, Any]] = []
    tat_logs: List[Dict[str, Any]] = []
    deletion_logs: List[Dict[str, Any]] = []


# =============================================================================
# Helper Functions
# =============================================================================

def is_super_admin(user) -> bool:
    """Check if user is a super admin."""
    return (
        user.is_authenticated and
        user.role == 'SUPER_ADMIN'
    )


def get_dashboard_logs_data() -> Dict[str, Any]:
    """Fetch real case manager activity logs, TAT logs, deletion logs, and case managers."""
    from users.models import ActivityLog, TatChangeRequest, CaseDeletionRequest, Report
    from django.db import connection
    
    # 1. Fetch Case Managers list
    case_managers = list(User.objects.filter(role='CASE_MANAGER').values('id', 'first_name', 'last_name', 'email', 'sub_role'))
    for cm in case_managers:
        cm['name'] = f"{cm['first_name'] or ''} {cm['last_name'] or ''}".strip() or cm['email']

    default_cm = case_managers[0] if case_managers else None

    # 2. Case Manager Activity Logs (Exclude LOGIN, LOGOUT, FORCE_LOGOUT)
    activity_logs = []
    
    # A) ActivityLog table entries (profile updates, user edits, password changes, etc.)
    try:
        excluded_actions = ['LOGIN', 'LOGOUT', 'FORCE_LOGOUT']
        act_qs = ActivityLog.objects.exclude(action__in=excluded_actions).select_related('user').order_by('-created_at')[:30]
        for act in act_qs:
            actor_name = f"{act.user.first_name or ''} {act.user.last_name or ''}".strip() or act.user.email if act.user else "Case Manager"
            activity_logs.append({
                "id": f"act-{act.id}",
                "user_id": act.user_id,
                "actor": actor_name,
                "role": act.user.role if act.user else "CASE_MANAGER",
                "action": act.action,
                "details": act.details or f"{act.action} by {actor_name}",
                "created_at": act.created_at.isoformat() if act.created_at else None,
            })
    except Exception as e:
        logger.warning(f"Failed to load ActivityLog: {e}")

    # B) Report Generation & QC Assignment events from reports table
    try:
        reports_qs = Report.objects.select_related('created_by', 'assigned_qc').order_by('-created_at')[:20]
        for r in reports_qs:
            cm_user = r.created_by or default_cm
            cm_id = cm_user.id if hasattr(cm_user, 'id') else (cm_user['id'] if isinstance(cm_user, dict) else None)
            actor_name = (f"{r.created_by.first_name or ''} {r.created_by.last_name or ''}".strip() or r.created_by.email) if r.created_by else (default_cm['name'] if default_cm else "Case Manager")
            
            if r.assigned_qc:
                qc_name = f"{r.assigned_qc.first_name or ''} {r.assigned_qc.last_name or ''}".strip() or r.assigned_qc.email
                desc = f"Assigned Quality Analyst '{qc_name}' for case #{r.case_id}"
                action_name = "QC_ASSIGNED"
            else:
                desc = f"Generated investigation report for case #{r.case_id} ({r.status})"
                action_name = "REPORT_GENERATED"

            activity_logs.append({
                "id": f"rep-{r.id}",
                "user_id": cm_id,
                "actor": actor_name,
                "role": "CASE_MANAGER",
                "action": action_name,
                "details": desc,
                "created_at": r.created_at.isoformat() if r.created_at else None,
            })
    except Exception as e:
        logger.warning(f"Failed to load report activity: {e}")

    # C) Case creation events from cases table
    try:
        with connection.cursor() as cursor:
            cursor.execute("SELECT id, case_number, claim_number, client_name, created_at FROM cases ORDER BY created_at DESC LIMIT 15")
            for c_id, case_num, claim_num, client_name, c_created_at in cursor.fetchall():
                cm_id = default_cm['id'] if default_cm else None
                actor_name = default_cm['name'] if default_cm else "Case Manager"
                clean_client = (client_name or "").split(" - ")[0].strip() or "Client"
                activity_logs.append({
                    "id": f"case-create-{c_id}",
                    "user_id": cm_id,
                    "actor": actor_name,
                    "role": "CASE_MANAGER",
                    "action": "CASE_CREATED",
                    "details": f"Created case #{case_num or c_id} (Claim: {claim_num or 'N/A'}) for {clean_client}",
                    "created_at": c_created_at.isoformat() if c_created_at else None,
                })
    except Exception as e:
        logger.warning(f"Failed to load case creation activity: {e}")

    # D) Business Partner assignment from claimant_checks
    try:
        with connection.cursor() as cursor:
            cursor.execute("""
                SELECT cc.case_id, cc.claimant_name, u.first_name, u.last_name, u.email, cc.created_at
                FROM claimant_checks cc
                JOIN users_customuser u ON cc.assigned_vendor_id = u.id
                WHERE cc.assigned_vendor_id IS NOT NULL
                ORDER BY cc.created_at DESC LIMIT 15
            """)
            for case_id, claimant_name, v_first, v_last, v_email, v_created_at in cursor.fetchall():
                cm_id = default_cm['id'] if default_cm else None
                actor_name = default_cm['name'] if default_cm else "Case Manager"
                v_name = f"{v_first or ''} {v_last or ''}".strip() or v_email or "Business Partner"
                activity_logs.append({
                    "id": f"vendor-assign-{case_id}-{v_name}",
                    "user_id": cm_id,
                    "actor": actor_name,
                    "role": "CASE_MANAGER",
                    "action": "VENDOR_ASSIGNED",
                    "details": f"Assigned Business Partner '{v_name}' to verify claimant for case #{case_id}",
                    "created_at": v_created_at.isoformat() if v_created_at else None,
                })
    except Exception as e:
        logger.warning(f"Failed to load vendor assignment activity: {e}")

    # Sort all activity logs chronologically descending
    def _parse_time(t):
        if not t:
            return 0
        try:
            return datetime.fromisoformat(t).timestamp()
        except Exception:
            return 0

    activity_logs.sort(key=lambda x: _parse_time(x['created_at']), reverse=True)

    # 3. TAT Change Logs
    tat_logs = []
    try:
        tat_qs = TatChangeRequest.objects.select_related('requested_by', 'reviewed_by').order_by('-requested_at')[:10]
        for tr in tat_qs:
            req_name = f"{tr.requested_by.first_name or ''} {tr.requested_by.last_name or ''}".strip() if tr.requested_by else "Case Manager"
            rev_name = f"{tr.reviewed_by.first_name or ''} {tr.reviewed_by.last_name or ''}".strip() if tr.reviewed_by else None
            tat_logs.append({
                "id": tr.id,
                "case_id": tr.case_id,
                "requested_by": req_name,
                "current_tat_days": getattr(tr, 'current_tat_days', None),
                "updated_tat_days": getattr(tr, 'updated_tat_days', None),
                "reason": tr.reason or "N/A",
                "status": tr.status,
                "reviewed_by": rev_name,
                "requested_at": tr.requested_at.isoformat() if tr.requested_at else None,
                "reviewed_at": tr.reviewed_at.isoformat() if tr.reviewed_at else None,
            })
    except Exception as e:
        logger.warning(f"Failed to load TAT logs: {e}")

    # 4. Case Deletion Change Logs
    deletion_logs = []
    try:
        del_qs = CaseDeletionRequest.objects.select_related('requested_by', 'reviewed_by').order_by('-requested_at')[:10]
        for dr in del_qs:
            req_name = f"{dr.requested_by.first_name or ''} {dr.requested_by.last_name or ''}".strip() if dr.requested_by else "Case Manager"
            rev_name = f"{dr.reviewed_by.first_name or ''} {dr.reviewed_by.last_name or ''}".strip() if dr.reviewed_by else None
            deletion_logs.append({
                "id": dr.id,
                "case_id": dr.case_id,
                "case_number": getattr(dr, 'case_number', None) or dr.case_id,
                "requested_by": req_name,
                "reason": dr.reason or "N/A",
                "status": dr.status,
                "reviewed_by": rev_name,
                "requested_at": dr.requested_at.isoformat() if dr.requested_at else None,
                "reviewed_at": dr.reviewed_at.isoformat() if dr.reviewed_at else None,
            })
    except Exception as e:
        logger.warning(f"Failed to load deletion logs: {e}")

    return {
        "case_managers": case_managers,
        "activity_logs": activity_logs,
        "tat_logs": tat_logs,
        "deletion_logs": deletion_logs,
    }


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
    
    # Count users by sub_role (for caseManagers)
    users_by_sub_role = {}
    sub_role_counts = User.objects.filter(
        role='CASE_MANAGER',
        sub_role__isnull=False
    ).values('sub_role').annotate(count=Count('sub_role'))
    for item in sub_role_counts:
        users_by_sub_role[item['sub_role']] = item['count']
    
    # New users
    new_users_30 = User.objects.filter(date_joined__gte=thirty_days_ago).count()
    new_users_7 = User.objects.filter(date_joined__gte=seven_days_ago).count()

    try:
        from users.models import Client
        total_clients = Client.objects.count() or users_by_role.get('CLIENT', 0)
        active_clients = Client.objects.filter(is_active=True).count() if Client.objects.exists() else User.objects.filter(role='CLIENT', is_active=True).count()
    except Exception:
        total_clients = users_by_role.get('CLIENT', 0)
        active_clients = User.objects.filter(role='CLIENT', is_active=True).count()

    return {
        'total_users': total_users,
        'active_users': active_users,
        'inactive_users': inactive_users,
        'users_by_role': users_by_role,
        'users_by_sub_role': users_by_sub_role,
        'new_users_last_30_days': new_users_30,
        'new_users_last_7_days': new_users_7,
        'total_clients': total_clients,
        'active_clients': active_clients,
    }


def get_vendor_statistics() -> Dict[str, Any]:
    """Get comprehensive vendor statistics."""
    total_vendors = User.objects.filter(role='VENDOR').count()
    active_vendors = User.objects.filter(role='VENDOR', is_active=True).count()
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
    
    # Query cases from insurance_case using raw SQL
    total_cases = 0
    cases_last_30_days = 0
    
    try:
        with connection.cursor() as cursor:
            # Get total cases
            cursor.execute("SELECT COUNT(*) FROM insurance_case")
            total_cases = cursor.fetchone()[0]
            
            # Get cases from last 30 days
            thirty_days_ago = timezone.now() - timedelta(days=30)
            cursor.execute(
                "SELECT COUNT(*) FROM insurance_case WHERE created_at >= %s",
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
        logs_data = get_dashboard_logs_data()
        dashboard_data = {
            'user_statistics': get_user_statistics(),
            'vendor_statistics': get_vendor_statistics(),
            'system_statistics': get_system_statistics(),
            'recent_users': get_recent_users(),
            'case_managers': logs_data['case_managers'],
            'activity_logs': logs_data['activity_logs'],
            'tat_logs': logs_data['tat_logs'],
            'deletion_logs': logs_data['deletion_logs'],
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


@router.get(
    "/super-admin/notifications",
    response={200: List[Dict[str, Any]], 401: ErrorSchema, 403: ErrorSchema},
    summary="Get Super Admin Activity Notifications",
    description="Get Super Admin activity logs including user modifications, approvals, client changes, etc.",
)
def get_super_admin_notifications_endpoint(request, limit: int = 50):
    if not request.user.is_authenticated:
        return 401, {"error": "Not authenticated", "code": "NOT_AUTHENTICATED"}
    
    if not is_super_admin(request.user):
        return 403, {
            "error": "Super admin access required",
            "code": "SUPER_ADMIN_REQUIRED"
        }

    from users.models import ActivityLog, TatChangeRequest, Client

    logs = []
    
    # 1. Fetch ActivityLog records strictly matching allowed notification actions
    # NOTE: TAT and Case Deletion events are fetched separately from their dedicated tables (section 3)
    allowed_actions = [
        'USER_CREATED', 'USER_UPDATED', 'USER_DELETED',
        'CLIENT_CREATED', 'CLIENT_UPDATED', 'CLIENT_DELETED',
        'APPROVAL', 'REJECTION'
    ]

    activity_logs = ActivityLog.objects.filter(
        action__in=allowed_actions
    ).select_related('user').order_by('-created_at')[:limit]

    import re

    # Pre-fetch case numbers from activity log details
    act_case_ids = []
    for act in activity_logs:
        if act.details:
            cm = re.search(r"case #(\d+)", act.details)
            if cm:
                act_case_ids.append(cm.group(1))
                
    act_case_numbers = {}
    if act_case_ids:
        try:
            from django.db import connection as db_conn
            cursor = db_conn.cursor()
            placeholders = ','.join(['%s'] * len(act_case_ids))
            cursor.execute(f"SELECT id, case_number FROM cases WHERE id IN ({placeholders})", act_case_ids)
            for row in cursor.fetchall():
                act_case_numbers[str(row[0])] = row[1]
        except Exception:
            pass

    for act in activity_logs:
        actor_name = f"{act.user.first_name} {act.user.last_name}".strip() or act.user.email or act.user.username if act.user else "System"
        
        target_email = None
        if not act.action.startswith('CLIENT_'):
            if act.details:
                email_match = re.search(r"([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})", act.details)
                if email_match:
                    target_email = email_match.group(1)
                else:
                    quote_match = re.search(r"'([^']+)'", act.details)
                    if quote_match:
                        target_email = quote_match.group(1)

            if not target_email and act.user and act.action not in ['USER_CREATED', 'USER_UPDATED', 'USER_DELETED']:
                target_email = act.user.email

        target_name = None
        if target_email:
            try:
                from django.contrib.auth import get_user_model
                from django.db.models import Q
                UserModel = get_user_model()
                t_user = UserModel.objects.filter(
                    Q(email__iexact=target_email) |
                    Q(username__iexact=target_email) |
                    Q(first_name__icontains=target_email.split()[0])
                ).first()
                if t_user:
                    target_email = t_user.email
                    target_name = f"{t_user.first_name} {t_user.last_name}".strip() or t_user.username or t_user.email
            except Exception:
                pass

        desc = act.details or f"{act.action} by {actor_name}"
        if act.action in ['USER_UPDATED', 'CLIENT_UPDATED'] and act.details:
            if ". Changes: " in desc:
                desc = desc.replace(". Changes: ", "\nChanges: ")
            elif " (Changes: " in desc:
                desc = desc.replace(" (Changes: ", "\nChanges: ").rstrip(")")
            if ". (No fields changed)" in desc:
                desc = desc.replace(". (No fields changed)", "\n(No fields changed)")

        if act.action in ['TAT_APPROVED', 'TAT_REJECTED', 'TAT_REQUESTED', 'CASE_DELETION_APPROVED', 'CASE_DELETION_REJECTED', 'CASE_DELETION_REQUESTED']:
            case_match = re.search(r"case #(\d+)", desc)
            if case_match:
                case_id = case_match.group(1)
                c_num = act_case_numbers.get(case_id)
                case_display = c_num if c_num else f"{case_id}"
                desc = desc.replace(f"case #{case_id}", f"case {case_display}")

        if target_email and target_name and target_name != target_email:
            desc = desc.replace(target_email, target_name)

        logs.append({
            "id": f"act-{act.id}",
            "description": desc,
            "actor": actor_name,
            "event_time": act.created_at.isoformat() if act.created_at else None,
            "event_type": act.action,
            "target_user_email": target_email,
            "target_user_id": act.user.id if act.user else None,
        })

    # 2. Fetch User creations/registrations directly (skip if already captured by ActivityLog)
    logged_user_creations = set()
    for act in activity_logs:
        if act.action == 'USER_CREATED' and act.details:
            email_match = re.search(r"([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})", act.details)
            if email_match:
                logged_user_creations.add(email_match.group(1).lower())
            quote_match = re.search(r"'([^']+)'", act.details)
            if quote_match:
                logged_user_creations.add(quote_match.group(1).lower())

    users_qs = User.objects.all().order_by('-date_joined')[:limit]
    for u in users_qs:
        u_email = (u.email or '').lower()
        u_name = (f"{u.first_name} {u.last_name}".strip() or u.username or '').lower()
        if (u_email and u_email in logged_user_creations) or (u_name and u_name in logged_user_creations):
            continue

        name = f"{u.first_name} {u.last_name}".strip() or u.email or u.username
        role_label = u.sub_role or u.role or "USER"
        logs.append({
            "id": f"usr-join-{u.id}",
            "description": f"User '{name}' registered / created with role '{role_label}'",
            "actor": name,
            "event_time": u.date_joined.isoformat() if u.date_joined else None,
            "event_type": "USER_CREATED",
            "target_user_email": u.email,
            "target_user_id": u.id,
        })

    # 3. Fetch TAT Change Requests / Approvals
    try:
        tat_reqs = TatChangeRequest.objects.select_related('requested_by', 'reviewed_by').order_by('-requested_at')[:limit]
        
        # Pre-fetch case numbers from the raw 'cases' table (case_id references 'cases' table, not 'insurance_case')
        case_ids = [str(tr.case_id) for tr in tat_reqs if tr.case_id]
        case_numbers = {}
        if case_ids:
            try:
                from django.db import connection as db_conn
                cursor = db_conn.cursor()
                placeholders = ','.join(['%s'] * len(case_ids))
                cursor.execute(f"SELECT id, case_number FROM cases WHERE id IN ({placeholders})", case_ids)
                for row in cursor.fetchall():
                    case_numbers[str(row[0])] = row[1]
            except Exception:
                pass

        for tr in tat_reqs:
            if tr.requested_by:
                req_name = f"{tr.requested_by.first_name} {tr.requested_by.last_name}".strip() or tr.requested_by.username or tr.requested_by.email
            else:
                req_name = "System"
                
            old_tat = tr.current_tat_days if tr.current_tat_days is not None else 'N/A'
            new_tat = tr.updated_tat_days if tr.updated_tat_days is not None else 'N/A'
            c_num = case_numbers.get(str(tr.case_id))
            case_display = c_num if c_num else f"{tr.case_id}"
            
            logs.append({
                "id": f"tat-req-{tr.id}",
                "description": f"TAT change requested for case {case_display}\nReason: {tr.reason or 'N/A'}\nChanges: from {old_tat} to {new_tat} days",
                "actor": req_name,
                "event_time": tr.requested_at.isoformat() if tr.requested_at else None,
                "event_type": "TAT_REQUESTED",
                "case_id": tr.case_id,
            })
            if tr.reviewed_at and tr.status in ['APPROVED', 'REJECTED']:
                if tr.reviewed_by:
                    rev_name = f"{tr.reviewed_by.first_name} {tr.reviewed_by.last_name}".strip() or tr.reviewed_by.username or tr.reviewed_by.email
                else:
                    rev_name = "Super Admin"
                logs.append({
                    "id": f"tat-rev-{tr.id}",
                    "description": f"TAT change request for case {case_display} was {tr.status.lower()} by {rev_name}\nChanges: from {old_tat} to {new_tat} days",
                    "actor": rev_name,
                    "event_time": tr.reviewed_at.isoformat() if tr.reviewed_at else None,
                    "event_type": f"TAT_{tr.status}",
                    "case_id": tr.case_id,
                })
    except Exception as e:
        logger.warning(f"Error loading TAT request notifications: {e}")

    # 4. Client creation/update events are captured via ActivityLog (CLIENT_CREATED, CLIENT_UPDATED)
    # No need to add static Client model records here — they lack real event timestamps.

    # Helper to parse various timestamp formats into a comparable datetime
    def _parse_time(t):
        if not t:
            return timezone.now() - timedelta(days=365)
        if isinstance(t, str):
            try:
                dt = datetime.fromisoformat(t.replace('Z', '+00:00'))
                return dt if timezone.is_aware(dt) else timezone.make_aware(dt)
            except Exception:
                try:
                    dt = datetime.strptime(t[:10], '%Y-%m-%d')
                    return timezone.make_aware(dt)
                except Exception:
                    return timezone.now() - timedelta(days=365)
        if isinstance(t, datetime):
            return t if timezone.is_aware(t) else timezone.make_aware(t)
        if hasattr(t, 'year'):
            return timezone.make_aware(datetime.combine(t, datetime.min.time()))
        return timezone.now() - timedelta(days=365)

    # Deduplicate and sort newest first
    seen_ids = set()
    unique_logs = []
    for item in logs:
        if not item.get("event_time"):
            continue
        if item["id"] in seen_ids:
            continue
        seen_ids.add(item["id"])
        unique_logs.append(item)

    unique_logs.sort(key=lambda x: _parse_time(x["event_time"]), reverse=True)
    return 200, unique_logs[:limit]
