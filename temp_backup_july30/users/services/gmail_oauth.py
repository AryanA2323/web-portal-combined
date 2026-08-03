"""
Gmail OAuth Service
Handles Gmail OAuth authentication and email retrieval.
"""

import os
import logging
import json
from datetime import datetime, timedelta
from typing import Optional, List, Dict, Any

from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import InstalledAppFlow
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError

from django.conf import settings
from django.utils import timezone

logger = logging.getLogger(__name__)

# Gmail API scopes
SCOPES = [
    'https://www.googleapis.com/auth/gmail.readonly',
    'https://www.googleapis.com/auth/gmail.modify'
]


class GmailOAuthService:
    """Service for Gmail OAuth operations."""
    
    def __init__(self):
        """Initialize Gmail OAuth service."""
        self.client_id = settings.GMAIL_CLIENT_ID
        self.client_secret = settings.GMAIL_CLIENT_SECRET
        self.credentials = None
        self.service = None
    
    def get_authorization_url(self, redirect_uri: str = 'urn:ietf:wg:oauth:2.0:oob') -> str:
        """
        Generate OAuth authorization URL.
        
        Args:
            redirect_uri: OAuth callback URL (default: out-of-band for manual code entry)
            
        Returns:
            Authorization URL string
        """
        try:
            # Create OAuth flow
            flow = InstalledAppFlow.from_client_config(
                {
                    "installed": {
                        "client_id": self.client_id,
                        "client_secret": self.client_secret,
                        "redirect_uris": [redirect_uri, "urn:ietf:wg:oauth:2.0:oob"],
                        "auth_uri": "https://accounts.google.com/o/oauth2/auth",
                        "token_uri": "https://oauth2.googleapis.com/token",
                    }
                },
                scopes=SCOPES,
                redirect_uri=redirect_uri
            )
            
            auth_url, _ = flow.authorization_url(
                access_type='offline',
                include_granted_scopes='true',
                prompt='consent'
            )
            
            return auth_url
            
        except Exception as e:
            logger.error(f"Failed to generate authorization URL: {e}")
            raise
    
    def exchange_code_for_tokens(self, code: str, redirect_uri: str = 'urn:ietf:wg:oauth:2.0:oob') -> Dict[str, Any]:
        """
        Exchange authorization code for access and refresh tokens.
        
        Args:
            code: Authorization code from OAuth callback
            redirect_uri: OAuth callback URL (default: out-of-band for manual code entry)
            
        Returns:
            Dictionary containing tokens and user info
        """
        try:
            # Create OAuth flow
            flow = InstalledAppFlow.from_client_config(
                {
                    "installed": {
                        "client_id": self.client_id,
                        "client_secret": self.client_secret,
                        "redirect_uris": [redirect_uri, "urn:ietf:wg:oauth:2.0:oob"],
                        "auth_uri": "https://accounts.google.com/o/oauth2/auth",
                        "token_uri": "https://oauth2.googleapis.com/token",
                    }
                },
                scopes=SCOPES,
                redirect_uri=redirect_uri
            )
            
            # Exchange code for credentials
            flow.fetch_token(code=code)
            credentials = flow.credentials
            
            # Build Gmail service to get user email
            service = build('gmail', 'v1', credentials=credentials)
            profile = service.users().getProfile(userId='me').execute()
            
            # Calculate expiry time
            expires_at = timezone.now() + timedelta(seconds=credentials.expiry.timestamp() - datetime.now().timestamp())
            
            return {
                'access_token': credentials.token,
                'refresh_token': credentials.refresh_token,
                'token_uri': credentials.token_uri,
                'client_id': credentials.client_id,
                'client_secret': credentials.client_secret,
                'scopes': credentials.scopes,
                'expires_at': expires_at,
                'email_address': profile.get('emailAddress')
            }
            
        except Exception as e:
            logger.error(f"Failed to exchange code for tokens: {e}")
            raise
    
    def refresh_access_token(self, refresh_token: str) -> Dict[str, Any]:
        """
        Refresh access token using refresh token.
        
        Args:
            refresh_token: Refresh token
            
        Returns:
            Dictionary with new access token and expiry
        """
        try:
            credentials = Credentials(
                token=None,
                refresh_token=refresh_token,
                token_uri='https://oauth2.googleapis.com/token',
                client_id=self.client_id,
                client_secret=self.client_secret,
                scopes=SCOPES
            )
            
            # Refresh the token
            credentials.refresh(Request())
            
            # Calculate expiry time
            expires_at = timezone.now() + timedelta(seconds=credentials.expiry.timestamp() - datetime.now().timestamp())
            
            return {
                'access_token': credentials.token,
                'expires_at': expires_at
            }
            
        except Exception as e:
            logger.error(f"Failed to refresh access token: {e}")
            raise
    
    def build_service(self, access_token: str, refresh_token: str):
        """
        Build Gmail API service.
        
        Args:
            access_token: OAuth access token
            refresh_token: OAuth refresh token
        """
        try:
            credentials = Credentials(
                token=access_token,
                refresh_token=refresh_token,
                token_uri='https://oauth2.googleapis.com/token',
                client_id=self.client_id,
                client_secret=self.client_secret,
                scopes=SCOPES
            )
            
            self.credentials = credentials
            self.service = build('gmail', 'v1', credentials=credentials)
            
        except Exception as e:
            logger.error(f"Failed to build Gmail service: {e}")
            raise
    
    def list_messages(self, max_results: int = 10, query: str = '') -> List[Dict[str, Any]]:
        """
        List messages from Gmail.
        
        Args:
            max_results: Maximum number of messages to retrieve
            query: Gmail search query
            
        Returns:
            List of message metadata
        """
        try:
            if not self.service:
                raise ValueError("Gmail service not initialized. Call build_service first.")
            
            results = self.service.users().messages().list(
                userId='me',
                maxResults=max_results,
                q=query
            ).execute()
            
            messages = results.get('messages', [])
            return messages
            
        except HttpError as e:
            logger.error(f"Failed to list messages: {e}")
            raise
    
    def get_message(self, message_id: str) -> Dict[str, Any]:
        """
        Get full message details.
        
        Args:
            message_id: Gmail message ID
            
        Returns:
            Full message data
        """
        try:
            if not self.service:
                raise ValueError("Gmail service not initialized. Call build_service first.")
            
            message = self.service.users().messages().get(
                userId='me',
                id=message_id,
                format='full'
            ).execute()
            
            return message
            
        except HttpError as e:
            logger.error(f"Failed to get message {message_id}: {e}")
            raise
    
    def get_attachment(self, message_id: str, attachment_id: str) -> bytes:
        """
        Download attachment from message.
        
        Args:
            message_id: Gmail message ID
            attachment_id: Attachment ID
            
        Returns:
            Attachment data as bytes
        """
        try:
            if not self.service:
                raise ValueError("Gmail service not initialized. Call build_service first.")
            
            attachment = self.service.users().messages().attachments().get(
                userId='me',
                messageId=message_id,
                id=attachment_id
            ).execute()
            
            import base64
            data = attachment.get('data')
            file_data = base64.urlsafe_b64decode(data)
            
            return file_data
            
        except HttpError as e:
            logger.error(f"Failed to download attachment {attachment_id}: {e}")
            raise
    
    def mark_as_read(self, message_id: str):
        """
        Mark message as read.
        
        Args:
            message_id: Gmail message ID
        """
        try:
            if not self.service:
                raise ValueError("Gmail service not initialized. Call build_service first.")
            
            self.service.users().messages().modify(
                userId='me',
                id=message_id,
                body={'removeLabelIds': ['UNREAD']}
            ).execute()
            
            logger.info(f"Marked message {message_id} as read")
            
        except HttpError as e:
            logger.error(f"Failed to mark message {message_id} as read: {e}")
            raise


def get_gmail_service() -> GmailOAuthService:
    """
    Get configured Gmail OAuth service instance.
    
    Returns:
        GmailOAuthService instance
    """
    return GmailOAuthService()
