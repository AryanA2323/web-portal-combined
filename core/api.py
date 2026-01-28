"""
Main API configuration using Django Ninja.
"""

from ninja import NinjaAPI
from ninja.errors import ValidationError
from django.http import HttpRequest
from pydantic import ValidationError as PydanticValidationError

from users.api.auth import router as auth_router
from users.api.users import router as users_router
from users.api.vendors import router as vendors_router
from users.api.vendor_cases import router as vendor_cases_router
from users.api.super_admin import router as super_admin_router
from users.api.cases import router as cases_router
from users.auth import SessionOrTokenAuth


# =============================================================================
# API Instance Configuration
# =============================================================================

api = NinjaAPI(
    title="Incident Management Platform API",
    version="1.0.0",
    description="""
    REST API for the Incident Management Platform.
    
    ## Authentication
    
    This API supports two authentication methods:
    
    1. **Session-based**: Login via `/api/auth/login` to get a session cookie
    2. **Token-based**: Use the Bearer token from login response in the `Authorization` header
    
    ## Authorization
    
    Endpoints are protected based on user roles:
    - **ADMIN**: Full access to all resources
    - **VENDOR**: Access to assigned cases and own profile
    - **CLIENT**: Access to own cases and profile
    """,
    docs_url="/docs",
    openapi_url="/openapi.json",
)


# =============================================================================
# Error Handlers
# =============================================================================

@api.exception_handler(ValidationError)
def validation_error_handler(request: HttpRequest, exc: ValidationError):
    """Handle Ninja validation errors."""
    return api.create_response(
        request,
        {"error": "Validation error", "details": exc.errors},
        status=422,
    )


@api.exception_handler(PydanticValidationError)
def pydantic_validation_error_handler(request: HttpRequest, exc: PydanticValidationError):
    """Handle Pydantic validation errors."""
    return api.create_response(
        request,
        {"error": "Validation error", "details": exc.errors()},
        status=422,
    )


@api.exception_handler(Exception)
def generic_error_handler(request: HttpRequest, exc: Exception):
    """Handle unexpected errors."""
    # In production, you might want to log this and return a generic message
    import traceback
    import logging
    logger = logging.getLogger(__name__)
    logger.error(f"Unhandled exception: {exc}")
    logger.error(traceback.format_exc())
    
    return api.create_response(
        request,
        {"error": "An unexpected error occurred", "detail": str(exc), "traceback": traceback.format_exc()},
        status=500,
    )


# =============================================================================
# Health Check Endpoint
# =============================================================================

@api.get(
    "/health",
    tags=["System"],
    summary="Health Check",
    description="Check if the API is running.",
)
def health_check(request):
    """API health check endpoint."""
    from datetime import datetime
    return {
        "status": "healthy",
        "version": "1.0.0",
        "timestamp": datetime.now().isoformat(),
    }


# =============================================================================
# Register Routers
# =============================================================================

api.add_router("/auth/", auth_router)
api.add_router("/", users_router, auth=SessionOrTokenAuth())
api.add_router("/", vendors_router, auth=SessionOrTokenAuth())
api.add_router("/", vendor_cases_router, auth=SessionOrTokenAuth())
api.add_router("/", super_admin_router, auth=SessionOrTokenAuth())
api.add_router("/", cases_router, auth=SessionOrTokenAuth())
