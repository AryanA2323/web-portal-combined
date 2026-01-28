import os
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
import django
django.setup()

from users.models import CustomUser

# Create test users for each role
users_data = [
    {'email': 'client@test.com', 'role': 'client', 'username': 'testclient'},
    {'email': 'vendor@test.com', 'role': 'vendor', 'username': 'testvendor'},
    {'email': 'admin@test.com', 'role': 'admin', 'username': 'testadmin'},
]

for data in users_data:
    if not CustomUser.objects.filter(email=data['email']).exists():
        user = CustomUser.objects.create_user(
            email=data['email'],
            username=data['username'],
            password='Test@123',
            role=data['role'],
            first_name='Test',
            last_name=data['role'].title()
        )
        print(f'Created {data["role"]} user: {data["email"]}')
    else:
        print(f'{data["role"]} user already exists: {data["email"]}')

print('\nAll test users have password: Test@123')
