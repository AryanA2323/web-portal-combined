"""
Authentication API endpoints using Django Ninja.

Provides:
- Login (session-based and token-based) with 2FA support
- Logout
- Session validation
- Password management (change, reset via email)
- Two-Factor Authentication (2FA) via email
"""

import secrets
import logging
from datetime import datetime, timedelta
from typing import Optional

from django.contrib.auth import authenticate, login, logout, get_user_model
from django.middleware.csrf import get_token
from django.views.decorators.csrf import csrf_exempt
from django.conf import settings
from django.db import transaction
from ninja import Router
from ninja.errors import HttpError

from users.schemas import (
    LoginSchema,
    LoginWith2FASchema,
    LoginResponseSchema,
    Login2FARequiredSchema,
    LogoutResponseSchema,
    UserResponseSchema,
    UserCreateSchema,
    ErrorSchema,
    MessageSchema,
    PasswordChangeSchema,
    PasswordResetRequestSchema,
    PasswordResetVerifySchema,
    PasswordResetConfirmSchema,
    PasswordResetTokenConfirmSchema,
    Enable2FASchema,
    Verify2FASchema,
    TwoFactorStatusSchema,
)
from users.models import AuthToken, EmailVerificationCode, PasswordResetToken
from users.services.email_service import email_service

User = get_user_model()
logger = logging.getLogger(__name__)

router = Router(tags=["Authentication"])


# =============================================================================
# Login Endpoints
# =============================================================================

@router.post(
    "/login",
    response={
        200: LoginResponseSchema,
        202: Login2FARequiredSchema,
        401: ErrorSchema,
        400: ErrorSchema
    },
    summary="User Login",
    description="Authenticate user with username and password. Always requires 2FA - returns 202 with code sent to email.",
)
def login_view(request, payload: LoginWith2FASchema):
    """
    Authenticate a user and create a session.
    
    - **username**: User's username or email
    - **password**: User's password
    - **code**: 2FA code (required for all users)
    
    Returns user info and authentication token on success.
    Always requires 2FA: first call returns 202 with code sent to email, second call with code completes login.
    """
    # Authenticate user
    user = authenticate(
        request,
        username=payload.username,
        password=payload.password
    )
    
    if user is None:
        logger.warning(f"Failed login attempt for username: {payload.username}")
        return 401, {"error": "Invalid credentials", "code": "INVALID_CREDENTIALS"}
    
    if not user.is_active:
        return 401, {"error": "Account is disabled", "code": "ACCOUNT_DISABLED"}
    
    # Check if 2FA is enabled for this user
    if user.is_2fa_enabled:
        # 2FA is enabled for this user
        if not payload.code:
            # Send 2FA code via email
            verification = EmailVerificationCode.create_code(
                user=user,
                purpose=EmailVerificationCode.Purpose.TWO_FACTOR_AUTH,
                expiry_minutes=10
            )
            email_service.send_2fa_code(user, verification.code)
            
            logger.info(f"2FA code sent to user: {user.username}")
            return 202, {
                "message": "Two-factor authentication required. Code sent to your email.",
                "requires_2fa": True,
                "username": user.username
            }
        
        # Verify 2FA code
        verification = EmailVerificationCode.objects.filter(
            user=user,
            purpose=EmailVerificationCode.Purpose.TWO_FACTOR_AUTH,
            is_used=False,
        ).order_by('-created_at').first()
        
        if not verification or not verification.is_valid:
            return 401, {"error": "Invalid or expired verification code", "code": "INVALID_2FA_CODE"}
        
        if verification.code != payload.code:
            verification.increment_attempts()
            return 401, {"error": "Invalid verification code", "code": "INVALID_2FA_CODE"}
        
        # Mark code as used
        verification.mark_used()
    
    # Create session
    login(request, user)
    
    # Generate API token
    token_obj = AuthToken.objects.create(user=user)
    
    # Store user data in role-specific table
    _create_role_specific_profile(user)
    
    # Update last login
    user.last_login = datetime.now()
    user.save(update_fields=['last_login'])
    
    logger.info(f"User logged in successfully: {user.username} (role: {user.role})")
    
    return 200, {
        "message": "Login successful",
        "user": UserResponseSchema.model_validate(user),
        "token": {
            "token": token_obj.token,
            "token_type": "Bearer",
            "expires_at": token_obj.expires_at,
        }
    }


def _create_role_specific_profile(user):
    """
    Create or update role-specific profile when user logs in.
    Routes data to appropriate table based on user role.
    """
    from users.models import Admin, Lawyer, Vendor
    
    try:
        if user.role == 'ADMIN':
            # Create/update admin profile
            admin_profile, created = Admin.objects.get_or_create(
                user=user,
                defaults={
                    'employee_id': f"ADMIN_{user.id}_{user.created}".replace(' ', '_'),
                    'department': user.sub_role or 'General',
                    'contact_email': user.email,
                }
            )
            if created:
                logger.info(f"Created admin profile for user: {user.username}")
            
        elif user.role == 'LAWYER':
            # Create/update lawyer profile
            lawyer_profile, created = Lawyer.objects.get_or_create(
                user=user,
                defaults={
                    'bar_registration_number': f"BAR_{user.id}",
                    'contact_email': user.email,
                    'specialization': 'General Practice',
                }
            )
            if created:
                logger.info(f"Created lawyer profile for user: {user.username}")
            
        elif user.role == 'VENDOR':
            # Create/update vendor profile
            vendor_profile, created = Vendor.objects.get_or_create(
                user=user,
                defaults={
                    'company_name': f"{user.first_name} {user.last_name}".strip() or user.username,
                    'contact_email': user.email,
                }
            )
            if created:
                logger.info(f"Created vendor profile for user: {user.username}")
    
    except Exception as e:
        logger.error(f"Error creating role-specific profile for user {user.username}: {e}")
        # Don't fail login if profile creation fails
        pass


# =============================================================================
# Registration Endpoint
# =============================================================================

@router.post(
    "/register",
    response={201: LoginResponseSchema, 400: ErrorSchema},
    summary="User Registration",
    description="Register a new user account with role selection.",
)
def register_user(request, payload: UserCreateSchema):
    """
    Register a new user account.
    
    - **username**: Unique username (3-150 characters)
    - **email**: Valid email address (must be unique)
    - **password**: Password (minimum 8 characters)
    - **first_name**: Optional first name
    - **last_name**: Optional last name
    - **role**: User role (CLIENT, VENDOR, ADMIN, or LAWYER)
    
    Returns user info and authentication token on success.
    """
    # Validate role
    valid_roles = ['CLIENT', 'VENDOR', 'ADMIN', 'LAWYER']
    role = payload.role.upper() if payload.role else 'CLIENT'
    
    if role not in valid_roles:
        return 400, {"error": f"Invalid role. Must be one of: {', '.join(valid_roles)}", "code": "INVALID_ROLE"}
    
    # Check if username already exists
    if User.objects.filter(username=payload.username).exists():
        return 400, {"error": "Username already taken", "code": "USERNAME_EXISTS"}
    
    # Check if email already exists
    if User.objects.filter(email=payload.email).exists():
        return 400, {"error": "Email already registered", "code": "EMAIL_EXISTS"}
    
    try:
        with transaction.atomic():
            # Create user
            user = User.objects.create_user(
                username=payload.username,
                email=payload.email,
                password=payload.password,
                first_name=payload.first_name or '',
                last_name=payload.last_name or '',
                role=role,
            )
            
            # Create role-specific profile
            _create_role_specific_profile(user)
            
            # Generate API token (token-based auth, no session needed)
            token_obj = AuthToken.objects.create(user=user)
            
            logger.info(f"New user registered: {user.username} with role {user.role}")
            
            # Send welcome email (async/non-blocking)
            try:
                email_service.send_welcome_email(user)
            except Exception as email_error:
                logger.warning(f"Failed to send welcome email: {email_error}")
            
            return 201, {
                "message": "Registration successful",
                "user": UserResponseSchema.model_validate(user),
                "token": {
                    "token": token_obj.token,
                    "token_type": "Bearer",
                    "expires_at": token_obj.expires_at,
                }
            }
    except Exception as e:
        logger.error(f"Registration failed: {e}")
        return 400, {"error": "Registration failed. Please try again.", "code": "REGISTRATION_FAILED"}


@router.post(
    "/login/resend-2fa",
    response={200: MessageSchema, 400: ErrorSchema, 401: ErrorSchema},
    summary="Resend 2FA Code",
    description="Resend the 2FA verification code to user's email.",
)
def resend_2fa_code(request, payload: LoginSchema):
    """
    Resend 2FA verification code.
    Requires username and password for security.
    """
    user = authenticate(
        request,
        username=payload.username,
        password=payload.password
    )
    
    if user is None:
        return 401, {"error": "Invalid credentials", "code": "INVALID_CREDENTIALS"}
    
    # Create and send new code (2FA is now required for all users)
    verification = EmailVerificationCode.create_code(
        user=user,
        purpose=EmailVerificationCode.Purpose.TWO_FACTOR_AUTH,
        expiry_minutes=10
    )
    email_service.send_2fa_code(user, verification.code)
    
    return 200, {"message": "Verification code sent to your email"}


# =============================================================================
# Logout Endpoints
# =============================================================================

@router.post(
    "/logout",
    response={200: LogoutResponseSchema, 401: ErrorSchema},
    summary="User Logout",
    description="End user session and invalidate tokens.",
)
def logout_view(request):
    """
    Logout the current user.
    
    - Clears the session
    - Invalidates the current API token (if provided)
    """
    if not request.user.is_authenticated:
        return 401, {"error": "Not authenticated", "code": "NOT_AUTHENTICATED"}
    
    # Invalidate token if provided in header
    auth_header = request.headers.get('Authorization', '')
    if auth_header.startswith('Bearer '):
        token = auth_header[7:]
        AuthToken.objects.filter(token=token, user=request.user).delete()
    
    # Clear session
    logout(request)
    
    return 200, {"message": "Logout successful"}


@router.post(
    "/logout/all",
    response={200: LogoutResponseSchema, 401: ErrorSchema},
    summary="Logout All Sessions",
    description="End all user sessions and invalidate all tokens.",
)
def logout_all_view(request):
    """
    Logout from all sessions and invalidate all API tokens.
    Useful when user suspects account compromise.
    """
    if not request.user.is_authenticated:
        return 401, {"error": "Not authenticated", "code": "NOT_AUTHENTICATED"}
    
    # Delete all tokens for this user
    AuthToken.objects.filter(user=request.user).delete()
    
    # Clear current session
    logout(request)
    
    return 200, {"message": "Logged out from all sessions"}


# =============================================================================
# Two-Factor Authentication (2FA)
# =============================================================================

@router.get(
    "/2fa/status",
    response={200: TwoFactorStatusSchema, 401: ErrorSchema},
    summary="Get 2FA Status",
    description="Check if 2FA is enabled for the current user.",
)
def get_2fa_status(request):
    """Get the current 2FA status for the authenticated user."""
    if not request.user.is_authenticated:
        return 401, {"error": "Not authenticated", "code": "NOT_AUTHENTICATED"}
    
    return 200, {
        "is_2fa_enabled": request.user.is_2fa_enabled,
        "message": "2FA is enabled" if request.user.is_2fa_enabled else "2FA is disabled"
    }


@router.post(
    "/2fa/enable",
    response={200: MessageSchema, 400: ErrorSchema, 401: ErrorSchema},
    summary="Enable 2FA",
    description="Enable two-factor authentication for the current user.",
)
def enable_2fa(request, payload: Enable2FASchema):
    """
    Enable 2FA for the authenticated user.
    Sends a verification code to confirm email ownership.
    """
    if not request.user.is_authenticated:
        return 401, {"error": "Not authenticated", "code": "NOT_AUTHENTICATED"}
    
    user = request.user
    
    # Verify password
    if not user.check_password(payload.password):
        return 400, {"error": "Invalid password", "code": "INVALID_PASSWORD"}
    
    if user.is_2fa_enabled:
        return 400, {"error": "2FA is already enabled", "code": "2FA_ALREADY_ENABLED"}
    
    if not user.email:
        return 400, {"error": "Email address is required for 2FA", "code": "EMAIL_REQUIRED"}
    
    # Send verification code
    verification = EmailVerificationCode.create_code(
        user=user,
        purpose=EmailVerificationCode.Purpose.TWO_FACTOR_AUTH,
        expiry_minutes=10
    )
    email_service.send_2fa_code(user, verification.code)
    
    return 200, {"message": "Verification code sent to your email. Use /2fa/enable/verify to complete setup."}


@router.post(
    "/2fa/enable/verify",
    response={200: TwoFactorStatusSchema, 400: ErrorSchema, 401: ErrorSchema},
    summary="Verify and Complete 2FA Setup",
    description="Verify the code and enable 2FA.",
)
def verify_enable_2fa(request, payload: Verify2FASchema):
    """
    Verify the code and enable 2FA for the user.
    """
    if not request.user.is_authenticated:
        return 401, {"error": "Not authenticated", "code": "NOT_AUTHENTICATED"}
    
    user = request.user
    
    # Find the verification code
    verification = EmailVerificationCode.objects.filter(
        user=user,
        purpose=EmailVerificationCode.Purpose.TWO_FACTOR_AUTH,
        is_used=False,
    ).order_by('-created_at').first()
    
    if not verification or not verification.is_valid:
        return 400, {"error": "Invalid or expired verification code", "code": "INVALID_CODE"}
    
    if verification.code != payload.code:
        verification.increment_attempts()
        return 400, {"error": "Invalid verification code", "code": "INVALID_CODE"}
    
    # Enable 2FA
    verification.mark_used()
    user.is_2fa_enabled = True
    user.save(update_fields=['is_2fa_enabled'])
    
    # Send confirmation email
    email_service.send_2fa_enabled_notification(user)
    
    logger.info(f"2FA enabled for user: {user.username}")
    
    return 200, {
        "is_2fa_enabled": True,
        "message": "Two-factor authentication has been enabled successfully"
    }


@router.post(
    "/2fa/disable",
    response={200: TwoFactorStatusSchema, 400: ErrorSchema, 401: ErrorSchema},
    summary="Disable 2FA",
    description="Disable two-factor authentication for the current user.",
)
def disable_2fa(request, payload: Enable2FASchema):
    """
    Disable 2FA for the authenticated user.
    Requires password verification.
    """
    if not request.user.is_authenticated:
        return 401, {"error": "Not authenticated", "code": "NOT_AUTHENTICATED"}
    
    user = request.user
    
    # Verify password
    if not user.check_password(payload.password):
        return 400, {"error": "Invalid password", "code": "INVALID_PASSWORD"}
    
    if not user.is_2fa_enabled:
        return 400, {"error": "2FA is not enabled", "code": "2FA_NOT_ENABLED"}
    
    # Disable 2FA
    user.is_2fa_enabled = False
    user.save(update_fields=['is_2fa_enabled'])
    
    logger.info(f"2FA disabled for user: {user.username}")
    
    return 200, {
        "is_2fa_enabled": False,
        "message": "Two-factor authentication has been disabled"
    }


# =============================================================================
# Password Reset (Forgot Password)
# =============================================================================

@router.post(
    "/password/forgot",
    response={200: MessageSchema, 400: ErrorSchema},
    summary="Request Password Reset",
    description="Request a password reset. Sends a verification code to the user's email.",
)
def forgot_password(request, payload: PasswordResetRequestSchema):
    """
    Request a password reset.
    
    - Sends a 6-digit verification code to the provided email
    - Code expires in 10 minutes
    - Always returns success to prevent email enumeration
    """
    try:
        user = User.objects.get(email=payload.email, is_active=True)
        
        # Create verification code
        verification = EmailVerificationCode.create_code(
            user=user,
            purpose=EmailVerificationCode.Purpose.PASSWORD_RESET,
            expiry_minutes=10
        )
        
        # Send email with code
        email_service.send_password_reset_code(user, verification.code)
        
        logger.info(f"Password reset code sent to: {payload.email}")
        
    except User.DoesNotExist:
        # Don't reveal if email exists
        logger.warning(f"Password reset requested for non-existent email: {payload.email}")
    
    # Always return success to prevent email enumeration
    return 200, {"message": "If an account exists with this email, a password reset code has been sent."}


@router.post(
    "/password/forgot/link",
    response={200: MessageSchema, 400: ErrorSchema},
    summary="Request Password Reset Link",
    description="Request a password reset link. Sends a reset link to the user's email.",
)
def forgot_password_link(request, payload: PasswordResetRequestSchema):
    """
    Request a password reset link (alternative to code-based reset).
    
    - Sends a unique reset link to the provided email
    - Link expires in 1 hour
    """
    try:
        user = User.objects.get(email=payload.email, is_active=True)
        
        # Create reset token
        token = PasswordResetToken.create_token(user)
        
        # Send email with link
        email_service.send_password_reset_link(user, token.token)
        
        logger.info(f"Password reset link sent to: {payload.email}")
        
    except User.DoesNotExist:
        logger.warning(f"Password reset link requested for non-existent email: {payload.email}")
    
    return 200, {"message": "If an account exists with this email, a password reset link has been sent."}


@router.post(
    "/password/verify-code",
    response={200: MessageSchema, 400: ErrorSchema},
    summary="Verify Password Reset Code",
    description="Verify the password reset code before setting new password.",
)
def verify_reset_code(request, payload: PasswordResetVerifySchema):
    """
    Verify that the password reset code is valid.
    Use this to validate the code before showing the password reset form.
    """
    try:
        user = User.objects.get(email=payload.email, is_active=True)
    except User.DoesNotExist:
        return 400, {"error": "Invalid email or code", "code": "INVALID_CODE"}
    
    verification = EmailVerificationCode.objects.filter(
        user=user,
        purpose=EmailVerificationCode.Purpose.PASSWORD_RESET,
        is_used=False,
    ).order_by('-created_at').first()
    
    if not verification or not verification.is_valid:
        return 400, {"error": "Invalid or expired code", "code": "INVALID_CODE"}
    
    if verification.code != payload.code:
        verification.increment_attempts()
        return 400, {"error": "Invalid code", "code": "INVALID_CODE"}
    
    return 200, {"message": "Code verified successfully. You can now reset your password."}


@router.post(
    "/password/reset",
    response={200: MessageSchema, 400: ErrorSchema},
    summary="Reset Password with Code",
    description="Reset password using the verification code sent to email.",
)
def reset_password(request, payload: PasswordResetConfirmSchema):
    """
    Reset password using the verification code.
    
    - **email**: User's email address
    - **code**: 6-digit verification code
    - **new_password**: New password (min 8 characters)
    - **confirm_password**: Must match new_password
    """
    # Validate passwords match
    if payload.new_password != payload.confirm_password:
        return 400, {"error": "Passwords do not match", "code": "PASSWORD_MISMATCH"}
    
    try:
        user = User.objects.get(email=payload.email, is_active=True)
    except User.DoesNotExist:
        return 400, {"error": "Invalid email or code", "code": "INVALID_REQUEST"}
    
    verification = EmailVerificationCode.objects.filter(
        user=user,
        purpose=EmailVerificationCode.Purpose.PASSWORD_RESET,
        is_used=False,
    ).order_by('-created_at').first()
    
    if not verification or not verification.is_valid:
        return 400, {"error": "Invalid or expired code", "code": "INVALID_CODE"}
    
    if verification.code != payload.code:
        verification.increment_attempts()
        return 400, {"error": "Invalid code", "code": "INVALID_CODE"}
    
    # Reset password
    with transaction.atomic():
        verification.mark_used()
        user.set_password(payload.new_password)
        user.save(update_fields=['password'])
        
        # Invalidate all tokens
        AuthToken.objects.filter(user=user).delete()
        
        # Invalidate all unused reset codes
        EmailVerificationCode.objects.filter(
            user=user,
            purpose=EmailVerificationCode.Purpose.PASSWORD_RESET,
            is_used=False
        ).update(is_used=True)
    
    # Send confirmation email
    email_service.send_password_changed_notification(user)
    
    logger.info(f"Password reset successful for user: {user.username}")
    
    return 200, {"message": "Password has been reset successfully. You can now login with your new password."}


@router.post(
    "/password/reset/token",
    response={200: MessageSchema, 400: ErrorSchema},
    summary="Reset Password with Token",
    description="Reset password using the token from the reset link.",
)
def reset_password_with_token(request, payload: PasswordResetTokenConfirmSchema):
    """
    Reset password using the token from the email link.
    
    - **token**: Token from the password reset link
    - **new_password**: New password (min 8 characters)
    - **confirm_password**: Must match new_password
    """
    # Validate passwords match
    if payload.new_password != payload.confirm_password:
        return 400, {"error": "Passwords do not match", "code": "PASSWORD_MISMATCH"}
    
    try:
        reset_token = PasswordResetToken.objects.select_related('user').get(token=payload.token)
    except PasswordResetToken.DoesNotExist:
        return 400, {"error": "Invalid or expired reset link", "code": "INVALID_TOKEN"}
    
    if not reset_token.is_valid:
        return 400, {"error": "This reset link has expired or already been used", "code": "EXPIRED_TOKEN"}
    
    user = reset_token.user
    
    # Reset password
    with transaction.atomic():
        reset_token.mark_used()
        user.set_password(payload.new_password)
        user.save(update_fields=['password'])
        
        # Invalidate all tokens
        AuthToken.objects.filter(user=user).delete()
    
    # Send confirmation email
    email_service.send_password_changed_notification(user)
    
    logger.info(f"Password reset via token successful for user: {user.username}")
    
    return 200, {"message": "Password has been reset successfully. You can now login with your new password."}


# =============================================================================
# Session & Token Validation
# =============================================================================

@router.get(
    "/me",
    response={200: UserResponseSchema, 401: ErrorSchema},
    summary="Get Current User",
    description="Get the currently authenticated user's information.",
)
def get_current_user(request):
    """
    Get current authenticated user's profile.
    Works with both session and token authentication.
    """
    if not request.user.is_authenticated:
        return 401, {"error": "Not authenticated", "code": "NOT_AUTHENTICATED"}
    
    return 200, UserResponseSchema.model_validate(request.user)


@router.get(
    "/validate",
    response={200: MessageSchema, 401: ErrorSchema},
    summary="Validate Session/Token",
    description="Check if current session or token is valid.",
)
def validate_session(request):
    """
    Validate the current authentication status.
    Returns success if authenticated, error otherwise.
    """
    if not request.user.is_authenticated:
        return 401, {"error": "Not authenticated", "code": "NOT_AUTHENTICATED"}
    
    return 200, {"message": "Session is valid"}


@router.get(
    "/csrf",
    response={200: dict},
    summary="Get CSRF Token",
    description="Get a CSRF token for form submissions.",
)
def get_csrf_token(request):
    """
    Get a CSRF token for use in form submissions.
    Include this token in the X-CSRFToken header for POST/PUT/DELETE requests.
    """
    return {"csrfToken": get_token(request)}


# =============================================================================
# Password Change (for authenticated users)
# =============================================================================

@router.post(
    "/password/change",
    response={200: MessageSchema, 400: ErrorSchema, 401: ErrorSchema},
    summary="Change Password",
    description="Change the current user's password.",
)
def change_password(request, payload: PasswordChangeSchema):
    """
    Change password for the authenticated user.
    
    - **current_password**: Current password for verification
    - **new_password**: New password (min 8 characters)
    - **confirm_password**: Must match new_password
    """
    if not request.user.is_authenticated:
        return 401, {"error": "Not authenticated", "code": "NOT_AUTHENTICATED"}
    
    user = request.user
    
    # Verify current password
    if not user.check_password(payload.current_password):
        return 400, {"error": "Current password is incorrect", "code": "INVALID_PASSWORD"}
    
    # Verify passwords match
    if payload.new_password != payload.confirm_password:
        return 400, {"error": "New passwords do not match", "code": "PASSWORD_MISMATCH"}
    
    # Verify new password is different
    if payload.current_password == payload.new_password:
        return 400, {"error": "New password must be different from current password", "code": "SAME_PASSWORD"}
    
    # Set new password
    user.set_password(payload.new_password)
    user.save()
    
    # Invalidate all existing tokens (security measure)
    AuthToken.objects.filter(user=user).delete()
    
    # Re-login to refresh session
    login(request, user)
    
    # Send notification
    email_service.send_password_changed_notification(user)
    
    return 200, {"message": "Password changed successfully"}


# =============================================================================
# Token Management
# =============================================================================

@router.post(
    "/token/refresh",
    response={200: dict, 401: ErrorSchema},
    summary="Refresh API Token",
    description="Get a new API token (invalidates the current one).",
)
def refresh_token(request):
    """
    Refresh the current API token.
    The old token will be invalidated.
    """
    if not request.user.is_authenticated:
        return 401, {"error": "Not authenticated", "code": "NOT_AUTHENTICATED"}
    
    # Get current token from header
    auth_header = request.headers.get('Authorization', '')
    if auth_header.startswith('Bearer '):
        old_token = auth_header[7:]
        AuthToken.objects.filter(token=old_token, user=request.user).delete()
    
    # Create new token
    token_obj = AuthToken.objects.create(user=request.user)
    
    return 200, {
        "token": token_obj.token,
        "token_type": "Bearer",
        "expires_at": token_obj.expires_at.isoformat() if token_obj.expires_at else None,
    }
