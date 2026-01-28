import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()

from users.models import CustomUser

# Create superuser
user, created = CustomUser.objects.get_or_create(
    email='kunaldhumal18@gmail.com',
    defaults={
        'username': 'kunaldhumal18',
        'first_name': 'Kunal',
        'last_name': 'Dhumal',
        'is_staff': True,
        'is_superuser': True,
        'is_active': True,
        'role': CustomUser.Role.ADMIN,
        'sub_role': CustomUser.AdminSubRole.SUPER_ADMIN,
    }
)

if created:
    user.set_password('Kunal@123')
    user.save()
    print(f"✓ Superuser created successfully!")
    print(f"  Email: {user.email}")
    print(f"  Username: {user.username}")
else:
    print(f"User already exists: {user.email}")
    # Update password if user exists
    user.set_password('Kunal@123')
    user.save()
    print(f"✓ Password updated for: {user.email}")
