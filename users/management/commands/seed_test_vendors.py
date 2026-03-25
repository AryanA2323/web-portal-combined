"""
Management command to seed test vendor accounts into the database.
This creates vendors with preset test passwords for development/testing purposes.

Usage: python manage.py seed_test_vendors
"""

from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model
from users.models import Vendor

User = get_user_model()

# Test vendor data
TEST_VENDORS = [
    {
        'username': 'alpha_investigations',
        'email': 'contact@alphainvestigations.com',
        'password': 'Alpha@123456',
        'company_name': 'Alpha Investigations',
        'contact_email': 'john@alphainvestigations.com',
        'contact_phone': '9876543210',
        'city': 'Mumbai',
        'state': 'Maharashtra',
    },
    {
        'username': 'beta_agency',
        'email': 'contact@betaagency.com',
        'password': 'Beta@123456',
        'company_name': 'Beta Agency',
        'contact_email': 'jane@betaagency.com',
        'contact_phone': '9876543211',
        'city': 'Bangalore',
        'state': 'Karnataka',
    },
    {
        'username': 'gamma_services',
        'email': 'contact@gammaservices.com',
        'password': 'Gamma@123456',
        'company_name': 'Gamma Services',
        'contact_email': 'robert@gammaservices.com',
        'contact_phone': '9876543212',
        'city': 'Delhi',
        'state': 'Delhi',
    },
]


class Command(BaseCommand):
    help = 'Seed test vendor accounts into the database'

    def add_arguments(self, parser):
        parser.add_argument(
            '--clear',
            action='store_true',
            help='Clear existing test vendors before seeding',
        )

    def handle(self, *args, **options):
        if options['clear']:
            # Delete existing test vendors
            test_usernames = [v['username'] for v in TEST_VENDORS]
            User.objects.filter(username__in=test_usernames, role='VENDOR').delete()
            self.stdout.write(self.style.WARNING('Cleared existing test vendors'))

        created_count = 0
        skipped_count = 0

        for vendor_data in TEST_VENDORS:
            username = vendor_data['username']
            email = vendor_data['email']
            password = vendor_data['password']
            
            # Create or get user
            user, created = User.objects.get_or_create(
                username=username,
                defaults={
                    'email': email,
                    'role': 'VENDOR',
                    'is_active': True,
                }
            )
            
            if created:
                # Set password for new user
                user.set_password(password)
                user.save()
                created_count += 1
                status_msg = "[OK] Created"
            else:
                skipped_count += 1
                status_msg = "[SKIP] Skipped (exists)"
            
            # Create or update vendor profile
            vendor_profile, _ = Vendor.objects.get_or_create(
                user=user,
                defaults={
                    'company_name': vendor_data['company_name'],
                    'contact_email': vendor_data['contact_email'],
                    'contact_phone': vendor_data['contact_phone'],
                    'city': vendor_data['city'],
                    'state': vendor_data['state'],
                    'is_active': True,
                }
            )
            
            self.stdout.write(
                self.style.SUCCESS(f"  {status_msg}: {username} ({vendor_data['company_name']})")
            )

        self.stdout.write(
            self.style.SUCCESS(f"\nDone. Created: {created_count}, Skipped: {skipped_count}")
        )
        self.stdout.write(
            self.style.WARNING("\nWARNING: These are test accounts. Do NOT use in production!")
        )
