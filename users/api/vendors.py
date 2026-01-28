"""
Vendor management API endpoints.
Super Admin only access for all endpoints.
"""

import logging
from typing import List, Optional
from django.contrib.auth import get_user_model
from django.db import transaction
from ninja import Router
from ninja.errors import HttpError

from users.models import Vendor
from users.schemas import (
    VendorResponseSchema,
    VendorCreateSchema,
    VendorUpdateSchema,
    VendorListSchema,
    ErrorSchema,
    MessageSchema,
)
from core.permissions import is_super_admin

User = get_user_model()
logger = logging.getLogger(__name__)

router = Router(tags=["Vendor Management"])


# =============================================================================
# Helper Functions
# =============================================================================

def check_super_admin(request):
    """Check if user is authenticated and is a Super Admin."""
    if not request.user.is_authenticated:
        return 401, {"error": "Not authenticated", "code": "NOT_AUTHENTICATED"}
    
    if not is_super_admin(request):
        return 403, {"error": "Super Admin access required", "code": "PERMISSION_DENIED"}
    
    return None


# =============================================================================
# Vendor Management Endpoints
# =============================================================================

@router.get(
    "/vendors",
    response={200: List[VendorResponseSchema], 401: ErrorSchema, 403: ErrorSchema},
    summary="List All Vendors",
    description="Get list of all vendors. Super Admin only.",
)
def list_vendors(
    request,
    is_active: Optional[bool] = None,
    search: Optional[str] = None,
):
    """
    Get list of all vendors with optional filtering.
    Only accessible by Super Admin users.
    
    Query Parameters:
    - is_active: Filter by active status (true/false)
    - search: Search by company name, contact email, or city
    """
    auth_error = check_super_admin(request)
    if auth_error:
        return auth_error
    
    vendors = Vendor.objects.select_related('user').all()
    
    # Apply filters
    if is_active is not None:
        vendors = vendors.filter(is_active=is_active)
    
    if search:
        from django.db.models import Q
        vendors = vendors.filter(
            Q(company_name__icontains=search) |
            Q(contact_email__icontains=search) |
            Q(city__icontains=search) |
            Q(user__email__icontains=search)
        )
    
    vendors = vendors.order_by('-created_at')
    
    return 200, [VendorResponseSchema.from_orm_with_user(v) for v in vendors]


@router.post(
    "/vendors",
    response={201: VendorResponseSchema, 400: ErrorSchema, 401: ErrorSchema, 403: ErrorSchema},
    summary="Add New Vendor",
    description="Create a new vendor with associated user account. Super Admin only.",
)
def create_vendor(request, payload: VendorCreateSchema):
    """
    Create a new vendor with associated user account.
    Only accessible by Super Admin users.
    
    The vendor is approved and active by default (no approval workflow).
    
    Payload should include:
    - User account details (username, email, password)
    - Company information (company_name, contact details)
    - Optional location information
    """
    auth_error = check_super_admin(request)
    if auth_error:
        return auth_error
    
    # Validate unique constraints
    if User.objects.filter(username=payload.username).exists():
        return 400, {"error": "Username already exists", "code": "USERNAME_EXISTS"}
    
    if User.objects.filter(email=payload.email).exists():
        return 400, {"error": "Email already registered", "code": "EMAIL_EXISTS"}
    
    if payload.contact_email and Vendor.objects.filter(contact_email=payload.contact_email).exists():
        return 400, {"error": "Contact email already in use by another vendor", "code": "CONTACT_EMAIL_EXISTS"}
    
    try:
        with transaction.atomic():
            # Create user account with VENDOR role
            user = User.objects.create_user(
                username=payload.username,
                email=payload.email,
                password=payload.password,
                first_name=payload.first_name or '',
                last_name=payload.last_name or '',
                role='VENDOR',
                is_active=True,  # Active by default
            )
            
            # Create vendor profile (approved by default, no workflow)
            vendor = Vendor.objects.create(
                user=user,
                company_name=payload.company_name,
                contact_email=payload.contact_email or payload.email,
                contact_phone=payload.contact_phone or '',
                address=payload.address or '',
                city=payload.city or '',
                state=payload.state or '',
                postal_code=payload.postal_code or '',
                country=payload.country or 'USA',
                is_active=True,  # Active by default
            )
            
            logger.info(f"New vendor '{vendor.company_name}' created by Super Admin {request.user.username}")
            
            return 201, VendorResponseSchema.from_orm_with_user(vendor)
            
    except Exception as e:
        logger.error(f"Vendor creation failed: {e}")
        return 400, {"error": f"Failed to create vendor: {str(e)}", "code": "VENDOR_CREATION_FAILED"}


@router.get(
    "/vendors/{vendor_id}",
    response={200: VendorResponseSchema, 401: ErrorSchema, 403: ErrorSchema, 404: ErrorSchema},
    summary="Get Vendor Details",
    description="Get details of a specific vendor. Super Admin only.",
)
def get_vendor(request, vendor_id: int):
    """
    Get details of a specific vendor by ID.
    Only accessible by Super Admin users.
    """
    auth_error = check_super_admin(request)
    if auth_error:
        return auth_error
    
    try:
        vendor = Vendor.objects.select_related('user').get(id=vendor_id)
        return 200, VendorResponseSchema.from_orm_with_user(vendor)
    except Vendor.DoesNotExist:
        return 404, {"error": "Vendor not found", "code": "VENDOR_NOT_FOUND"}


@router.put(
    "/vendors/{vendor_id}",
    response={200: VendorResponseSchema, 400: ErrorSchema, 401: ErrorSchema, 403: ErrorSchema, 404: ErrorSchema},
    summary="Update Vendor Details",
    description="Update vendor details. Super Admin only.",
)
def update_vendor(request, vendor_id: int, payload: VendorUpdateSchema):
    """
    Update vendor details.
    Only accessible by Super Admin users.
    
    Payload can include:
    - Company information (company_name, contact details)
    - Location information (address, city, state, etc.)
    - User info (first_name, last_name, email)
    
    Note: Use activate/deactivate endpoints for status changes.
    """
    auth_error = check_super_admin(request)
    if auth_error:
        return auth_error
    
    try:
        vendor = Vendor.objects.select_related('user').get(id=vendor_id)
    except Vendor.DoesNotExist:
        return 404, {"error": "Vendor not found", "code": "VENDOR_NOT_FOUND"}
    
    try:
        with transaction.atomic():
            # Update vendor fields
            if payload.company_name is not None:
                vendor.company_name = payload.company_name
            
            if payload.contact_email is not None:
                # Check uniqueness
                if Vendor.objects.filter(contact_email=payload.contact_email).exclude(id=vendor_id).exists():
                    return 400, {"error": "Contact email already in use", "code": "CONTACT_EMAIL_EXISTS"}
                vendor.contact_email = payload.contact_email
            
            if payload.contact_phone is not None:
                vendor.contact_phone = payload.contact_phone
            
            if payload.address is not None:
                vendor.address = payload.address
            
            if payload.city is not None:
                vendor.city = payload.city
            
            if payload.state is not None:
                vendor.state = payload.state
            
            if payload.postal_code is not None:
                vendor.postal_code = payload.postal_code
            
            if payload.country is not None:
                vendor.country = payload.country
            
            vendor.save()
            
            # Update associated user fields if provided
            user = vendor.user
            user_updated = False
            
            if payload.first_name is not None:
                user.first_name = payload.first_name
                user_updated = True
            
            if payload.last_name is not None:
                user.last_name = payload.last_name
                user_updated = True
            
            if payload.email is not None:
                # Check uniqueness
                if User.objects.filter(email=payload.email).exclude(id=user.id).exists():
                    return 400, {"error": "Email already in use", "code": "EMAIL_EXISTS"}
                user.email = payload.email
                user_updated = True
            
            if user_updated:
                user.save()
            
            logger.info(f"Vendor '{vendor.company_name}' updated by Super Admin {request.user.username}")
            
            return 200, VendorResponseSchema.from_orm_with_user(vendor)
            
    except Exception as e:
        logger.error(f"Vendor update failed: {e}")
        return 400, {"error": f"Failed to update vendor: {str(e)}", "code": "VENDOR_UPDATE_FAILED"}


@router.post(
    "/vendors/{vendor_id}/activate",
    response={200: VendorResponseSchema, 401: ErrorSchema, 403: ErrorSchema, 404: ErrorSchema},
    summary="Activate Vendor",
    description="Activate a vendor account. Super Admin only.",
)
def activate_vendor(request, vendor_id: int):
    """
    Activate a vendor account.
    This enables both the vendor profile and the associated user account.
    Only accessible by Super Admin users.
    """
    auth_error = check_super_admin(request)
    if auth_error:
        return auth_error
    
    try:
        vendor = Vendor.objects.select_related('user').get(id=vendor_id)
    except Vendor.DoesNotExist:
        return 404, {"error": "Vendor not found", "code": "VENDOR_NOT_FOUND"}
    
    if vendor.is_active and vendor.user.is_active:
        return 200, VendorResponseSchema.from_orm_with_user(vendor)  # Already active
    
    with transaction.atomic():
        vendor.is_active = True
        vendor.save(update_fields=['is_active', 'updated_at'])
        
        vendor.user.is_active = True
        vendor.user.save(update_fields=['is_active'])
    
    logger.info(f"Vendor '{vendor.company_name}' activated by Super Admin {request.user.username}")
    
    return 200, VendorResponseSchema.from_orm_with_user(vendor)


@router.post(
    "/vendors/{vendor_id}/deactivate",
    response={200: VendorResponseSchema, 401: ErrorSchema, 403: ErrorSchema, 404: ErrorSchema},
    summary="Deactivate Vendor",
    description="Deactivate a vendor account. Super Admin only.",
)
def deactivate_vendor(request, vendor_id: int):
    """
    Deactivate a vendor account.
    This disables both the vendor profile and the associated user account.
    The vendor will no longer be able to log in.
    Only accessible by Super Admin users.
    """
    auth_error = check_super_admin(request)
    if auth_error:
        return auth_error
    
    try:
        vendor = Vendor.objects.select_related('user').get(id=vendor_id)
    except Vendor.DoesNotExist:
        return 404, {"error": "Vendor not found", "code": "VENDOR_NOT_FOUND"}
    
    if not vendor.is_active and not vendor.user.is_active:
        return 200, VendorResponseSchema.from_orm_with_user(vendor)  # Already inactive
    
    with transaction.atomic():
        vendor.is_active = False
        vendor.save(update_fields=['is_active', 'updated_at'])
        
        vendor.user.is_active = False
        vendor.user.save(update_fields=['is_active'])
    
    logger.info(f"Vendor '{vendor.company_name}' deactivated by Super Admin {request.user.username}")
    
    return 200, VendorResponseSchema.from_orm_with_user(vendor)


@router.delete(
    "/vendors/{vendor_id}",
    response={200: MessageSchema, 401: ErrorSchema, 403: ErrorSchema, 404: ErrorSchema},
    summary="Delete Vendor",
    description="Permanently delete a vendor and associated user account. Super Admin only.",
)
def delete_vendor(request, vendor_id: int):
    """
    Permanently delete a vendor and their associated user account.
    Only accessible by Super Admin users.
    
    Warning: This action is irreversible. Consider deactivating instead.
    """
    auth_error = check_super_admin(request)
    if auth_error:
        return auth_error
    
    try:
        vendor = Vendor.objects.select_related('user').get(id=vendor_id)
    except Vendor.DoesNotExist:
        return 404, {"error": "Vendor not found", "code": "VENDOR_NOT_FOUND"}
    
    company_name = vendor.company_name
    user = vendor.user
    
    with transaction.atomic():
        vendor.delete()
        user.delete()
    
    logger.info(f"Vendor '{company_name}' deleted by Super Admin {request.user.username}")
    
    return 200, {"message": f"Vendor '{company_name}' deleted successfully"}
