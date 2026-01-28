"""
User management API endpoints.
"""

import logging
from typing import List, Optional
from django.contrib.auth import get_user_model
from ninja import Router
from ninja.errors import HttpError

from users.schemas import (
    UserResponseSchema,
    UserUpdateSchema,
    UserCreateSchema,
    ErrorSchema,
    MessageSchema,
)
from core.permissions import is_admin

User = get_user_model()
logger = logging.getLogger(__name__)

router = Router(tags=["User Management"])


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
    response={200: List[UserResponseSchema], 401: ErrorSchema, 403: ErrorSchema},
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
    return 200, [UserResponseSchema.model_validate(user) for user in users]


@router.post(
    "/users",
    response={201: UserResponseSchema, 400: ErrorSchema, 401: ErrorSchema, 403: ErrorSchema},
    summary="Create New User",
    description="Create a new user. Super Admin only.",
)
def create_user(request, payload: UserCreateSchema):
    """
    Create a new user account.
    Only accessible by super admin users.
    
    Payload should include:
    - username: Unique username (3-150 characters)
    - email: Valid unique email address
    - password: Password (minimum 8 characters)
    - first_name: Optional first name
    - last_name: Optional last name
    - role: User role (ADMIN, VENDOR, CLIENT, LAWYER)
    """
    if not request.user.is_authenticated:
        return 401, {"error": "Not authenticated", "code": "NOT_AUTHENTICATED"}
    
    if not is_super_admin(request.user):
        return 403, {"error": "Super admin access required", "code": "SUPER_ADMIN_REQUIRED"}
    
    # Validate role
    role_upper = payload.role.upper() if payload.role else 'CLIENT'
    valid_roles = ['ADMIN', 'VENDOR', 'CLIENT', 'LAWYER']
    if role_upper not in valid_roles:
        return 400, {"error": f"Invalid role. Must be one of: {', '.join(valid_roles)}", "code": "INVALID_ROLE"}
    
    # Check if username already exists
    if User.objects.filter(username=payload.username).exists():
        return 400, {"error": "Username already exists", "code": "USERNAME_EXISTS"}
    
    # Check if email already exists
    if User.objects.filter(email=payload.email).exists():
        return 400, {"error": "Email already registered", "code": "EMAIL_EXISTS"}
    
    try:
        # Create user
        user = User.objects.create_user(
            username=payload.username,
            email=payload.email,
            password=payload.password,
            first_name=payload.first_name or '',
            last_name=payload.last_name or '',
            role=role_upper,
            is_active=True,
        )
        
        logger.info(f"New user {user.username} created by admin {request.user.username}")
        
        return 201, UserResponseSchema.model_validate(user)
    except Exception as e:
        logger.error(f"User creation failed: {e}")
        return 400, {"error": "Failed to create user", "code": "USER_CREATION_FAILED"}


@router.get(
    "/users/{user_id}",
    response={200: UserResponseSchema, 401: ErrorSchema, 403: ErrorSchema, 404: ErrorSchema},
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
        return 200, UserResponseSchema.model_validate(user)
    except User.DoesNotExist:
        return 404, {"error": "User not found", "code": "USER_NOT_FOUND"}


@router.put(
    "/users/{user_id}",
    response={200: UserResponseSchema, 401: ErrorSchema, 403: ErrorSchema, 404: ErrorSchema, 400: ErrorSchema},
    summary="Update User",
    description="Update user details and permissions. Super Admin only.",
)
def update_user(request, user_id: int, payload: UserUpdateSchema):
    """
    Update user details including permissions.
    Only accessible by super admin users.
    
    Payload can include:
    - first_name, last_name, email: Basic user info
    - role: User role (ADMIN, VENDOR, CLIENT)
    - sub_role: Admin sub-role (SUPER_ADMIN, CASE_HANDLER, etc.)
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
    
    logger.info(f"Updating user {user.username} with payload: {payload.dict()}")
    
    # Update basic fields
    if payload.first_name is not None:
        user.first_name = payload.first_name
    if payload.last_name is not None:
        user.last_name = payload.last_name
    if payload.email is not None:
        # Check if email is already used by another user
        if User.objects.filter(email=payload.email).exclude(id=user_id).exists():
            return 400, {"error": "Email already in use", "code": "EMAIL_EXISTS"}
        user.email = payload.email
    
    # Update role and sub_role
    if payload.role is not None:
        role_upper = payload.role.upper()
        valid_roles = ['ADMIN', 'VENDOR', 'CLIENT', 'LAWYER']
        if role_upper not in valid_roles:
            return 400, {"error": f"Invalid role. Must be one of: {', '.join(valid_roles)}", "code": "INVALID_ROLE"}
        user.role = role_upper
    
    if payload.sub_role is not None:
        if payload.sub_role and payload.sub_role != '':
            sub_role_upper = str(payload.sub_role).upper()
            valid_sub_roles = ['SUPER_ADMIN', 'CASE_HANDLER', 'REPORT_MANAGER', 'LOG_MANAGER']
            if sub_role_upper not in valid_sub_roles:
                return 400, {"error": f"Invalid sub_role. Must be one of: {', '.join(valid_sub_roles)}", "code": "INVALID_SUB_ROLE"}
            user.sub_role = sub_role_upper
        else:
            user.sub_role = None
    
    # Update permissions (stored as JSON)
    if payload.permissions is not None:
        if isinstance(payload.permissions, list):
            user.permissions = payload.permissions
        else:
            logger.warning(f"Invalid permissions format: {payload.permissions}")
            user.permissions = []
    
    # Update active status
    if payload.is_active is not None:
        user.is_active = bool(payload.is_active)
    
    user.save()
    logger.info(f"User {user.username} updated successfully by admin {request.user.username}")
    
    return 200, UserResponseSchema.model_validate(user)


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
        user.delete()
        logger.info(f"User {username} deleted by admin {request.user.username}")
        return 200, {"message": f"User {username} deleted successfully"}
    except User.DoesNotExist:
        return 404, {"error": "User not found", "code": "USER_NOT_FOUND"}
