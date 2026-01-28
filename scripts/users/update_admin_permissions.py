"""
Script to update admin user permissions based on new role structure.
This script should be run after applying the migration.
"""

import os
import sys
import django

# Setup Django environment
# Go up two levels from scripts/users/ to project root
project_root = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.insert(0, project_root)
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()

from django.contrib.auth import get_user_model

User = get_user_model()

# Define permission sets
SUPER_ADMIN_PERMISSIONS = [
    '/admin/dashboard',
    '/admin/users',
    '/admin/vendors',
]

DEFAULT_ADMIN_PERMISSIONS = [
    '/admin/dashboard',
    '/admin/cases',
    '/admin/email-intake',
    '/admin/process-document',
    '/admin/ai-brief',
    '/admin/legal-review',
    '/admin/reports',
    '/admin/audit-logs',
    '/admin/settings',
]


def update_admin_permissions():
    """Update all admin users with appropriate permissions."""
    
    print("Updating admin user permissions...")
    
    # Get all admin users
    admin_users = User.objects.filter(role='ADMIN')
    
    updated_count = 0
    super_admin_count = 0
    regular_admin_count = 0
    
    for user in admin_users:
        if user.sub_role == 'SUPER_ADMIN':
            # Super admin gets limited permissions (users and vendors only)
            user.permissions = SUPER_ADMIN_PERMISSIONS
            super_admin_count += 1
            print(f"✓ Updated SUPER_ADMIN: {user.username} - {user.email}")
        else:
            # Regular admin gets all pages except users and vendors
            user.permissions = DEFAULT_ADMIN_PERMISSIONS
            regular_admin_count += 1
            print(f"✓ Updated ADMIN: {user.username} - {user.email}")
        
        user.save()
        updated_count += 1
    
    print(f"\n{'='*60}")
    print(f"Permission Update Summary:")
    print(f"{'='*60}")
    print(f"Total admins updated: {updated_count}")
    print(f"Super admins: {super_admin_count}")
    print(f"Regular admins: {regular_admin_count}")
    print(f"{'='*60}\n")
    
    # Display permission breakdown
    print("Permission Sets:")
    print("\nSuper Admin Permissions:")
    for perm in SUPER_ADMIN_PERMISSIONS:
        print(f"  - {perm}")
    
    print("\nRegular Admin Permissions:")
    for perm in DEFAULT_ADMIN_PERMISSIONS:
        print(f"  - {perm}")


def list_all_admins():
    """List all admin users and their current permissions."""
    
    print("\nCurrent Admin Users:")
    print(f"{'='*80}")
    
    admin_users = User.objects.filter(role='ADMIN').order_by('username')
    
    for user in admin_users:
        print(f"\nUsername: {user.username}")
        print(f"Email: {user.email}")
        print(f"Sub Role: {user.sub_role or 'None'}")
        print(f"Active: {user.is_active}")
        print(f"Permissions: {len(user.permissions)} pages")
        for perm in user.permissions:
            print(f"  - {perm}")
    
    print(f"{'='*80}\n")


if __name__ == '__main__':
    print("\n" + "="*60)
    print("Admin Permission Update Script")
    print("="*60 + "\n")
    
    # List current admins
    list_all_admins()
    
    # Ask for confirmation
    response = input("Do you want to update admin permissions? (yes/no): ").strip().lower()
    
    if response in ['yes', 'y']:
        update_admin_permissions()
        print("\n✓ Permissions updated successfully!\n")
        
        # Show updated list
        list_all_admins()
    else:
        print("\n✗ Update cancelled.\n")
