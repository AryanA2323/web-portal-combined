"""
Verify vendors and check case assignments
"""

import os
import sys
import django

# Setup Django
sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()

from users.models import Vendor
from cases.models import Case

print('\n=== VENDORS ===')
vendors = Vendor.objects.select_related('user').all()
for v in vendors:
    print(f'{v.id}: {v.company_name}')
    print(f'   User: {v.user.username} ({v.user.email})')
    print(f'   Location: {v.city}, {v.state} ({v.latitude}, {v.longitude})')
    print()

print('=== CASES ===')
cases = Case.objects.select_related('assigned_vendor').all()
for c in cases:
    vendor_name = c.assigned_vendor.company_name if c.assigned_vendor else "None"
    print(f'{c.case_number}: {c.title}')
    print(f'   Location: {c.incident_city}, {c.incident_state} ({c.latitude}, {c.longitude})')
    print(f'   Assigned Vendor: {vendor_name}')
    print()

print(f'\nTotal Vendors: {vendors.count()}')
print(f'Total Cases: {cases.count()}')
