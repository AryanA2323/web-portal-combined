"""
Interactive Outlook Email Setup for Shovel Tech Solutions.

Run this script and follow the prompts to set up email intake.
"""

import os
import sys

# Add project root to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')

import django
django.setup()

from cases.models import EmailIntakeConfig


def main():
    print("""
╔══════════════════════════════════════════════════════════════════╗
║        OUTLOOK EMAIL INTAKE SETUP - SHOVEL TECH SOLUTIONS        ║
╠══════════════════════════════════════════════════════════════════╣
║                                                                  ║
║  This will configure automatic case creation from emails.        ║
║                                                                  ║
║  BEFORE PROCEEDING, you need to register an app in Azure:        ║
║                                                                  ║
║  1. Go to: https://portal.azure.com                              ║
║  2. Navigate to: Azure Active Directory → App registrations      ║
║  3. Click: New registration                                      ║
║  4. Settings:                                                    ║
║     - Name: Shovel Screen Email Intake                           ║
║     - Account types: Multitenant                                 ║
║     - Redirect URI: http://localhost:8000/api/email-intake/oauth/callback
║  5. Copy the Application (client) ID                             ║
║  6. Go to Certificates & secrets → New client secret             ║
║  7. Copy the secret Value                                        ║
║  8. Go to API permissions → Add permission:                      ║
║     - Microsoft Graph → Delegated                                ║
║     - Add: Mail.Read, Mail.ReadWrite, offline_access             ║
║     - Click "Grant admin consent"                                ║
║                                                                  ║
╚══════════════════════════════════════════════════════════════════╝
""")
    
    ready = input("Have you completed the Azure app registration? (y/n): ").strip().lower()
    if ready != 'y':
        print("\n⚠️  Please complete Azure registration first, then run this script again.")
        print("   Documentation: https://docs.microsoft.com/en-us/azure/active-directory/develop/quickstart-register-app")
        return
    
    print("\n" + "="*60)
    print("Enter your Azure app credentials:")
    print("="*60)
    
    email = input("\n📧 Email address to monitor (e.g., cases@shoveltechsolutions.in): ").strip()
    if not email or '@' not in email:
        print("❌ Invalid email address")
        return
    
    client_id = input("\n🔑 Application (client) ID from Azure: ").strip()
    if not client_id:
        print("❌ Client ID is required")
        return
    
    client_secret = input("\n🔐 Client Secret value from Azure: ").strip()
    if not client_secret:
        print("❌ Client Secret is required")
        return
    
    name = input(f"\n📝 Configuration name (default: 'Outlook - {email}'): ").strip()
    if not name:
        name = f"Outlook - {email}"
    
    # Check if already exists
    existing = EmailIntakeConfig.objects.filter(email_address=email).first()
    if existing:
        print(f"\n⚠️  Configuration for {email} already exists!")
        update = input("Do you want to update it? (y/n): ").strip().lower()
        if update != 'y':
            print("Aborted.")
            return
        
        existing.name = name
        existing.client_id = client_id
        existing.client_secret = client_secret
        existing.save()
        config = existing
        print(f"\n✅ Configuration UPDATED!")
    else:
        # Create configuration
        config = EmailIntakeConfig.objects.create(
            name=name,
            provider=EmailIntakeConfig.Provider.OUTLOOK,
            email_address=email,
            client_id=client_id,
            client_secret=client_secret,
            check_interval_minutes=5,
            auto_create_cases=True,
            default_priority='MEDIUM',
            status=EmailIntakeConfig.Status.INACTIVE,
            monitored_labels=[],
            sender_whitelist=[],
            sender_blacklist=[],
            subject_keywords=[],
        )
        print(f"\n✅ Configuration CREATED!")
    
    print(f"""
╔══════════════════════════════════════════════════════════════════╗
║                    CONFIGURATION COMPLETE                         ║
╠══════════════════════════════════════════════════════════════════╣
║  ID:       {config.id:<54}║
║  Name:     {config.name:<54}║
║  Email:    {config.email_address:<54}║
║  Status:   {config.status:<54}║
╠══════════════════════════════════════════════════════════════════╣
║                                                                  ║
║  NEXT STEPS TO ACTIVATE:                                         ║
║  ─────────────────────────                                       ║
║  1. Make sure Django server is running:                          ║
║     python manage.py runserver                                   ║
║                                                                  ║
║  2. Open this URL in your browser:                               ║
║     http://localhost:8000/api/email-intake/oauth/start/{config.id:<10}║
║                                                                  ║
║  3. Login with your Microsoft 365 account                        ║
║                                                                  ║
║  4. Grant the requested permissions                              ║
║                                                                  ║
║  After OAuth, the system will automatically:                     ║
║  • Check inbox every 5 minutes                                   ║
║  • Extract case details from emails                              ║
║  • Create cases in PostgreSQL                                    ║
║                                                                  ║
╚══════════════════════════════════════════════════════════════════╝
""")


if __name__ == '__main__':
    main()
