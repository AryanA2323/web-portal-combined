"""
Pydantic schemas for API request/response validation.
"""

from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, EmailStr, Field


# =============================================================================
# Authentication Schemas
# =============================================================================

class LoginSchema(BaseModel):
    """Schema for login request."""
    username: str = Field(..., min_length=1, max_length=150)
    password: str = Field(..., min_length=1)


class LoginWith2FASchema(BaseModel):
    """Schema for login with 2FA code."""
    username: str = Field(..., min_length=1, max_length=150)
    password: str = Field(..., min_length=1)
    code: Optional[str] = Field(default=None, min_length=6, max_length=6)


class TokenSchema(BaseModel):
    """Schema for token response."""
    token: str
    token_type: str = "Bearer"
    expires_at: Optional[datetime] = None


class LoginResponseSchema(BaseModel):
    """Schema for successful login response."""
    message: str
    user: 'UserResponseSchema'
    token: Optional[TokenSchema] = None


class Login2FARequiredSchema(BaseModel):
    """Schema when 2FA is required."""
    message: str = "Two-factor authentication required"
    requires_2fa: bool = True
    username: str


class LogoutResponseSchema(BaseModel):
    """Schema for logout response."""
    message: str


class PasswordChangeSchema(BaseModel):
    """Schema for password change request."""
    current_password: str = Field(..., min_length=1)
    new_password: str = Field(..., min_length=8)
    confirm_password: str = Field(..., min_length=8)


class PasswordResetRequestSchema(BaseModel):
    """Schema for password reset request."""
    email: EmailStr


class PasswordResetVerifySchema(BaseModel):
    """Schema for verifying password reset code."""
    email: EmailStr
    code: str = Field(..., min_length=6, max_length=6)


class PasswordResetConfirmSchema(BaseModel):
    """Schema for password reset confirmation with code."""
    email: EmailStr
    code: str = Field(..., min_length=6, max_length=6)
    new_password: str = Field(..., min_length=8)
    confirm_password: str = Field(..., min_length=8)


class PasswordResetTokenConfirmSchema(BaseModel):
    """Schema for password reset confirmation with token (link-based)."""
    token: str
    new_password: str = Field(..., min_length=8)
    confirm_password: str = Field(..., min_length=8)


# =============================================================================
# Two-Factor Authentication Schemas
# =============================================================================

class Enable2FASchema(BaseModel):
    """Schema for enabling 2FA."""
    password: str = Field(..., min_length=1, description="Current password for verification")


class Verify2FASchema(BaseModel):
    """Schema for verifying 2FA code."""
    code: str = Field(..., min_length=6, max_length=6)


class TwoFactorStatusSchema(BaseModel):
    """Schema for 2FA status response."""
    is_2fa_enabled: bool
    message: str


# =============================================================================
# User Schemas
# =============================================================================

class UserResponseSchema(BaseModel):
    """Schema for user response."""
    id: int
    username: str
    email: str
    first_name: str
    last_name: str
    role: str
    sub_role: Optional[str] = None
    permissions: Optional[List[str]] = None
    is_active: bool
    is_2fa_enabled: bool
    date_joined: datetime
    last_login: Optional[datetime] = None
    
    class Config:
        from_attributes = True


class UserCreateSchema(BaseModel):
    """Schema for user creation."""
    username: str = Field(..., min_length=3, max_length=150)
    email: EmailStr
    password: str = Field(..., min_length=8)
    first_name: str = Field(default="", max_length=150)
    last_name: str = Field(default="", max_length=150)
    role: str = Field(default="CLIENT")


class UserUpdateSchema(BaseModel):
    """Schema for user update."""
    email: Optional[EmailStr] = None
    first_name: Optional[str] = Field(default=None, max_length=150)
    last_name: Optional[str] = Field(default=None, max_length=150)
    role: Optional[str] = None
    sub_role: Optional[str] = None
    permissions: Optional[List[str]] = None
    is_active: Optional[bool] = None


class UserListSchema(BaseModel):
    """Schema for paginated user list."""
    count: int
    users: List[UserResponseSchema]


# =============================================================================
# Error Schemas
# =============================================================================

class ErrorSchema(BaseModel):
    """Schema for error response."""
    error: str
    detail: Optional[str] = None
    code: Optional[str] = None


class ValidationErrorSchema(BaseModel):
    """Schema for validation error response."""
    error: str = "Validation error"
    details: List[dict]


# =============================================================================
# General Schemas
# =============================================================================

class MessageSchema(BaseModel):
    """Schema for simple message response."""
    message: str


class HealthCheckSchema(BaseModel):
    """Schema for health check response."""
    status: str
    version: str
    timestamp: datetime


# =============================================================================
# Vendor Schemas
# =============================================================================

class VendorUserSchema(BaseModel):
    """Schema for vendor's associated user info."""
    id: int
    username: str
    email: str
    first_name: str
    last_name: str
    is_active: bool
    date_joined: datetime
    last_login: Optional[datetime] = None
    
    class Config:
        from_attributes = True


class VendorResponseSchema(BaseModel):
    """Schema for vendor response."""
    id: int
    company_name: str
    contact_email: str
    contact_phone: str
    address: str
    city: str
    state: str
    postal_code: str
    country: str
    is_active: bool
    created_at: datetime
    updated_at: datetime
    user: VendorUserSchema
    
    class Config:
        from_attributes = True
    
    @classmethod
    def from_orm_with_user(cls, vendor):
        """Create schema from Vendor ORM object with related user."""
        return cls(
            id=vendor.id,
            company_name=vendor.company_name,
            contact_email=vendor.contact_email,
            contact_phone=vendor.contact_phone,
            address=vendor.address,
            city=vendor.city,
            state=vendor.state,
            postal_code=vendor.postal_code,
            country=vendor.country,
            is_active=vendor.is_active,
            created_at=vendor.created_at,
            updated_at=vendor.updated_at,
            user=VendorUserSchema(
                id=vendor.user.id,
                username=vendor.user.username,
                email=vendor.user.email,
                first_name=vendor.user.first_name,
                last_name=vendor.user.last_name,
                is_active=vendor.user.is_active,
                date_joined=vendor.user.date_joined,
                last_login=vendor.user.last_login,
            )
        )


class VendorCreateSchema(BaseModel):
    """Schema for creating a new vendor."""
    # User account fields
    username: str = Field(..., min_length=3, max_length=150)
    email: EmailStr
    password: str = Field(..., min_length=8)
    first_name: str = Field(default="", max_length=150)
    last_name: str = Field(default="", max_length=150)
    
    # Vendor company fields
    company_name: str = Field(..., min_length=1, max_length=255)
    contact_email: Optional[EmailStr] = None
    contact_phone: Optional[str] = Field(default="", max_length=20)
    
    # Location fields
    address: Optional[str] = ""
    city: Optional[str] = Field(default="", max_length=100)
    state: Optional[str] = Field(default="", max_length=100)
    postal_code: Optional[str] = Field(default="", max_length=20)
    country: Optional[str] = Field(default="USA", max_length=100)


class VendorUpdateSchema(BaseModel):
    """Schema for updating vendor details."""
    # Vendor company fields
    company_name: Optional[str] = Field(default=None, max_length=255)
    contact_email: Optional[EmailStr] = None
    contact_phone: Optional[str] = Field(default=None, max_length=20)
    
    # Location fields
    address: Optional[str] = None
    city: Optional[str] = Field(default=None, max_length=100)
    state: Optional[str] = Field(default=None, max_length=100)
    postal_code: Optional[str] = Field(default=None, max_length=20)
    country: Optional[str] = Field(default=None, max_length=100)
    
    # Associated user fields
    first_name: Optional[str] = Field(default=None, max_length=150)
    last_name: Optional[str] = Field(default=None, max_length=150)
    email: Optional[EmailStr] = None


class VendorListSchema(BaseModel):
    """Schema for paginated vendor list."""
    count: int
    vendors: List[VendorResponseSchema]