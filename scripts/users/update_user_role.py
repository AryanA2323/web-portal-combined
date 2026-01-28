import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()

from users.models import CustomUser

# Update existing user role
user = CustomUser.objects.get(email='kunaldhumal18@gmail.com')
user.role = CustomUser.Role.ADMIN
user.sub_role = CustomUser.AdminSubRole.SUPER_ADMIN
user.save()

print(f"✓ User role updated to ADMIN!")
print(f"  Email: {user.email}")
print(f"  Role: {user.role}")
print(f"  Sub-Role: {user.sub_role}")
