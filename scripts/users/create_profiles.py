#!/usr/bin/env python
import os
import sys
import django

# Setup Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()

from django.contrib.auth import get_user_model
from users.models import Admin, Lawyer, Vendor

User = get_user_model()

# Create Admin profile for admin@test.com
user = User.objects.get(email='admin@test.com')
admin, created = Admin.objects.get_or_create(
    user=user,
    defaults={
        'employee_id': f'ADMIN_{user.id}_TEST',
        'department': 'Management',
        'contact_email': user.email,
        'contact_phone': '+1234567890',
        'is_active': True,
    }
)
print(f'Admin profile (admin@test.com): Created={created}')

# Create Admin profile for kunaldhumal18@gmail.com
user2 = User.objects.get(email='kunaldhumal18@gmail.com')
admin2, created2 = Admin.objects.get_or_create(
    user=user2,
    defaults={
        'employee_id': f'ADMIN_{user2.id}_TEST',
        'department': 'Management',
        'contact_email': user2.email,
        'contact_phone': '+1234567890',
        'is_active': True,
    }
)
print(f'Admin profile (kunaldhumal18@gmail.com): Created={created2}')

# Create Lawyer profile for shrirawal07@gmail.com
user3 = User.objects.get(email='shrirawal07@gmail.com')
lawyer, created3 = Lawyer.objects.get_or_create(
    user=user3,
    defaults={
        'bar_registration_number': f'BAR_{user3.id}_TEST',
        'specialization': 'General Law',
        'contact_email': user3.email,
        'contact_phone': '+1234567890',
        'office_address': '123 Legal Street',
        'office_city': 'New York',
        'office_state': 'NY',
        'years_of_experience': 5,
        'is_active': True,
    }
)
print(f'Lawyer profile (shrirawal07@gmail.com): Created={created3}')

print('\n✓ Role-specific profiles created successfully!')
