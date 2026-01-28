"""
Custom authentication backends for the incident management platform.
"""

from datetime import datetime
from django.contrib.auth.backends import ModelBackend
from django.contrib.auth import get_user_model

User = get_user_model()


class EmailOrUsernameBackend(ModelBackend):
    """
    Authentication backend that allows login with either username or email.
    """
    
    def authenticate(self, request, username=None, password=None, **kwargs):
        if username is None or password is None:
            return None
        
        # Try to find user by username first
        try:
            user = User.objects.get(username=username)
        except User.DoesNotExist:
            # Try to find by email
            try:
                user = User.objects.get(email=username)
            except User.DoesNotExist:
                return None
        
        if user.check_password(password) and self.user_can_authenticate(user):
            return user
        
        return None


class TokenAuthBackend:
    """
    Authentication backend for API token authentication.
    Used by the TokenAuthMiddleware.
    """
    
    def authenticate(self, request, token=None):
        if token is None:
            return None
        
        from users.models import AuthToken
        
        try:
            token_obj = AuthToken.objects.select_related('user').get(token=token)
        except AuthToken.DoesNotExist:
            return None
        
        # Check if token is expired
        if token_obj.is_expired:
            token_obj.delete()
            return None
        
        # Update last used timestamp
        token_obj.last_used_at = datetime.now()
        token_obj.save(update_fields=['last_used_at'])
        
        if not token_obj.user.is_active:
            return None
        
        return token_obj.user
    
    def get_user(self, user_id):
        try:
            return User.objects.get(pk=user_id)
        except User.DoesNotExist:
            return None
