# Generated migration for role structure update

from django.db import migrations


def update_admin_roles(apps, schema_editor):
    """
    Update existing users to new role structure:
    - Users with sub_role='SUPER_ADMIN' keep it
    - Other admin users with no sub_role get default admin permissions
    """
    CustomUser = apps.get_model('users', 'CustomUser')
    
    # Get all admin users
    admin_users = CustomUser.objects.filter(role='ADMIN')
    
    for user in admin_users:
        # Initialize permissions if not set
        if not hasattr(user, 'permissions') or user.permissions is None:
            user.permissions = []
            
        if user.sub_role == 'SUPER_ADMIN':
            # Super admin gets all permissions
            user.permissions = [
                '/admin/dashboard',
                '/admin/users',
                '/admin/vendors',
            ]
        else:
            # Regular admin gets all pages except users and vendors
            user.permissions = [
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
        user.save()


class Migration(migrations.Migration):

    dependencies = [
        ('users', '0009_alter_lawyer_options_and_more'),
    ]

    operations = [
        migrations.RunPython(update_admin_roles, migrations.RunPython.noop),
    ]
