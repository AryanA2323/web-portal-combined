"""
Setup Outlook Email Intake for Shovel Tech Solutions.

This script creates the email intake configuration for Outlook/Microsoft 365.

BEFORE RUNNING THIS SCRIPT:
1. Go to https://portal.azure.com
2. Navigate to: Azure Active Directory → App registrations → New registration
3. Settings:
   - Name: Shovel Screen Email Intake
   - Supported account types: Accounts in any organizational directory
   - Redirect URI: http://localhost:8000/api/email-intake/oauth/callback
4. After creation, copy:
   - Application (client) ID
   - Create a client secret and copy its Value
5. Go to API permissions → Add a permission:
   - Microsoft Graph → Delegated permissions
   - Add: Mail.Read, Mail.ReadWrite, offline_access
   - Grant admin consent

Usage:
    python scripts/email/setup_outlook_intake.py --client-id YOUR_CLIENT_ID --client-secret YOUR_SECRET --email cases@shoveltechsolutions.in
"""

import os
import sys
import argparse

# Add project root to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')

import django
django.setup()

from cases.models import EmailIntakeConfig


def setup_outlook_config(email_address: str, client_id: str, client_secret: str, name: str = None):
    """
    Create or update Outlook email intake configuration.
    """
    if not name:
        name = f"Outlook - {email_address}"
    
    # Check if config already exists
    existing = EmailIntakeConfig.objects.filter(email_address=email_address).first()
    
    if existing:
        print(f"⚠️  Configuration for {email_address} already exists (ID: {existing.id})")
        update = input("Do you want to update it? (y/n): ").strip().lower()
        if update != 'y':
            print("Aborted.")
            return None
        
        existing.name = name
        existing.client_id = client_id
        existing.client_secret = client_secret
        existing.provider = EmailIntakeConfig.Provider.OUTLOOK
        existing.save()
        print(f"✅ Configuration updated for {email_address}")
        return existing
    
    # Create new configuration
    config = EmailIntakeConfig.objects.create(
        name=name,
        provider=EmailIntakeConfig.Provider.OUTLOOK,
        email_address=email_address,
        client_id=client_id,
        client_secret=client_secret,
        check_interval_minutes=5,
        auto_create_cases=True,
        default_priority='MEDIUM',
        status=EmailIntakeConfig.Status.INACTIVE,  # Will activate after OAuth
        monitored_labels=[],  # Empty = INBOX
        sender_whitelist=[],  # Accept all senders initially
        sender_blacklist=[],
        subject_keywords=[],  # Accept all subjects
    )
    
    print(f"""
✅ Email Intake Configuration Created!
=====================================
ID:           {config.id}
Name:         {config.name}
Provider:     {config.provider}
Email:        {config.email_address}
Status:       {config.status}

NEXT STEPS:
-----------
1. Start the Django server: python manage.py runserver
2. Open in browser: http://localhost:8000/api/email-intake/oauth/start/{config.id}
3. Login with your Microsoft account ({email_address})
4. Grant permissions to access email
5. After redirect, the configuration will be activated!

Once activated, the system will:
- Check for new emails every {config.check_interval_minutes} minutes
- Automatically create cases from incoming emails
- Extract case details (claim number, priority, category, etc.)
""")
    
    return config


def main():
    parser = argparse.ArgumentParser(description='Setup Outlook Email Intake')
    parser.add_argument('--client-id', required=True, help='Azure App Client ID')
    parser.add_argument('--client-secret', required=True, help='Azure App Client Secret')
    parser.add_argument('--email', required=True, help='Email address to monitor (e.g., cases@shoveltechsolutions.in)')
    parser.add_argument('--name', default=None, help='Configuration name (optional)')
    
    args = parser.parse_args()
    
    setup_outlook_config(
        email_address=args.email,
        client_id=args.client_id,
        client_secret=args.client_secret,
        name=args.name,
    )


if __name__ == '__main__':
    main()
