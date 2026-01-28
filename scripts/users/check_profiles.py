import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()

from users.models import Admin, Lawyer, Vendor
from django.contrib.auth import get_user_model

User = get_user_model()

# Check admin profiles
print("=" * 60)
print("ADMIN PROFILES")
print("=" * 60)
admins = Admin.objects.all()
print(f"Total Admin profiles: {admins.count()}")
for admin in admins:
    print(f"  ✓ {admin.user.email} - Department: {admin.department}")

print("\n" + "=" * 60)
print("LAWYER PROFILES")
print("=" * 60)
lawyers = Lawyer.objects.all()
print(f"Total Lawyer profiles: {lawyers.count()}")
for lawyer in lawyers:
    print(f"  ✓ {lawyer.user.email} - Specialization: {lawyer.specialization}")

print("\n" + "=" * 60)
print("VENDOR PROFILES")
print("=" * 60)
vendors = Vendor.objects.all()
print(f"Total Vendor profiles: {vendors.count()}")
for vendor in vendors:
    print(f"  ✓ {vendor.user.email} - Company: {vendor.company_name}")

print("\n" + "=" * 60)
print("USERS BY ROLE")
print("=" * 60)
for role in ['ADMIN', 'LAWYER', 'VENDOR', 'CLIENT']:
    count = User.objects.filter(role=role).count()
    print(f"{role}: {count} users")
