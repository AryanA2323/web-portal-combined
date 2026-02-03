#!/usr/bin/env python
"""
Interactive Gmail OAuth Setup Script
This script guides you through setting up Gmail OAuth for email intake.
"""

import os
import sys
import django

# Add the project root to the path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Setup Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()

from django.conf import settings
from users.models import GmailOAuthToken
from users.services.gmail_oauth import get_gmail_service


def print_header(text):
    """Print formatted header."""
    print('\n' + '=' * 70)
    print(f'  {text}')
    print('=' * 70 + '\n')


def print_step(step_num, text):
    """Print formatted step."""
    print(f'\n[Step {step_num}] {text}')
    print('-' * 70)


def main():
    """Main setup function."""
    print_header('Gmail OAuth Setup for Incident Management Platform')
    
    print("""
This script will help you set up Gmail OAuth authentication to automatically
fetch emails and extract data from PDF attachments.

Prerequisites:
1. A Google Cloud Console account
2. Gmail API enabled
3. OAuth 2.0 credentials (Desktop app)
    """)
    
    # Check if credentials are in settings
    print_step(1, 'Checking Configuration')
    
    if not settings.GMAIL_CLIENT_ID or settings.GMAIL_CLIENT_ID == 'your_gmail_client_id_here':
        print('❌ Gmail Client ID not configured!')
        print('\nPlease follow these steps to get your credentials:')
        print('\n1. Go to: https://console.cloud.google.com/')
        print('2. Create a new project (or select existing)')
        print('3. Enable Gmail API:')
        print('   - Click "Enable APIs and Services"')
        print('   - Search for "Gmail API"')
        print('   - Click "Enable"')
        print('4. Create OAuth credentials:')
        print('   - Go to "Credentials" in the left menu')
        print('   - Click "Create Credentials" → "OAuth client ID"')
        print('   - Choose "Desktop app" as application type')
        print('   - Download the JSON file')
        print('5. Update your .env file with:')
        print('   GMAIL_CLIENT_ID=<your_client_id>')
        print('   GMAIL_CLIENT_SECRET=<your_client_secret>')
        print('\nAfter updating .env, run this script again.')
        return
    
    if not settings.GMAIL_CLIENT_SECRET or settings.GMAIL_CLIENT_SECRET == 'your_gmail_client_secret_here':
        print('❌ Gmail Client Secret not configured!')
        print('\nPlease add GMAIL_CLIENT_SECRET to your .env file.')
        return
    
    print('✓ Gmail OAuth credentials found in settings')
    
    # Initialize Gmail service
    print_step(2, 'Initializing Gmail OAuth Service')
    
    try:
        gmail_service = get_gmail_service()
        print('✓ Gmail service initialized')
    except Exception as e:
        print(f'❌ Failed to initialize Gmail service: {e}')
        return
    
    # Generate authorization URL
    print_step(3, 'Getting Authorization URL')
    
    try:
        redirect_uri = 'http://localhost:8000/api/gmail/oauth/callback'
        auth_url = gmail_service.get_authorization_url(redirect_uri=redirect_uri)
        
        print('\nPlease visit this URL to authorize the application:')
        print('\n' + '=' * 70)
        print(auth_url)
        print('=' * 70 + '\n')
        
        print('Instructions:')
        print('1. Open the URL above in your browser')
        print('2. Sign in with your Gmail account')
        print('3. Grant the requested permissions')
        print('4. You will be redirected to a URL that looks like:')
        print('   http://localhost:8000/api/gmail/oauth/callback?code=...')
        print('5. Copy the entire URL or just the "code" parameter value')
        
    except Exception as e:
        print(f'❌ Failed to generate authorization URL: {e}')
        return
    
    # Get authorization code
    print_step(4, 'Enter Authorization Code')
    
    code = input('\nPaste the authorization code (or full URL): ').strip()
    
    if not code:
        print('❌ No code provided. Exiting.')
        return
    
    # Extract code from URL if full URL was pasted
    if 'code=' in code:
        try:
            from urllib.parse import urlparse, parse_qs
            parsed = urlparse(code)
            code = parse_qs(parsed.query)['code'][0]
            print(f'✓ Extracted code from URL')
        except Exception as e:
            print(f'❌ Failed to extract code from URL: {e}')
            return
    
    # Exchange code for tokens
    print_step(5, 'Exchanging Code for Tokens')
    
    try:
        token_data = gmail_service.exchange_code_for_tokens(code, redirect_uri=redirect_uri)
        print(f'✓ Successfully obtained tokens for: {token_data["email_address"]}')
    except Exception as e:
        print(f'❌ Failed to exchange code for tokens: {e}')
        return
    
    # Save to database
    print_step(6, 'Saving OAuth Token to Database')
    
    try:
        oauth_token, created = GmailOAuthToken.objects.update_or_create(
            email_address=token_data['email_address'],
            defaults={
                'access_token': token_data['access_token'],
                'refresh_token': token_data['refresh_token'],
                'token_uri': token_data['token_uri'],
                'client_id': token_data['client_id'],
                'client_secret': token_data['client_secret'],
                'scopes': str(token_data['scopes']),
                'expires_at': token_data['expires_at'],
                'is_active': True
            }
        )
        
        if created:
            print(f'✓ Created new OAuth token for: {token_data["email_address"]}')
        else:
            print(f'✓ Updated existing OAuth token for: {token_data["email_address"]}')
        
    except Exception as e:
        print(f'❌ Failed to save OAuth token: {e}')
        return
    
    # Success!
    print_header('Setup Complete!')
    
    print(f"""
✓ Gmail OAuth successfully configured for: {token_data["email_address"]}

Next Steps:
-----------
1. Run database migrations:
   python manage.py makemigrations
   python manage.py migrate

2. Start polling for emails manually:
   python manage.py poll_gmail_emails

3. Or set up a cron job/scheduled task to run periodically:
   - Linux/Mac: Add to crontab
     */5 * * * * cd /path/to/project && python manage.py poll_gmail_emails
   
   - Windows: Use Task Scheduler
     Program: python
     Arguments: manage.py poll_gmail_emails
     Start in: {os.path.dirname(os.path.dirname(os.path.abspath(__file__)))}

Email Processing:
-----------------
- Emails will be fetched and stored in the EmailIntake table
- PDF attachments will be extracted and text will be parsed
- All data is stored in the PostgreSQL database
    """)


if __name__ == '__main__':
    main()
