"""
Django management command to poll Gmail for new emails.
Run with: python manage.py poll_gmail_emails
"""

import logging
from django.core.management.base import BaseCommand
from django.core.files.base import ContentFile
from django.utils import timezone
from django.db import transaction

from users.models import EmailIntake, EmailAttachment, GmailOAuthToken
from users.services.gmail_oauth import get_gmail_service
from users.services.email_processor import get_email_processor
from users.services.email_to_case_mapper_enhanced import get_email_to_case_mapper

logger = logging.getLogger(__name__)


class Command(BaseCommand):
    help = 'Poll Gmail for new emails and process them'
    
    def add_arguments(self, parser):
        parser.add_argument(
            '--max-emails',
            type=int,
            default=50,
            help='Maximum number of emails to fetch per run'
        )
        parser.add_argument(
            '--email',
            type=str,
            help='Specific Gmail account to poll (if multiple configured)'
        )
        parser.add_argument(
            '--include-read',
            action='store_true',
            help='Include already read emails (default: only unread)'
        )
    
    def handle(self, *args, **options):
        """Main command handler."""
        max_emails = options['max_emails']
        email_filter = options.get('email')
        include_read = options.get('include_read', False)
        
        self.stdout.write(self.style.SUCCESS('Starting Gmail email polling...'))
        if include_read:
            self.stdout.write(self.style.WARNING('Including READ emails'))
        
        try:
            # Get active OAuth tokens
            oauth_tokens = GmailOAuthToken.objects.filter(is_active=True)
            
            if email_filter:
                oauth_tokens = oauth_tokens.filter(email_address=email_filter)
            
            if not oauth_tokens.exists():
                self.stdout.write(self.style.ERROR('No active Gmail OAuth tokens found.'))
                self.stdout.write('Please run: python manage.py setup_gmail_oauth')
                return
            
            total_processed = 0
            
            for oauth_token in oauth_tokens:
                self.stdout.write(f'\nProcessing emails for: {oauth_token.email_address}')
                
                try:
                    processed = self._process_account(oauth_token, max_emails, include_read)
                    total_processed += processed
                    
                    # Update last synced time
                    oauth_token.last_synced_at = timezone.now()
                    oauth_token.save()
                    
                except Exception as e:
                    self.stdout.write(self.style.ERROR(f'Error processing {oauth_token.email_address}: {e}'))
                    logger.error(f'Error processing {oauth_token.email_address}: {e}', exc_info=True)
            
            self.stdout.write(self.style.SUCCESS(f'\n✓ Successfully processed {total_processed} emails'))
            
        except Exception as e:
            self.stdout.write(self.style.ERROR(f'Command failed: {e}'))
            logger.error(f'Command failed: {e}', exc_info=True)
    
    def _process_account(self, oauth_token: GmailOAuthToken, max_emails: int, include_read: bool = False) -> int:
        """
        Process emails for a single Gmail account.
        
        Args:
            oauth_token: GmailOAuthToken instance
            max_emails: Maximum emails to fetch
            include_read: Whether to include already read emails
            
        Returns:
            Number of emails processed
        """
        gmail_service = get_gmail_service()
        email_processor = get_email_processor()
        
        # Build Gmail service
        gmail_service.build_service(
            access_token=oauth_token.access_token,
            refresh_token=oauth_token.refresh_token
        )
        
        # List new messages (unread only by default, or all if include_read)
        query = None if include_read else 'is:unread'
        messages = gmail_service.list_messages(
            max_results=max_emails,
            query=query
        )
        
        if not messages:
            self.stdout.write('  No new emails found.')
            return 0
        
        self.stdout.write(f'  Found {len(messages)} new emails')
        
        processed_count = 0
        
        for msg in messages:
            try:
                # Get full message
                message_data = gmail_service.get_message(msg['id'])
                
                # Check if already processed
                if EmailIntake.objects.filter(message_id=message_data['id']).exists():
                    self.stdout.write(f'  Skipping already processed: {message_data["id"]}')
                    continue
                
                # Process email
                self._process_email(message_data, gmail_service, email_processor, oauth_token)
                
                # Mark as read
                gmail_service.mark_as_read(message_data['id'])
                
                processed_count += 1
                self.stdout.write(self.style.SUCCESS(f'  ✓ Processed email: {message_data["id"]}'))
                
            except Exception as e:
                self.stdout.write(self.style.ERROR(f'  ✗ Failed to process {msg["id"]}: {e}'))
                logger.error(f'Failed to process message {msg["id"]}: {e}', exc_info=True)
        
        return processed_count
    
    @transaction.atomic
    def _process_email(self, message_data, gmail_service, email_processor, oauth_token):
        """
        Process single email and save to database.
        
        Args:
            message_data: Gmail message data
            gmail_service: GmailOAuthService instance
            email_processor: EmailProcessor instance
            oauth_token: GmailOAuthToken instance
        """
        # Parse email
        email_data = email_processor.parse_message(message_data)
        
        # Create EmailIntake record
        email_intake = EmailIntake.objects.create(
            message_id=email_data['message_id'],
            thread_id=email_data['thread_id'],
            subject=email_data['subject'],
            sender_email=email_data['sender_email'],
            sender_name=email_data['sender_name'],
            recipient_email=email_data['recipient_email'],
            cc_emails=email_data['cc_emails'],
            bcc_emails=email_data['bcc_emails'],
            body_text=email_data['body_text'],
            body_html=email_data['body_html'],
            received_at=email_data['received_at'],
            has_attachments=email_data['has_attachments'],
            processing_status=EmailIntake.ProcessingStatus.PROCESSING
        )
        
        self.stdout.write(f'    Subject: {email_data["subject"][:50]}...')
        self.stdout.write(f'    From: {email_data["sender_email"]}')
        
        # Extract attachments
        if email_data['has_attachments']:
            try:
                attachments = email_processor.extract_attachments(message_data, gmail_service)
                
                for attachment_data in attachments:
                    # Save attachment
                    attachment = EmailAttachment(
                        email=email_intake,
                        filename=attachment_data['filename'],
                        content_type=attachment_data['content_type'],
                        file_size=attachment_data['file_size'],
                        is_pdf=attachment_data['is_pdf'],
                        extracted_text=attachment_data['extracted_text']
                    )
                    
                    # Save file
                    attachment.file_path.save(
                        attachment_data['filename'],
                        ContentFile(attachment_data['file_data']),
                        save=False
                    )
                    
                    attachment.save()
                    
                    self.stdout.write(f'    ✓ Saved attachment: {attachment_data["filename"]} ({attachment_data["file_size"]} bytes)')
                    
                    if attachment_data['is_pdf'] and attachment_data['extracted_text']:
                        self.stdout.write(f'      PDF text extracted: {len(attachment_data["extracted_text"])} characters')
                
            except Exception as e:
                logger.error(f'Failed to process attachments: {e}', exc_info=True)
                email_intake.processing_error = f'Attachment processing error: {str(e)}'
        
        # Mark as completed
        email_intake.processing_status = EmailIntake.ProcessingStatus.COMPLETED
        email_intake.processed_at = timezone.now()
        email_intake.save()
        
        # Map email to insurance case
        try:
            case_mapper = get_email_to_case_mapper()
            insurance_case = case_mapper.process_email_to_case(email_intake)
            
            if insurance_case:
                self.stdout.write(self.style.SUCCESS(f'    ✓ Created/Updated insurance case: {insurance_case.claim_number}'))
            else:
                self.stdout.write(self.style.WARNING(f'    ⚠ Could not extract case data from email'))
                
        except Exception as e:
            logger.error(f'Failed to map email to case: {e}', exc_info=True)
            self.stdout.write(self.style.WARNING(f'    ⚠ Case mapping failed: {e}'))
