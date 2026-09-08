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
    """Fetch real case manager activity logs, deletion logs, and case managers."""
    from users.models import ActivityLog, CaseDeletionRequest, Report
    from django.db import connection
    
    # 1. Fetch Case Managers list (and active staff/admins)
    case_managers = list(User.objects.filter(role__in=['CASE_MANAGER', 'SUPER_ADMIN']).values('id', 'first_name', 'last_name', 'email', 'sub_role', 'role'))
    for cm in case_managers:
        cm['name'] = f"{cm['first_name'] or ''} {cm['last_name'] or ''}".strip() or cm['email']

    cm_by_id = {cm['id']: cm for cm in case_managers}
    cm_by_name = {cm['name'].lower(): cm for cm in case_managers if cm['name']}
    default_cm = case_managers[0] if case_managers else None

    activity_logs = []
    seen_log_keys = set()

    def _add_log_entry(log_id, user_id, actor_name, role_name, action_name, details_text, dt_val):
        if not dt_val:
            return
        
        iso_time = dt_val.isoformat() if hasattr(dt_val, 'isoformat') else str(dt_val)
        ts_minute = iso_time[:16]  # bucket by minute
        
        # Deduplication key
        dedup_key = (user_id, action_name, details_text, ts_minute)
        if dedup_key in seen_log_keys:
            return
        seen_log_keys.add(dedup_key)

        activity_logs.append({
            "id": str(log_id),
            "user_id": user_id,
            "actor": actor_name or "Case Manager",
            "role": role_name or "CASE_MANAGER",
            "action": action_name or "ACTIVITY",
            "details": details_text or "",
            "created_at": iso_time,
        })

    # A) Primary: case_activity_logs (tracks all case management events with actor_id)
    try:
        with connection.cursor() as cursor:
            cursor.execute("""
                SELECT
                    cal.id,
                    cal.actor_id,
                    COALESCE(NULLIF(cal.actor_name, ''), 'Case Manager') AS actor_name,
                    COALESCE(NULLIF(cal.actor_role, ''), 'CASE_MANAGER') AS actor_role,
                    cal.event_type,
                    cal.description,
                    COALESCE(NULLIF(c.case_number, ''), NULLIF(cal.case_number, ''), '') AS case_number,
                    cal.created_at
                FROM case_activity_logs cal
                LEFT JOIN cases c ON c.id = cal.case_id
                WHERE cal.created_at IS NOT NULL
                ORDER BY cal.created_at DESC
                LIMIT 1000
            """)
            for cal_id, actor_id, actor_name, actor_role, event_type, desc, case_num, created_at in cursor.fetchall():
                # Resolve user_id
                matched_user_id = actor_id
                if not matched_user_id and actor_name:
                    name_key = actor_name.strip().lower()
                    if name_key in cm_by_name:
                        matched_user_id = cm_by_name[name_key]['id']
                if not matched_user_id and default_cm:
                    matched_user_id = default_cm['id']

                _add_log_entry(
                    f"cal-{cal_id}",
                    matched_user_id,
                    actor_name,
                    actor_role,
                    event_type,
                    desc or f"Case #{case_num} updated",
                    created_at,
                )
    except Exception as e:
        logger.warning(f"Failed to load case_activity_logs in super admin dashboard: {e}")

    # B) ActivityLog table entries (profile updates, user edits, client edits, deletion requests)
    try:
        excluded_actions = ['LOGIN', 'LOGOUT', 'FORCE_LOGOUT']
        act_qs = ActivityLog.objects.exclude(action__in=excluded_actions).select_related('user').order_by('-created_at')[:500]
        for act in act_qs:
            actor_name = f"{act.user.first_name or ''} {act.user.last_name or ''}".strip() or act.user.email if act.user else "Case Manager"
            _add_log_entry(
                f"act-{act.id}",
                act.user_id,
                actor_name,
                act.user.role if act.user else "CASE_MANAGER",
                act.action,
                act.details or f"{act.action} by {actor_name}",
                act.created_at,
            )
    except Exception as e:
        logger.warning(f"Failed to load ActivityLog: {e}")

    # C) Report Generation & QC Assignment events from reports table
    try:
        reports_qs = Report.objects.select_related('created_by', 'assigned_qc').order_by('-created_at')[:200]
        for r in reports_qs:
            cm_user = r.created_by or default_cm
            cm_id = cm_user.id if hasattr(cm_user, 'id') else (cm_user['id'] if isinstance(cm_user, dict) else None)
            actor_name = (f"{r.created_by.first_name or ''} {r.created_by.last_name or ''}".strip() or r.created_by.email) if r.created_by else (default_cm['name'] if default_cm else "Case Manager")
            
            if r.assigned_qc:
                qc_name = f"{r.assigned_qc.first_name or ''} {r.assigned_qc.last_name or ''}".strip() or r.assigned_qc.email
                desc = f"Assigned Quality Analyst '{qc_name}' for case #{r.case_id}"
                action_name = "QC_ASSIGNED"
                event_dt = r.assigned_at or r.created_at
            else:
                desc = f"Generated investigation report for case #{r.case_id} ({r.status})"
                action_name = "REPORT_GENERATED"
                event_dt = r.created_at

            _add_log_entry(
                f"rep-{r.id}",
                cm_id,
                actor_name,
                "CASE_MANAGER",
                action_name,
                desc,
                event_dt,
            )
    except Exception as e:
        logger.warning(f"Failed to load report activity: {e}")

    # D) Case creation events from cases & insurance_case tables (fallback for older cases)
    try:
        with connection.cursor() as cursor:
            cursor.execute("""
                SELECT
                    c.id,
                    c.case_number,
                    c.claim_number,
                    c.client_name,
                    c.created_at,
                    ic.created_by_id,
                    COALESCE(NULLIF(TRIM(CONCAT(cu.first_name, ' ', cu.last_name)), ''), cu.username, '') AS cm_name
                FROM cases c
                LEFT JOIN insurance_case ic ON ic.case_number = c.case_number
                LEFT JOIN users_customuser cu ON cu.id = ic.created_by_id
                ORDER BY c.created_at DESC
                LIMIT 200
            """)
            for c_id, case_num, claim_num, client_name, c_created_at, created_by_id, cm_name in cursor.fetchall():
                cm_id = created_by_id
                if not cm_id and cm_name:
                    name_key = cm_name.strip().lower()
                    if name_key in cm_by_name:
                        cm_id = cm_by_name[name_key]['id']
                if not cm_id and default_cm:
                    cm_id = default_cm['id']

                actor_name = cm_name or (cm_by_id.get(cm_id, {}).get('name') if cm_id else None) or "Case Manager"
                clean_client = (client_name or "").split(" - ")[0].strip() or "Client"
                _add_log_entry(
                    f"case-create-{c_id}",
                    cm_id,
                    actor_name,
                    "CASE_MANAGER",
                    "CASE_CREATED",
                    f"Created case #{case_num or c_id} (Claim: {claim_num or 'N/A'}) for {clean_client}",
                    c_created_at,
                )
    except Exception as e:
        logger.warning(f"Failed to load case creation activity: {e}")

    # Sort all activity logs chronologically descending
    def _parse_time(t):
        if not t:
            return 0
        try:
            return datetime.fromisoformat(str(t)).timestamp()
        except Exception:
            return 0

    activity_logs.sort(key=lambda x: _parse_time(x['created_at']), reverse=True)

    # 4. Case Deletion Change Logs
    deletion_logs = []
    try:
        del_qs = CaseDeletionRequest.objects.select_related('requested_by', 'reviewed_by').order_by('-requested_at')[:50]
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

    from users.models import ActivityLog, CaseDeletionRequest
    from django.db import connection as db_conn
    import re

    logs = []
    
    # 1. Fetch ActivityLog records matching allowed actions
    allowed_actions = [
        'USER_CREATED', 'USER_UPDATED', 'USER_DELETED',
        'CLIENT_CREATED', 'CLIENT_UPDATED', 'CLIENT_DELETED',
        'APPROVAL', 'REJECTION',
        'CASE_DELETED', 'CASE_DELETION_REQUESTED', 'CASE_DELETION_APPROVED', 'CASE_DELETION_REJECTED',
        'CASE_CREATED', 'VENDOR_ASSIGNED'
    ]

    try:
        activity_logs = ActivityLog.objects.filter(
            action__in=allowed_actions
        ).select_related('user').order_by('-created_at')[:limit]

        act_case_ids = []
        for act in activity_logs:
            if act.details:
                cm = re.search(r"case #(\d+)", act.details, re.IGNORECASE)
                if cm:
                    act_case_ids.append(cm.group(1))
                    
        act_case_numbers = {}
        if act_case_ids:
            try:
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

            if act.action in ['CASE_DELETION_APPROVED', 'CASE_DELETION_REJECTED', 'CASE_DELETION_REQUESTED']:
                case_match = re.search(r"case #(\d+)", desc, re.IGNORECASE)
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
    except Exception as e:
        logger.warning(f"Failed to load ActivityLog in super admin notifications: {e}")

    # 2. Fetch User creations/registrations directly (skip if already captured by ActivityLog)
    try:
        logged_user_creations = set()
        for l in logs:
            if l.get("event_type") == 'USER_CREATED' and l.get("target_user_email"):
                logged_user_creations.add(l["target_user_email"].lower())

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
    except Exception as e:
        logger.warning(f"Failed to load user creations in super admin notifications: {e}")

    # 3. Fetch Case Deletion Requests directly
    try:
        del_requests = CaseDeletionRequest.objects.select_related('requested_by', 'reviewed_by').order_by('-requested_at')[:limit]
        for dr in del_requests:
            req_name = f"{dr.requested_by.first_name} {dr.requested_by.last_name}".strip() or dr.requested_by.username if dr.requested_by else "Case Manager"
            case_display = getattr(dr, 'case_number', None) or dr.case_id
            ev_type = f"CASE_DELETION_{dr.status}" if dr.status in ['APPROVED', 'REJECTED'] else "CASE_DELETION_REQUESTED"
            desc = f"Case deletion requested for case {case_display} by {req_name}: {dr.reason or 'No reason provided'}"
            if dr.status == 'APPROVED' and dr.reviewed_by:
                rev_name = f"{dr.reviewed_by.first_name} {dr.reviewed_by.last_name}".strip() or dr.reviewed_by.username
                desc = f"Case deletion request for case {case_display} approved by {rev_name}"
            elif dr.status == 'REJECTED' and dr.reviewed_by:
                rev_name = f"{dr.reviewed_by.first_name} {dr.reviewed_by.last_name}".strip() or dr.reviewed_by.username
                desc = f"Case deletion request for case {case_display} rejected by {rev_name}"
            
            logs.append({
                "id": f"del-req-{dr.id}",
                "description": desc,
                "actor": req_name,
                "event_time": (dr.reviewed_at or dr.requested_at).isoformat() if (dr.reviewed_at or dr.requested_at) else None,
                "event_type": ev_type,
                "case_id": dr.case_id,
            })
    except Exception as e:
        logger.warning(f"Failed to load deletion requests in super admin notifications: {e}")

    # 4. Fetch recent case activity logs (case creations, vendor assignments)
    try:
        with db_conn.cursor() as cur:
            cur.execute(
                """
                SELECT
                    cal.id,
                    cal.created_at,
                    cal.event_type,
                    COALESCE(NULLIF(cal.actor_name, ''), 'System') AS actor_name,
                    cal.description,
                    COALESCE(NULLIF(c.case_number, ''), NULLIF(cal.case_number, ''), '') AS case_number,
                    cal.case_id
                FROM case_activity_logs cal
                LEFT JOIN cases c ON c.id = cal.case_id
                WHERE cal.created_at IS NOT NULL
                ORDER BY cal.created_at DESC
                LIMIT %s
                """,
                [limit],
            )
            for row_id, created_at, ev_type, actor_name, desc, case_num, case_id in cur.fetchall():
                logs.append({
                    "id": f"cal-{row_id}",
                    "description": f"{desc} (Case {case_num})" if case_num and case_num not in desc else desc,
                    "actor": actor_name,
                    "event_time": created_at.isoformat() if created_at else None,
                    "event_type": ev_type,
                    "case_id": case_num or case_id,
                })
    except Exception as e:
        logger.warning(f"Failed to load case_activity_logs in super admin notifications: {e}")

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


@router.post(
    "/super-admin/logs/archive",
    response={200: Dict[str, Any], 401: ErrorSchema, 403: ErrorSchema, 500: ErrorSchema},
    summary="Trigger Log Archiving",
    description="Archives logs older than the specified retention days (default 90 days). Super Admin only.",
)
def trigger_log_archiving(request, days: int = 90):
    if not request.user.is_authenticated:
        return 401, {"error": "Not authenticated", "code": "NOT_AUTHENTICATED"}
    
    if not is_super_admin(request.user):
        return 403, {
            "error": "Super admin access required",
            "code": "SUPER_ADMIN_REQUIRED"
        }

    try:
        from users.services.log_archive_service import archive_logs_older_than
        result = archive_logs_older_than(days=max(1, int(days or 90)))
        return 200, result
    except Exception as e:
        logger.error(f"Failed to archive logs: {e}")
        return 500, {"error": f"Archiving failed: {str(e)}", "code": "ARCHIVE_ERROR"}


@router.get(
    "/super-admin/logs/archive/stats",
    response={200: Dict[str, Any], 401: ErrorSchema, 403: ErrorSchema},
    summary="Get Log Archive Statistics",
    description="Get counts of active and archived log records. Super Admin only.",
)
def get_log_archive_stats_endpoint(request):
    if not request.user.is_authenticated:
        return 401, {"error": "Not authenticated", "code": "NOT_AUTHENTICATED"}
    
    if not is_super_admin(request.user):
        return 403, {
            "error": "Super admin access required",
            "code": "SUPER_ADMIN_REQUIRED"
        }

    from users.services.log_archive_service import get_archive_stats
    return 200, get_archive_stats()
