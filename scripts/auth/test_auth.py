import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()

from django.contrib.auth import authenticate
from users.models import CustomUser

# Test authentication
user = authenticate(username='kunaldhumal18@gmail.com', password='Kunal@123')
if user:
    print(f"✓ Authentication successful!")
    print(f"  Username: {user.username}")
    print(f"  Email: {user.email}")
    print(f"  Role: {user.role}")
    print(f"  Is Active: {user.is_active}")
else:
    print("✗ Authentication failed!")
    # Try to find the user
    try:
        user = CustomUser.objects.get(email='kunaldhumal18@gmail.com')
        print(f"  User found: {user.email}")
        print(f"  Username: {user.username}")
        print(f"  Is Active: {user.is_active}")
        # Test password
        print(f"  Password correct: {user.check_password('Kunal@123')}")
    except CustomUser.DoesNotExist:
        print("  User not found!")
