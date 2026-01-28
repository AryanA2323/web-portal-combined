import os
import sys
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()

from users.models import CustomUser

user = CustomUser.objects.get(email='kunaldhumal18@gmail.com')
user.set_password('Kunal@123')
user.save()

print(f"✓ Password set for {user.email}")
print(f"  Email: {user.email}")
print(f"  Password: Kunal@123")
