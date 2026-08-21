"""
User management API endpoints.
"""

import logging
from datetime import timedelta
from typing import List, Optional
from django.contrib.auth import get_user_model
from django.db import connection, transaction
from django.db.models import ProtectedError
from django.db.utils import DatabaseError, ProgrammingError
from django.utils import timezone
from ninja import Router
from ninja.errors import HttpError

from users.schemas import (
    AdminUserResponseSchema,
    AdminUserWithSessionSchema,
    UserResponseSchema,
    UserUpdateSchema,
    UserCreateSchema,
    ErrorSchema,
    MessageSchema,
)
from core.permissions import is_admin
from users.models import AuthToken, ActivityLog

User = get_user_model()
logger = logging.getLogger(__name__)

router = Router(tags=["User Management"])


def _table_exists(table_name):
    return table_name in connection.introspection.table_names()


def _column_exists(table_name, column_name):
    if not _table_exists(table_name):
        return False
    with connection.cursor() as cursor:
        columns = [column.name for column in connection.introspection.get_table_description(cursor, table_name)]
    return column_name in columns


def _delete_if_table_exists(table_name, user_column, user_id):
    if not _table_exists(table_name) or not _column_exists(table_name, user_column):
        return
    with connection.cursor() as cursor:
        cursor.execute(f'DELETE FROM "{table_name}" WHERE "{user_column}" = %s', [user_id])


def _null_user_fk_if_exists(table_name, user_column, user_id):
    if not _table_exists(table_name) or not _column_exists(table_name, user_column):
        return
    with connection.cursor() as cursor:
        cursor.execute(f'UPDATE "{table_name}" SET "{user_column}" = NULL WHERE "{user_column}" = %s', [user_id])


def _delete_user_without_missing_relation_cascade(user):
    """
    Delete a user without letting Django cascade into stale/missing legacy
    profile tables. Production has had role-table renames, so ORM collection can
    fail before it reaches the actual user delete.
    """
    user_id = user.id
    user_table = User._meta.db_table

    # Role profile / auth helper rows that own the user relationship.
    for table_name in (
        "users_authtoken",
        "users_emailverificationcode",
        "users_passwordresettoken",
        "users_vendor",
        "users_casemanager",
        "users_casemanagerprofile",
        "users_qc",
        "users_lawyer",
        "users_admin",
        "users_activitylog",
    ):
        _delete_if_table_exists(table_name, "user_id", user_id)

    # Django auth M2M tables may or may not exist on older deployments.
    for table_name in (
        f"{user_table}_groups",
        f"{user_table}_user_permissions",
        "users_customuser_groups",
        "users_customuser_user_permissions",
    ):
        _delete_if_table_exists(table_name, "customuser_id", user_id)
        _delete_if_table_exists(table_name, "user_id", user_id)

    # References that should not block deleting an account.
    for table_name, column_name in (
        ("reports", "assigned_qc_id"),
        ("reports", "created_by_id"),
        ("insurance_case", "created_by_id"),
        ("insurance_case", "vendor_id"),
    ):
        _null_user_fk_if_exists(table_name, column_name, user_id)

    with connection.cursor() as cursor:
        cursor.execute(f'DELETE FROM "{user_table}" WHERE "id" = %s', [user_id])


def sync_role_specific_profile(user):
    """Ensure role-specific profile rows exist for users created by Super Admin."""
    try:
        from users.models import CaseManager, QC, Vendor

        if user.role == 'CASE_MANAGER':
            CaseManager.objects.get_or_create(
                user=user,
                defaults={
                    'employee_id': f"ADMIN_{user.id}_{int(user.date_joined.timestamp())}",
                    'department': user.sub_role or 'General',
                    'contact_email': user.email,
                },
            )
        elif user.role == 'QC':
            QC.objects.get_or_create(
                user=user,
                defaults={
                    'bar_registration_number': f"BAR_{user.id}",
                    'contact_email': user.email,
                    'specialization': 'General Practice',
                },
            )
        elif user.role in ['VENDOR', 'ADVOCATE']:
            display_name = f"{user.first_name} {user.last_name}".strip() or user.username
            Vendor.objects.update_or_create(
                user=user,
                defaults={
                    'company_name': display_name,
                    'contact_email': user.email,
                    'is_active': user.is_active,
                },
            )
        else:
            Vendor.objects.filter(user=user).update(is_active=False)
    except Exception as exc:
        logger.error(f"Failed to sync role-specific profile for user {user.username}: {exc}", exc_info=True)


# Helper function to check super admin
def is_super_admin(user) -> bool:
    """Check if user is a super admin."""
    return (
        user.is_authenticated and
        user.role == 'SUPER_ADMIN'
    )


# =============================================================================
# User Management Endpoints
# =============================================================================

@router.get(
    "/users",
    response={200: List[AdminUserWithSessionSchema], 401: ErrorSchema, 403: ErrorSchema},
    summary="List All Users",
    description="Get list of all users. Super Admin only.",
)
def list_users(request):
    """
    Get list of all users.
    Only accessible by super admin users.
    """
    if not request.user.is_authenticated:
        return 401, {"error": "Not authenticated", "code": "NOT_AUTHENTICATED"}
    
    if not is_super_admin(request.user):
        return 403, {"error": "Super admin access required", "code": "SUPER_ADMIN_REQUIRED"}
    
    users = User.objects.all().order_by('-date_joined')
    
    # Build enriched response with session info
    result = []
    for user in users:
        user_data = AdminUserResponseSchema.model_validate(user).model_dump()
        
        # Get active session info
        active_tokens = AuthToken.objects.filter(
            user=user, is_active=True
        ).order_by('-created_at')
        
        # Filter out expired and stale sessions (last_used_at > 15 sec ago)
        # and auto-deactivate them so they don't count toward device limit
        stale_cutoff = timezone.now() - timedelta(seconds=15)
        valid_tokens = []
        for t in active_tokens:
            if t.is_expired:
                t.is_active = False
                t.save(update_fields=['is_active'])
            elif t.last_used_at and t.last_used_at < stale_cutoff:
                # Session hasn't sent a heartbeat in 3+ minutes — consider dead
                t.is_active = False
                t.save(update_fields=['is_active'])
            else:
                valid_tokens.append(t)
        
        if valid_tokens:
            user_data['is_online'] = True
            # For backward compatibility, populate main fields from the most recent one
            first_token = valid_tokens[0]
            user_data['session_ip'] = first_token.ip_address or ''
            user_data['session_device'] = first_token.device_info or ''
            user_data['session_created_at'] = first_token.created_at.isoformat() if first_token.created_at else None
            user_data['session_last_used'] = first_token.last_used_at.isoformat() if first_token.last_used_at else None
            
            # Populate array for modal display
            user_data['active_sessions'] = []
            for t in valid_tokens:
                user_data['active_sessions'].append({
                    'session_id': t.id,
                    'token_created_at': t.created_at,
                    'last_used_at': t.last_used_at,
                    'ip_address': t.ip_address or '',
                    'device_info': t.device_info or '',
                    'device_name': t.device_name or '',
                    'is_active': t.is_active
                })
        else:
            user_data['is_online'] = False
            user_data['session_ip'] = ''
            user_data['session_device'] = ''
            user_data['session_created_at'] = None
            user_data['session_last_used'] = None
            user_data['active_sessions'] = []
        
        result.append(user_data)
    
    return 200, result


@router.post(
    "/users",
    response={201: AdminUserResponseSchema, 400: ErrorSchema, 401: ErrorSchema, 403: ErrorSchema},
    summary="Create New User",
    description="Create a new user. Super Admin only.",
)
def create_user(request, payload: UserCreateSchema):
    """
    Create a new user account.
    Only accessible by super admin users.
    
    Payload should include:
    - email: Valid unique email address
    - password: Password (minimum 8 characters)
    - first_name: Optional first name
    - last_name: Optional last name
    - role: User role (SUPER_ADMIN, CASE_MANAGER, VENDOR, CLIENT, QC)
    """
    if not request.user.is_authenticated:
        return 401, {"error": "Not authenticated", "code": "NOT_AUTHENTICATED"}
    
    if not is_super_admin(request.user):
        return 403, {"error": "Super admin access required", "code": "SUPER_ADMIN_REQUIRED"}
    
    # Validate role
    role_upper = payload.role.upper() if payload.role else 'CLIENT'
    valid_roles = ['SUPER_ADMIN', 'CASE_MANAGER', 'VENDOR', 'CLIENT', 'QC', 'ADVOCATE']
    if role_upper not in valid_roles:
        return 400, {"error": f"Invalid role. Must be one of: {', '.join(valid_roles)}", "code": "INVALID_ROLE"}
    
    # Check if email already exists
    if User.objects.filter(email=payload.email).exists():
        return 400, {"error": "Email already registered", "code": "EMAIL_EXISTS"}
    
    # Auto-generate username from email (use email prefix, ensure uniqueness)
    base_username = payload.email.split('@')[0]
    username = base_username
    counter = 1
    while User.objects.filter(username=username).exists():
        username = f"{base_username}{counter}"
        counter += 1
    
    try:
        sub_role = 'SUPER_ADMIN' if role_upper == 'SUPER_ADMIN' else (payload.sub_role or '')

        # Create user
        user = User.objects.create_user(
            username=username,
            email=payload.email,
            password=payload.password,
            first_name=payload.first_name or '',
            last_name=payload.last_name or '',
            role=role_upper,
            sub_role=sub_role,
            is_staff=role_upper == 'SUPER_ADMIN',
            is_superuser=role_upper == 'SUPER_ADMIN',
            is_active=True,
        )
        if payload.device_limit is not None:
            user.device_limit = payload.device_limit
            user.save(update_fields=["device_limit"])
            
        if _column_exists(User._meta.db_table, "plain_password"):
            user.plain_password = payload.password
            user.save(update_fields=["plain_password"])
        
        logger.info(f"New user {user.email} created by {request.user.email}")
        sync_role_specific_profile(user)
        
        try:
            ActivityLog.objects.create(
                user=request.user,
                action='USER_CREATED',
                details=f"Created new user '{user.email}' with role '{role_upper}'",
                ip_address=request.META.get('REMOTE_ADDR', ''),
            )
        except Exception as log_err:
            logger.warning(f"Failed to log user creation: {log_err}")
            
        return 201, AdminUserResponseSchema.model_validate(user)
    except Exception as e:
        error_msg = str(e)
        logger.error(f"User creation failed: {error_msg}", exc_info=True)
        return 400, {"error": f"Failed to create user: {error_msg}", "code": "USER_CREATION_FAILED"}


@router.get(
    "/users/{user_id}",
    response={200: AdminUserResponseSchema, 401: ErrorSchema, 403: ErrorSchema, 404: ErrorSchema},
    summary="Get User Details",
    description="Get details of a specific user. Super Admin only.",
)
def get_user(request, user_id: int):
    """
    Get details of a specific user.
    Only accessible by super admin users.
    """
    if not request.user.is_authenticated:
        return 401, {"error": "Not authenticated", "code": "NOT_AUTHENTICATED"}
    
    if not is_super_admin(request.user):
        return 403, {"error": "Super admin access required", "code": "SUPER_ADMIN_REQUIRED"}
    
    try:
        user = User.objects.get(id=user_id)
        return 200, AdminUserResponseSchema.model_validate(user)
    except User.DoesNotExist:
        return 404, {"error": "User not found", "code": "USER_NOT_FOUND"}


@router.put(
    "/users/{user_id}",
    response={200: AdminUserResponseSchema, 401: ErrorSchema, 403: ErrorSchema, 404: ErrorSchema, 400: ErrorSchema},
    summary="Update User",
    description="Update user details and permissions. Super Admin only.",
)
def update_user(request, user_id: int, payload: UserUpdateSchema):
    """
    Update user details including permissions.
    Only accessible by super admin users.
    
    Payload can include:
    - first_name, last_name, email: Basic user info
    - role: User role (SUPER_ADMIN, CASE_MANAGER, VENDOR, CLIENT, QC)
    - sub_role: CaseManager sub-role (SUPER_ADMIN, CASE_HANDLER, etc.)
    - permissions: Array of allowed page paths
    - is_active: Enable/disable user account
    """
    if not request.user.is_authenticated:
        return 401, {"error": "Not authenticated", "code": "NOT_AUTHENTICATED"}
    
    if not is_super_admin(request.user):
        return 403, {"error": "Super admin access required", "code": "SUPER_ADMIN_REQUIRED"}
    
    try:
        user = User.objects.get(id=user_id)
    except User.DoesNotExist:
        return 404, {"error": "User not found", "code": "USER_NOT_FOUND"}
    
    log_payload = payload.dict()
    if log_payload.get("password"):
        log_payload["password"] = "***"
    logger.info(f"Updating user {user.username} with payload: {log_payload}")
    
    # Track changes
    changes = []
    
    # Update basic fields
    if payload.first_name is not None:
        if user.first_name != payload.first_name:
            changes.append(f"First Name to '{payload.first_name}'")
        user.first_name = payload.first_name
    if payload.last_name is not None:
        if user.last_name != payload.last_name:
            changes.append(f"Last Name to '{payload.last_name}'")
        user.last_name = payload.last_name
    if payload.email is not None:
        if user.email != payload.email:
            # Check if email is already used by another user
            if User.objects.filter(email=payload.email).exclude(id=user_id).exists():
                return 400, {"error": "Email already in use", "code": "EMAIL_EXISTS"}
            changes.append(f"Email to '{payload.email}'")
        user.email = payload.email
        
    if payload.device_limit is not None:
        if user.device_limit != payload.device_limit:
            changes.append(f"Device Limit to '{payload.device_limit}'")
        user.device_limit = payload.device_limit
    
    # Update role and sub_role
    if payload.role is not None:
        role_upper = payload.role.upper()
        valid_roles = ['SUPER_ADMIN', 'CASE_MANAGER', 'VENDOR', 'CLIENT', 'QC', 'ADVOCATE']
        if role_upper not in valid_roles:
            return 400, {"error": f"Invalid role. Must be one of: {', '.join(valid_roles)}", "code": "INVALID_ROLE"}
        if user.role != role_upper:
            changes.append(f"Role to '{role_upper}'")
        user.role = role_upper
        if role_upper == 'SUPER_ADMIN' and payload.sub_role is None:
            user.sub_role = 'SUPER_ADMIN'
            user.is_staff = True
            user.is_superuser = True
        elif role_upper != 'SUPER_ADMIN':
            if role_upper != 'CASE_MANAGER' and payload.sub_role is None:
                user.sub_role = None
            user.is_superuser = False
    
    if payload.sub_role is not None:
        if payload.sub_role and payload.sub_role != '':
            sub_role_upper = str(payload.sub_role).upper()
            valid_sub_roles = ['SUPER_ADMIN', 'CASE_HANDLER', 'REPORT_MANAGER', 'LOG_MANAGER']
            if sub_role_upper not in valid_sub_roles:
                return 400, {"error": f"Invalid sub_role. Must be one of: {', '.join(valid_sub_roles)}", "code": "INVALID_SUB_ROLE"}
            if user.sub_role != sub_role_upper:
                changes.append(f"Sub-Role to '{sub_role_upper}'")
            user.sub_role = sub_role_upper
        else:
            if user.sub_role is not None:
                changes.append(f"Sub-Role to 'None'")
            user.sub_role = None
    
    # Update permissions (stored as JSON)
    if payload.permissions is not None:
        if isinstance(payload.permissions, list):
            if user.permissions != payload.permissions:
                old_p = set(user.permissions or [])
                new_p = set(payload.permissions or [])
                changed_p = old_p.symmetric_difference(new_p)
                path_labels = {
                    '/case_manager/dashboard': 'Dashboard',
                    '/case_manager/cases': 'Cases',
                    '/case_manager/ai-case-review': 'AI Case Review',
                    '/case_manager/legal-review': 'Legal Review',
                    '/case_manager/reports': 'Reports',
                    '/case_manager/audit-logs': 'Audit Logs',
                    '/case_manager/settings': 'Settings',
                }
                changed_names = [path_labels.get(p, p) for p in changed_p]
                if changed_names:
                    changes.append(f"Permissions modified ({', '.join(changed_names)})")
                else:
                    changes.append("Permissions modified")
            user.permissions = payload.permissions
        else:
            logger.warning(f"Invalid permissions format: {payload.permissions}")
            user.permissions = []
    
    # Update active status
    if payload.is_active is not None:
        if user.is_active != bool(payload.is_active):
            changes.append(f"Status to '{'Active' if payload.is_active else 'Inactive'}'")
        user.is_active = bool(payload.is_active)

    if payload.password:
        changes.append("Password updated")
        user.set_password(payload.password)
        if _column_exists(User._meta.db_table, "plain_password"):
            user.plain_password = payload.password
    
    user.save()
    sync_role_specific_profile(user)
    logger.info(f"User {user.username} updated successfully by admin {request.user.username}")
    
    try:
        target_name = f"{user.first_name} {user.last_name}".strip() or user.username
        details_msg = f"Updated user account '{target_name}'"
        if changes:
            details_msg += f"\nChanges: {', '.join(changes)}"
        else:
            details_msg += f"\n(No fields changed)"
            
        ActivityLog.objects.create(
            user=request.user,
            action='USER_UPDATED',
            details=details_msg,
            ip_address=request.META.get('REMOTE_ADDR', ''),
        )
    except Exception as log_err:
        logger.warning(f"Failed to log user update: {log_err}")
        
    return 200, AdminUserResponseSchema.model_validate(user)


@router.delete(
    "/users/{user_id}",
    response={200: MessageSchema, 401: ErrorSchema, 403: ErrorSchema, 404: ErrorSchema, 400: ErrorSchema},
    summary="Delete User",
    description="Delete a user. Super Admin only.",
)
def delete_user(request, user_id: int):
    """
    Delete a user.
    Only accessible by super admin users.
    Cannot delete yourself.
    """
    if not request.user.is_authenticated:
        return 401, {"error": "Not authenticated", "code": "NOT_AUTHENTICATED"}
    
    if not is_super_admin(request.user):
        return 403, {"error": "Super admin access required", "code": "SUPER_ADMIN_REQUIRED"}
    
    if request.user.id == user_id:
        return 400, {"error": "Cannot delete yourself", "code": "CANNOT_DELETE_SELF"}
    
    try:
        user = User.objects.get(id=user_id)
        username = user.username

        if user.role == 'SUPER_ADMIN' and User.objects.filter(role='SUPER_ADMIN', is_active=True).exclude(id=user_id).count() == 0:
            return 400, {"error": "Cannot delete the last active super admin", "code": "LAST_SUPER_ADMIN"}

        try:
            with transaction.atomic():
                _delete_user_without_missing_relation_cascade(user)
        except ProtectedError as exc:
            logger.warning(f"Protected delete failed for user {username}: {exc}", exc_info=True)
            return 400, {
                "error": "This user is linked to existing records and cannot be deleted. Deactivate the account instead.",
                "code": "USER_HAS_LINKED_RECORDS",
            }
        except (ProgrammingError, DatabaseError) as exc:
            logger.error(f"Database delete failed for user {username}: {exc}", exc_info=True)
            return 400, {
                "error": "This user is linked to existing records and cannot be deleted safely. Deactivate the account instead.",
                "code": "USER_DELETE_CONSTRAINT",
            }

        try:
            ActivityLog.objects.create(
                user=request.user,
                action='USER_DELETED',
                details=f"Deleted user '{username}' ({user.email})",
                ip_address=request.META.get('REMOTE_ADDR', ''),
            )
        except Exception as log_err:
            logger.warning(f"Failed to log user deletion: {log_err}")

        logger.info(f"User {username} deleted by admin {request.user.username}")
        return 200, {"message": f"User {username} deleted successfully"}
    except User.DoesNotExist:
        return 404, {"error": "User not found", "code": "USER_NOT_FOUND"}
    except Exception as exc:
        logger.error(f"Failed to delete user id={user_id}: {exc}", exc_info=True)
        return 400, {"error": f"Failed to delete user: {exc}", "code": "USER_DELETE_FAILED"}


# =============================================================================
# Session Management (Super Admin)
# =============================================================================

@router.post(
    "/users/{user_id}/force-logout",
    response={200: MessageSchema, 401: ErrorSchema, 403: ErrorSchema, 404: ErrorSchema},
    summary="Force Logout User",
    description="Force logout a user from all devices. Super Admin only.",
)
def force_logout_user(request, user_id: int):
    """
    Force logout a specific user by deleting all their auth tokens.
    Only accessible by super admin users.
    """
    if not request.user.is_authenticated:
        return 401, {"error": "Not authenticated", "code": "NOT_AUTHENTICATED"}
    
    if not is_super_admin(request.user):
        return 403, {"error": "Super admin access required", "code": "SUPER_ADMIN_REQUIRED"}
    
    try:
        target_user = User.objects.get(id=user_id)
    except User.DoesNotExist:
        return 404, {"error": "User not found", "code": "USER_NOT_FOUND"}
    
    # Deactivate all tokens for this user (soft-delete for audit trail)
    deactivated_count = AuthToken.objects.filter(
        user=target_user, is_active=True
    ).update(is_active=False)
    
    # Log the force logout in activity log
    ActivityLog.objects.create(
        user=target_user,
        action=ActivityLog.Action.FORCE_LOGOUT,
        details=f'Force logged out by admin {request.user.email} ({deactivated_count} session(s) terminated)',
        ip_address=request.META.get('REMOTE_ADDR', ''),
    )
    
    name = f"{target_user.first_name} {target_user.last_name}".strip() or target_user.email
    logger.info(f"Super admin {request.user.email} force-logged out user {target_user.email}")
    return 200, {"message": f"{name} has been logged out from all devices"}


@router.post(
    "/users/{user_id}/force-logout/{session_id}",
    response={200: MessageSchema, 401: ErrorSchema, 403: ErrorSchema, 404: ErrorSchema},
    summary="Force Logout Specific Session",
    description="Force logout a user from a specific device session. Super Admin only.",
)
def force_logout_session(request, user_id: int, session_id: int):
    """
    Force logout a specific session by deleting its auth token.
    Only accessible by super admin users.
    """
    if not request.user.is_authenticated:
        return 401, {"error": "Not authenticated", "code": "NOT_AUTHENTICATED"}
    
    if not is_super_admin(request.user):
        return 403, {"error": "Super admin access required", "code": "SUPER_ADMIN_REQUIRED"}
    
    try:
        target_user = User.objects.get(id=user_id)
    except User.DoesNotExist:
        return 404, {"error": "User not found", "code": "USER_NOT_FOUND"}
    
    deactivated_count = AuthToken.objects.filter(
        id=session_id, user=target_user, is_active=True
    ).update(is_active=False)
    if deactivated_count == 0:
        return 404, {"error": "Session not found", "code": "SESSION_NOT_FOUND"}
    
    ActivityLog.objects.create(
        user=target_user,
        action=ActivityLog.Action.FORCE_LOGOUT,
        details=f'Specific session (ID: {session_id}) terminated by admin {request.user.email}',
        ip_address=request.META.get('REMOTE_ADDR', ''),
    )
    
    name = f"{target_user.first_name} {target_user.last_name}".strip() or target_user.email
    logger.info(f"Super admin {request.user.email} force-logged out specific session {session_id} for user {target_user.email}")
    return 200, {"message": f"Session terminated for {name}"}

