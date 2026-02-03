"""
Email Processing Service
Handles email parsing, attachment extraction, and PDF text extraction.
"""

import base64
import email
import logging
import os
from typing import Dict, Any, List, Optional
from datetime import datetime
from email.utils import parsedate_to_datetime

from django.core.files.base import ContentFile
from django.utils import timezone
from django.conf import settings

logger = logging.getLogger(__name__)


class EmailProcessor:
    """Service for processing emails and extracting data."""
    
    def __init__(self):
        """Initialize email processor."""
        self.supported_pdf_types = ['application/pdf']
    
    def parse_message(self, message_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Parse Gmail message data into structured format.
        
        Args:
            message_data: Raw message data from Gmail API
            
        Returns:
            Parsed email data dictionary
        """
        try:
            headers = message_data.get('payload', {}).get('headers', [])
            
            # Extract headers
            subject = self._get_header(headers, 'Subject')
            from_email = self._get_header(headers, 'From')
            to_email = self._get_header(headers, 'To')
            cc_email = self._get_header(headers, 'Cc')
            bcc_email = self._get_header(headers, 'Bcc')
            date_str = self._get_header(headers, 'Date')
            
            # Parse sender
            sender_email, sender_name = self._parse_email_address(from_email)
            
            # Parse date
            try:
                received_at = parsedate_to_datetime(date_str) if date_str else timezone.now()
            except Exception as e:
                logger.warning(f"Failed to parse date '{date_str}': {e}")
                received_at = timezone.now()
            
            # Extract body
            body_text, body_html = self._extract_body(message_data.get('payload', {}))
            
            # Check for attachments
            has_attachments = self._has_attachments(message_data.get('payload', {}))
            
            return {
                'message_id': message_data.get('id'),
                'thread_id': message_data.get('threadId'),
                'subject': subject or '(No Subject)',
                'sender_email': sender_email,
                'sender_name': sender_name,
                'recipient_email': to_email or '',
                'cc_emails': cc_email or '',
                'bcc_emails': bcc_email or '',
                'body_text': body_text,
                'body_html': body_html,
                'received_at': received_at,
                'has_attachments': has_attachments
            }
            
        except Exception as e:
            logger.error(f"Failed to parse message: {e}")
            raise
    
    def extract_attachments(self, message_data: Dict[str, Any], gmail_service) -> List[Dict[str, Any]]:
        """
        Extract attachments from message.
        
        Args:
            message_data: Raw message data from Gmail API
            gmail_service: GmailOAuthService instance
            
        Returns:
            List of attachment data dictionaries
        """
        attachments = []
        
        try:
            payload = message_data.get('payload', {})
            message_id = message_data.get('id')
            
            # Check parts for attachments
            parts = self._get_all_parts(payload)
            
            for part in parts:
                if part.get('filename'):
                    attachment_data = self._process_attachment(
                        part, 
                        message_id, 
                        gmail_service
                    )
                    if attachment_data:
                        attachments.append(attachment_data)
            
            return attachments
            
        except Exception as e:
            logger.error(f"Failed to extract attachments: {e}")
            return attachments
    
    def extract_pdf_text(self, pdf_data: bytes) -> str:
        """
        Extract text from PDF file.
        
        Args:
            pdf_data: PDF file bytes
            
        Returns:
            Extracted text string (cleaned of NUL characters)
        """
        try:
            import pdfplumber
            import io
            
            text_content = []
            
            with pdfplumber.open(io.BytesIO(pdf_data)) as pdf:
                for page in pdf.pages:
                    page_text = page.extract_text()
                    if page_text:
                        # Clean NUL characters and other control characters
                        page_text = page_text.replace('\x00', '').replace('\0', '')
                        text_content.append(page_text)
            
            extracted_text = '\n\n'.join(text_content)
            # Additional cleanup for PostgreSQL compatibility
            extracted_text = extracted_text.replace('\x00', '')
            return extracted_text
            
        except Exception as e:
            logger.error(f"Failed to extract PDF text with pdfplumber: {e}")
            
            # Fallback to PyPDF2
            try:
                import PyPDF2
                import io
                
                text_content = []
                pdf_reader = PyPDF2.PdfReader(io.BytesIO(pdf_data))
                
                for page in pdf_reader.pages:
                    page_text = page.extract_text()
                    if page_text:
                        # Clean NUL characters
                        page_text = page_text.replace('\x00', '').replace('\0', '')
                        text_content.append(page_text)
                
                extracted_text = '\n\n'.join(text_content)
                # Additional cleanup
                extracted_text = extracted_text.replace('\x00', '')
                return extracted_text
                
            except Exception as e2:
                logger.error(f"Failed to extract PDF text with PyPDF2: {e2}")
                return ""
    
    def _get_header(self, headers: List[Dict], name: str) -> Optional[str]:
        """Get header value by name."""
        for header in headers:
            if header.get('name', '').lower() == name.lower():
                return header.get('value')
        return None
    
    def _parse_email_address(self, email_str: str) -> tuple:
        """
        Parse email address and name.
        
        Args:
            email_str: Email string (e.g., "John Doe <john@example.com>")
            
        Returns:
            Tuple of (email, name)
        """
        if not email_str:
            return '', ''
        
        try:
            from email.utils import parseaddr
            name, email_addr = parseaddr(email_str)
            return email_addr, name
        except Exception:
            return email_str, ''
    
    def _extract_body(self, payload: Dict[str, Any]) -> tuple:
        """
        Extract email body text and HTML.
        
        Args:
            payload: Message payload
            
        Returns:
            Tuple of (text_body, html_body)
        """
        text_body = ''
        html_body = ''
        
        if 'body' in payload and payload['body'].get('data'):
            # Single part message
            mime_type = payload.get('mimeType', '')
            body_data = payload['body']['data']
            decoded_data = base64.urlsafe_b64decode(body_data).decode('utf-8', errors='ignore')
            
            if 'text/plain' in mime_type:
                text_body = decoded_data
            elif 'text/html' in mime_type:
                html_body = decoded_data
        
        elif 'parts' in payload:
            # Multi-part message
            for part in payload['parts']:
                mime_type = part.get('mimeType', '')
                
                if 'text/plain' in mime_type and part.get('body', {}).get('data'):
                    body_data = part['body']['data']
                    text_body = base64.urlsafe_b64decode(body_data).decode('utf-8', errors='ignore')
                
                elif 'text/html' in mime_type and part.get('body', {}).get('data'):
                    body_data = part['body']['data']
                    html_body = base64.urlsafe_b64decode(body_data).decode('utf-8', errors='ignore')
                
                elif 'parts' in part:
                    # Nested parts
                    nested_text, nested_html = self._extract_body(part)
                    if not text_body:
                        text_body = nested_text
                    if not html_body:
                        html_body = nested_html
        
        return text_body, html_body
    
    def _has_attachments(self, payload: Dict[str, Any]) -> bool:
        """Check if message has attachments."""
        parts = self._get_all_parts(payload)
        
        for part in parts:
            if part.get('filename'):
                return True
        
        return False
    
    def _get_all_parts(self, payload: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Get all parts from payload recursively."""
        parts = []
        
        if 'parts' in payload:
            for part in payload['parts']:
                parts.append(part)
                # Recursively get nested parts
                if 'parts' in part:
                    parts.extend(self._get_all_parts(part))
        
        return parts
    
    def _process_attachment(self, part: Dict[str, Any], message_id: str, gmail_service) -> Optional[Dict[str, Any]]:
        """
        Process single attachment.
        
        Args:
            part: Message part containing attachment
            message_id: Gmail message ID
            gmail_service: GmailOAuthService instance
            
        Returns:
            Attachment data dictionary or None
        """
        try:
            filename = part.get('filename', 'unnamed_attachment')
            mime_type = part.get('mimeType', 'application/octet-stream')
            
            body = part.get('body', {})
            attachment_id = body.get('attachmentId')
            file_size = body.get('size', 0)
            
            if not attachment_id:
                # Inline attachment
                if body.get('data'):
                    file_data = base64.urlsafe_b64decode(body['data'])
                else:
                    return None
            else:
                # Download attachment
                file_data = gmail_service.get_attachment(message_id, attachment_id)
            
            # Check if PDF
            is_pdf = mime_type in self.supported_pdf_types
            
            # Extract text from PDF
            extracted_text = ''
            if is_pdf:
                try:
                    extracted_text = self.extract_pdf_text(file_data)
                    logger.info(f"Extracted {len(extracted_text)} characters from PDF: {filename}")
                except Exception as e:
                    logger.error(f"Failed to extract text from PDF {filename}: {e}")
            
            return {
                'filename': filename,
                'content_type': mime_type,
                'file_size': file_size,
                'file_data': file_data,
                'is_pdf': is_pdf,
                'extracted_text': extracted_text
            }
            
        except Exception as e:
            logger.error(f"Failed to process attachment: {e}")
            return None


def get_email_processor() -> EmailProcessor:
    """
    Get email processor instance.
    
    Returns:
        EmailProcessor instance
    """
    return EmailProcessor()
