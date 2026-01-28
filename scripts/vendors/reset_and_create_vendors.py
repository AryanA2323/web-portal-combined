"""
Reset vendors: Delete existing vendors and create new ones with proper user accounts and locations.
"""

import os
import sys
import django

# Setup Django
sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()

from django.contrib.auth import get_user_model
from django.db import transaction
from users.models import Vendor

User = get_user_model()

def reset_and_create_vendors():
    """Delete all existing vendors and create new ones with locations."""
    
    print("\n=== Resetting Vendors ===\n")
    
    # Step 1: Delete all existing vendors
    print("Step 1: Deleting existing vendors...")
    vendor_count = Vendor.objects.count()
    Vendor.objects.all().delete()
    print(f"✓ Deleted {vendor_count} existing vendors")
    
    # Step 2: Delete vendor users (users with role 'vendor')
    print("\nStep 2: Deleting vendor user accounts...")
    vendor_users = User.objects.filter(role='VENDOR')
    user_count = vendor_users.count()
    vendor_users.delete()
    print(f"✓ Deleted {user_count} vendor user accounts")
    
    # Step 3: Create new vendors with user accounts
    print("\nStep 3: Creating new vendors with locations...")
    
    vendors_data = [
        {
            'company_name': 'Mumbai Private Investigators',
            'email': 'mumbai@investigators.com',
            'phone': '+91-22-1234-5678',
            'address': 'Andheri West, Mumbai',
            'city': 'Mumbai',
            'state': 'Maharashtra',
            'postal_code': '400053',
            'country': 'India',
            'latitude': 19.076090,
            'longitude': 72.877426,
        },
        {
            'company_name': 'Pune Investigation Services',
            'email': 'pune@investigators.com',
            'phone': '+91-20-2345-6789',
            'address': 'Koregaon Park, Pune',
            'city': 'Pune',
            'state': 'Maharashtra',
            'postal_code': '411001',
            'country': 'India',
            'latitude': 18.520430,
            'longitude': 73.856743,
        },
        {
            'company_name': 'Delhi Detective Agency',
            'email': 'delhi@detectives.com',
            'phone': '+91-11-3456-7890',
            'address': 'Connaught Place, New Delhi',
            'city': 'New Delhi',
            'state': 'Delhi',
            'postal_code': '110001',
            'country': 'India',
            'latitude': 28.613939,
            'longitude': 77.209021,
        },
        {
            'company_name': 'Bangalore Investigation Corp',
            'email': 'bangalore@investigation.com',
            'phone': '+91-80-4567-8901',
            'address': 'Indiranagar, Bangalore',
            'city': 'Bangalore',
            'state': 'Karnataka',
            'postal_code': '560038',
            'country': 'India',
            'latitude': 12.971599,
            'longitude': 77.594566,
        },
        {
            'company_name': 'Thane Detective Services',
            'email': 'thane@detectives.com',
            'phone': '+91-22-5678-9012',
            'address': 'Ghodbunder Road, Thane',
            'city': 'Thane',
            'state': 'Maharashtra',
            'postal_code': '400607',
            'country': 'India',
            'latitude': 19.218330,
            'longitude': 72.978088,
        },
    ]
    
    created_vendors = []
    
    with transaction.atomic():
        for vendor_data in vendors_data:
            # Create user account for vendor
            username = vendor_data['company_name'].lower().replace(' ', '_')
            user = User.objects.create_user(
                username=username,
                email=vendor_data['email'],
                password='Vendor@123',  # Default password
                role='VENDOR',
                first_name=vendor_data['company_name'].split()[0],
                last_name=' '.join(vendor_data['company_name'].split()[1:]) if len(vendor_data['company_name'].split()) > 1 else 'Services'
            )
            
            # Create vendor profile
            vendor = Vendor.objects.create(
                user=user,
                company_name=vendor_data['company_name'],
                contact_email=vendor_data['email'],
                contact_phone=vendor_data['phone'],
                address=vendor_data['address'],
                city=vendor_data['city'],
                state=vendor_data['state'],
                postal_code=vendor_data['postal_code'],
                country=vendor_data['country'],
                latitude=vendor_data['latitude'],
                longitude=vendor_data['longitude'],
                is_active=True
            )
            
            created_vendors.append(vendor)
            print(f"✓ Created: {vendor.company_name}")
            print(f"  Email: {vendor.contact_email}")
            print(f"  Location: {vendor.city}, {vendor.state} ({vendor.latitude}, {vendor.longitude})")
            print(f"  Username: {username} | Password: Vendor@123")
            print()
    
    print(f"\n✓ Successfully created {len(created_vendors)} vendors!\n")
    
    # Verify vendors
    total_vendors = Vendor.objects.count()
    print(f"Total vendors in database: {total_vendors}")
    
    return created_vendors


if __name__ == '__main__':
    try:
        vendors = reset_and_create_vendors()
        print("\n=== Vendors Reset Complete ===\n")
    except Exception as e:
        print(f"\n✗ Error: {e}\n")
        import traceback
        traceback.print_exc()
