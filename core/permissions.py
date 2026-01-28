"""
Custom permissions for the incident management platform.
"""

from django.http import HttpRequest
from typing import Optional


def is_admin(request: HttpRequest) -> bool:
    """
    Check if the user is an admin.
    
    Args:
        request: The HTTP request object
        
    Returns:
        bool: True if user is authenticated and is an admin (including super admin)
    """
    return (
        request.user.is_authenticated and 
        hasattr(request.user, 'role') and 
        request.user.role in ['ADMIN', 'SUPER_ADMIN']
    )


def is_super_admin(request: HttpRequest) -> bool:
    """
    Check if the user is a super admin.
    
    Args:
        request: The HTTP request object
        
    Returns:
        bool: True if user is authenticated and is a super admin
    """
    return (
        request.user.is_authenticated and 
        hasattr(request.user, 'role') and 
        request.user.role == 'SUPER_ADMIN'
    )


def is_vendor(request: HttpRequest) -> bool:
    """
    Check if the user is a vendor.
    
    Args:
        request: The HTTP request object
        
    Returns:
        bool: True if user is authenticated and is a vendor
    """
    return (
        request.user.is_authenticated and 
        hasattr(request.user, 'role') and 
        request.user.role == 'VENDOR'
    )


def is_lawyer(request: HttpRequest) -> bool:
    """
    Check if the user is a lawyer.
    
    Args:
        request: The HTTP request object
        
    Returns:
        bool: True if user is authenticated and is a lawyer
    """
    return (
        request.user.is_authenticated and 
        hasattr(request.user, 'role') and 
        request.user.role == 'LAWYER'
    )


def is_admin_or_lawyer(request: HttpRequest) -> bool:
    """
    Check if the user is an admin or lawyer.
    
    Args:
        request: The HTTP request object
        
    Returns:
        bool: True if user is authenticated and is an admin or lawyer
    """
    return is_admin(request) or is_lawyer(request)
