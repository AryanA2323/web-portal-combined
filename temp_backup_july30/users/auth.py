"""
Authentication utilities for Django Ninja API.
"""

import logging
from typing import Optional, Any
from django.http import HttpRequest
from ninja.security import HttpBearer, APIKeyHeader
from users.models import AuthToken
from datetime import datetime
from django.utils import timezone

logger = logging.getLogger(__name__)


class BearerTokenAuth(HttpBearer):
    """
    Bearer token authentication for Django Ninja.
    
    Usage in API routes:
        @router.get("/protected", auth=BearerTokenAuth())
        def protected_view(request):
            ...
    """
    
    def authenticate(self, request: HttpRequest, token: str) -> Optional[Any]:
        try:
            token_obj = AuthToken.objects.select_related('user').get(token=token)
        except AuthToken.DoesNotExist:
            return None
        
        # Check if token is expired
        if token_obj.is_expired:
            token_obj.delete()
            return None
        
        # Check if user is active
        if not token_obj.user.is_active:
            return None
        
        # Update last used timestamp
        token_obj.last_used_at = timezone.now()
        token_obj.save(update_fields=['last_used_at'])
        
        # Attach user to request
        request.user = token_obj.user
        return token_obj.user


class SessionOrTokenAuth:
    """
    Combined session and token authentication.
    Allows both session-based (cookie) and token-based authentication.
    
    Usage:
        @router.get("/protected", auth=SessionOrTokenAuth())
        def protected_view(request):
            ...
    """
    
    def __call__(self, request: HttpRequest) -> Optional[Any]:
        # First check if user is authenticated via session
        if request.user and request.user.is_authenticated:
            logger.info(f"Session auth success for user: {request.user.username}")
            return request.user

        # Then check for Bearer token
        auth_header = request.headers.get('Authorization', '')
        if auth_header.startswith('Bearer '):
            token = auth_header[7:]
            logger.info(f"Bearer token received, length: {len(token)}")
            try:
                token_obj = AuthToken.objects.select_related('user').get(token=token)

                if token_obj.is_expired:
                    logger.warning(f"Token expired for user: {token_obj.user.username}")
                    token_obj.delete()
                    return None

                if not token_obj.user.is_active:
                    logger.warning(f"User inactive: {token_obj.user.username}")
                    return None

                # Update last used
                token_obj.last_used_at = timezone.now()
                token_obj.save(update_fields=['last_used_at'])

                request.user = token_obj.user
                logger.info(f"Token auth success for user: {token_obj.user.username}, role: {token_obj.user.role}")
                return token_obj.user

            except AuthToken.DoesNotExist:
                logger.warning(f"Token not found in database: {token[:8]}...")
                return None
        else:
            logger.info(f"No Bearer token in Authorization header: '{auth_header[:30] if auth_header else 'empty'}'")

        return None


class OptionalAuth:
    """
    Optional authentication - doesn't fail if not authenticated.
    Useful for endpoints that behave differently for authenticated users.
    
    Usage:
        @router.get("/public", auth=OptionalAuth())
        def public_view(request):
            if request.user.is_authenticated:
                # Show personalized content
            else:
                # Show public content
    """
    
    def __call__(self, request: HttpRequest) -> Optional[Any]:
        auth = SessionOrTokenAuth()
        user = auth(request)
        
        # Always return True to allow the request
        # The view can check request.user.is_authenticated
        return True if user else True
