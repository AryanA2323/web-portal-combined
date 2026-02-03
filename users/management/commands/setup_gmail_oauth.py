"""
Django management command to set up Gmail OAuth.
Run with: python manage.py setup_gmail_oauth
"""

import logging
from django.core.management.base import BaseCommand
from django.conf import settings
from django.utils import timezone

from users.models import GmailOAuthToken
from users.services.gmail_oauth import get_gmail_service

logger = logging.getLogger(__name__)


class Command(BaseCommand):
    help = 'Set up Gmail OAuth authentication'
    
    def handle(self, *args, **options):
        """Main command handler."""
        self.stdout.write(self.style.SUCCESS('\n=== Gmail OAuth Setup ===\n'))
        
        # Check if credentials are configured
        if not settings.GMAIL_CLIENT_ID or not settings.GMAIL_CLIENT_SECRET:
            self.stdout.write(self.style.ERROR('ERROR: Gmail OAuth credentials not configured!'))
            self.stdout.write('\nPlease follow these steps:')
            self.stdout.write('1. Go to: https://console.cloud.google.com/')
            self.stdout.write('2. Create a new project or select an existing one')
            self.stdout.write('3. Enable Gmail API')
            self.stdout.write('4. Create OAuth 2.0 credentials (Desktop app)')
            self.stdout.write('5. Add these to your .env file:')
            self.stdout.write('   GMAIL_CLIENT_ID=your_client_id_here')
            self.stdout.write('   GMAIL_CLIENT_SECRET=your_client_secret_here')
            return
        
        try:
            gmail_service = get_gmail_service()
            
            # Generate authorization URL
            self.stdout.write('Step 1: Authorization')
            self.stdout.write('=' * 50)
            
            redirect_uri = 'urn:ietf:wg:oauth:2.0:oob'
            auth_url = gmail_service.get_authorization_url(redirect_uri=redirect_uri)
            
            self.stdout.write('\nPlease visit this URL to authorize the application:')
            self.stdout.write(self.style.WARNING(f'\n{auth_url}\n'))
            
            self.stdout.write('After authorization, Google will display the authorization code.')
            self.stdout.write('Copy the authorization code shown on the page.')
            
            # Get authorization code from user
            code = input('\nEnter the authorization code: ').strip()
            
            if not code:
                self.stdout.write(self.style.ERROR('No code provided. Exiting.'))
                return
            
            # Exchange code for tokens
            self.stdout.write('\nStep 2: Exchanging code for tokens...')
            token_data = gmail_service.exchange_code_for_tokens(code, redirect_uri=redirect_uri)
            
            # Save to database
            self.stdout.write('\nStep 3: Saving OAuth token...')
            
            # Check if token already exists
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
                self.stdout.write(self.style.SUCCESS(f'\n✓ Successfully configured Gmail OAuth for: {token_data["email_address"]}'))
            else:
                self.stdout.write(self.style.SUCCESS(f'\n✓ Updated Gmail OAuth token for: {token_data["email_address"]}'))
            
            self.stdout.write('\nYou can now run:')
            self.stdout.write(self.style.WARNING('  python manage.py poll_gmail_emails'))
            
        except Exception as e:
            self.stdout.write(self.style.ERROR(f'\nSetup failed: {e}'))
            logger.error(f'Gmail OAuth setup failed: {e}', exc_info=True)
