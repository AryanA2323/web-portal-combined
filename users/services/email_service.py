"""
Email service for sending authentication-related emails.

Provides:
- 2FA verification codes
- Password reset emails
- Email verification
"""

import logging
from typing import Optional
from django.core.mail import send_mail, EmailMultiAlternatives
from django.template.loader import render_to_string
from django.conf import settings
from django.utils.html import strip_tags

logger = logging.getLogger(__name__)


class EmailService:
    """Service for sending transactional emails."""
    
    def __init__(self):
        self.from_email = getattr(
            settings, 
            'DEFAULT_FROM_EMAIL', 
            'noreply@incidentplatform.com'
        )
        self.site_name = getattr(
            settings,
            'SITE_NAME',
            'Incident Management Platform'
        )
        self.frontend_url = getattr(
            settings,
            'FRONTEND_URL',
            'http://localhost:3000'
        )
    
    def send_email(
        self,
        to_email: str,
        subject: str,
        html_content: str,
        text_content: Optional[str] = None
    ) -> bool:
        """
        Send an email with both HTML and plain text versions.
        
        Returns True if sent successfully, False otherwise.
        """
        try:
            if text_content is None:
                text_content = strip_tags(html_content)
            
            email = EmailMultiAlternatives(
                subject=subject,
                body=text_content,
                from_email=self.from_email,
                to=[to_email],
            )
            email.attach_alternative(html_content, "text/html")
            email.send(fail_silently=False)
            
            logger.info(f"Email sent successfully to {to_email}: {subject}")
            return True
            
        except Exception as e:
            logger.error(f"Failed to send email to {to_email}: {e}")
            return False
    
    def send_2fa_code(self, user, code: str) -> bool:
        """Send 2FA verification code email."""
        subject = f"Your verification code - {self.site_name}"
        
        html_content = f"""
        <!DOCTYPE html>
        <html>
        <head>
            <style>
                body {{ font-family: Arial, sans-serif; line-height: 1.6; color: #333; }}
                .container {{ max-width: 600px; margin: 0 auto; padding: 20px; }}
                .header {{ background-color: #2563eb; color: white; padding: 20px; text-align: center; }}
                .content {{ padding: 30px; background-color: #f9fafb; }}
                .code {{ font-size: 32px; font-weight: bold; color: #2563eb; letter-spacing: 8px; 
                         text-align: center; padding: 20px; background-color: white; 
                         border: 2px dashed #2563eb; margin: 20px 0; }}
                .warning {{ color: #dc2626; font-size: 14px; margin-top: 20px; }}
                .footer {{ text-align: center; padding: 20px; color: #6b7280; font-size: 12px; }}
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h1>{self.site_name}</h1>
                </div>
                <div class="content">
                    <h2>Two-Factor Authentication</h2>
                    <p>Hello {user.first_name or user.username},</p>
                    <p>Your verification code is:</p>
                    <div class="code">{code}</div>
                    <p>This code will expire in <strong>10 minutes</strong>.</p>
                    <p class="warning">
                        ⚠️ If you didn't request this code, please ignore this email 
                        and consider changing your password.
                    </p>
                </div>
                <div class="footer">
                    <p>This is an automated message. Please do not reply.</p>
                    <p>&copy; {self.site_name}</p>
                </div>
            </div>
        </body>
        </html>
        """
        
        text_content = f"""
        {self.site_name} - Two-Factor Authentication
        
        Hello {user.first_name or user.username},
        
        Your verification code is: {code}
        
        This code will expire in 10 minutes.
        
        If you didn't request this code, please ignore this email and consider changing your password.
        """
        
        return self.send_email(user.email, subject, html_content, text_content)
    
    def send_password_reset_code(self, user, code: str) -> bool:
        """Send password reset verification code email."""
        subject = f"Password Reset Code - {self.site_name}"
        
        html_content = f"""
        <!DOCTYPE html>
        <html>
        <head>
            <style>
                body {{ font-family: Arial, sans-serif; line-height: 1.6; color: #333; }}
                .container {{ max-width: 600px; margin: 0 auto; padding: 20px; }}
                .header {{ background-color: #dc2626; color: white; padding: 20px; text-align: center; }}
                .content {{ padding: 30px; background-color: #f9fafb; }}
                .code {{ font-size: 32px; font-weight: bold; color: #dc2626; letter-spacing: 8px; 
                         text-align: center; padding: 20px; background-color: white; 
                         border: 2px dashed #dc2626; margin: 20px 0; }}
                .warning {{ color: #dc2626; font-size: 14px; margin-top: 20px; }}
                .footer {{ text-align: center; padding: 20px; color: #6b7280; font-size: 12px; }}
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h1>Password Reset</h1>
                </div>
                <div class="content">
                    <h2>Reset Your Password</h2>
                    <p>Hello {user.first_name or user.username},</p>
                    <p>We received a request to reset your password. Use the following code:</p>
                    <div class="code">{code}</div>
                    <p>This code will expire in <strong>10 minutes</strong>.</p>
                    <p class="warning">
                        ⚠️ If you didn't request a password reset, please ignore this email. 
                        Your password will remain unchanged.
                    </p>
                </div>
                <div class="footer">
                    <p>This is an automated message. Please do not reply.</p>
                    <p>&copy; {self.site_name}</p>
                </div>
            </div>
        </body>
        </html>
        """
        
        text_content = f"""
        {self.site_name} - Password Reset
        
        Hello {user.first_name or user.username},
        
        We received a request to reset your password. Use the following code: {code}
        
        This code will expire in 10 minutes.
        
        If you didn't request a password reset, please ignore this email.
        """
        
        return self.send_email(user.email, subject, html_content, text_content)
    
    def send_password_reset_link(self, user, token: str) -> bool:
        """Send password reset link email."""
        reset_url = f"{self.frontend_url}/reset-password?token={token}"
        subject = f"Password Reset Request - {self.site_name}"
        
        html_content = f"""
        <!DOCTYPE html>
        <html>
        <head>
            <style>
                body {{ font-family: Arial, sans-serif; line-height: 1.6; color: #333; }}
                .container {{ max-width: 600px; margin: 0 auto; padding: 20px; }}
                .header {{ background-color: #dc2626; color: white; padding: 20px; text-align: center; }}
                .content {{ padding: 30px; background-color: #f9fafb; }}
                .button {{ display: inline-block; padding: 15px 30px; background-color: #2563eb; 
                          color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }}
                .link {{ word-break: break-all; color: #2563eb; }}
                .warning {{ color: #dc2626; font-size: 14px; margin-top: 20px; }}
                .footer {{ text-align: center; padding: 20px; color: #6b7280; font-size: 12px; }}
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h1>Password Reset</h1>
                </div>
                <div class="content">
                    <h2>Reset Your Password</h2>
                    <p>Hello {user.first_name or user.username},</p>
                    <p>We received a request to reset your password. Click the button below to proceed:</p>
                    <p style="text-align: center;">
                        <a href="{reset_url}" class="button">Reset Password</a>
                    </p>
                    <p>Or copy and paste this link into your browser:</p>
                    <p class="link">{reset_url}</p>
                    <p>This link will expire in <strong>1 hour</strong>.</p>
                    <p class="warning">
                        ⚠️ If you didn't request a password reset, please ignore this email. 
                        Your password will remain unchanged.
                    </p>
                </div>
                <div class="footer">
                    <p>This is an automated message. Please do not reply.</p>
                    <p>&copy; {self.site_name}</p>
                </div>
            </div>
        </body>
        </html>
        """
        
        text_content = f"""
        {self.site_name} - Password Reset
        
        Hello {user.first_name or user.username},
        
        We received a request to reset your password. Click the link below to proceed:
        
        {reset_url}
        
        This link will expire in 1 hour.
        
        If you didn't request a password reset, please ignore this email.
        """
        
        return self.send_email(user.email, subject, html_content, text_content)
    
    def send_password_changed_notification(self, user) -> bool:
        """Send notification that password was changed."""
        subject = f"Password Changed - {self.site_name}"
        
        html_content = f"""
        <!DOCTYPE html>
        <html>
        <head>
            <style>
                body {{ font-family: Arial, sans-serif; line-height: 1.6; color: #333; }}
                .container {{ max-width: 600px; margin: 0 auto; padding: 20px; }}
                .header {{ background-color: #059669; color: white; padding: 20px; text-align: center; }}
                .content {{ padding: 30px; background-color: #f9fafb; }}
                .warning {{ color: #dc2626; font-size: 14px; margin-top: 20px; padding: 15px; 
                           background-color: #fef2f2; border-left: 4px solid #dc2626; }}
                .footer {{ text-align: center; padding: 20px; color: #6b7280; font-size: 12px; }}
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h1>Password Changed</h1>
                </div>
                <div class="content">
                    <h2>Your password has been changed</h2>
                    <p>Hello {user.first_name or user.username},</p>
                    <p>This is a confirmation that your password was successfully changed.</p>
                    <div class="warning">
                        <strong>Didn't make this change?</strong><br>
                        If you didn't change your password, your account may have been compromised. 
                        Please contact support immediately.
                    </div>
                </div>
                <div class="footer">
                    <p>This is an automated message. Please do not reply.</p>
                    <p>&copy; {self.site_name}</p>
                </div>
            </div>
        </body>
        </html>
        """
        
        text_content = f"""
        {self.site_name} - Password Changed
        
        Hello {user.first_name or user.username},
        
        This is a confirmation that your password was successfully changed.
        
        If you didn't change your password, your account may have been compromised.
        Please contact support immediately.
        """
        
        return self.send_email(user.email, subject, html_content, text_content)
    
    def send_2fa_enabled_notification(self, user) -> bool:
        """Send notification that 2FA was enabled."""
        subject = f"Two-Factor Authentication Enabled - {self.site_name}"
        
        html_content = f"""
        <!DOCTYPE html>
        <html>
        <head>
            <style>
                body {{ font-family: Arial, sans-serif; line-height: 1.6; color: #333; }}
                .container {{ max-width: 600px; margin: 0 auto; padding: 20px; }}
                .header {{ background-color: #059669; color: white; padding: 20px; text-align: center; }}
                .content {{ padding: 30px; background-color: #f9fafb; }}
                .success {{ color: #059669; font-size: 14px; margin-top: 20px; padding: 15px; 
                           background-color: #f0fdf4; border-left: 4px solid #059669; }}
                .footer {{ text-align: center; padding: 20px; color: #6b7280; font-size: 12px; }}
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h1>🔒 2FA Enabled</h1>
                </div>
                <div class="content">
                    <h2>Two-Factor Authentication is now active</h2>
                    <p>Hello {user.first_name or user.username},</p>
                    <p>Two-factor authentication has been successfully enabled on your account.</p>
                    <div class="success">
                        <strong>Your account is now more secure!</strong><br>
                        From now on, you'll need to enter a verification code sent to your email 
                        each time you log in.
                    </div>
                </div>
                <div class="footer">
                    <p>This is an automated message. Please do not reply.</p>
                    <p>&copy; {self.site_name}</p>
                </div>
            </div>
        </body>
        </html>
        """
        
        return self.send_email(user.email, subject, html_content)

    def send_welcome_email(self, user) -> bool:
        """Send welcome email to newly registered users."""
        subject = f"Welcome to {self.site_name}!"
        
        role_message = {
            'CLIENT': "You can now submit and track incidents through our platform.",
            'VENDOR': "You can now manage and resolve assigned incidents.",
            'ADMIN': "You have administrative access to manage the platform."
        }.get(user.role, "Welcome to our platform!")
        
        html_content = f"""
        <!DOCTYPE html>
        <html>
        <head>
            <style>
                body {{ font-family: Arial, sans-serif; line-height: 1.6; color: #333; }}
                .container {{ max-width: 600px; margin: 0 auto; padding: 20px; }}
                .header {{ background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }}
                .content {{ padding: 30px; background-color: #f9fafb; }}
                .role-badge {{ display: inline-block; padding: 8px 16px; background-color: #6366f1; color: white; border-radius: 20px; font-weight: bold; margin: 10px 0; }}
                .info {{ background-color: #eef2ff; padding: 20px; border-radius: 8px; margin: 20px 0; }}
                .cta-button {{ display: inline-block; padding: 12px 30px; background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%); color: white !important; text-decoration: none; border-radius: 8px; font-weight: bold; margin-top: 20px; }}
                .footer {{ text-align: center; padding: 20px; color: #6b7280; font-size: 12px; }}
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h1>🎉 Welcome!</h1>
                    <p style="margin: 0; opacity: 0.9;">Your account has been created successfully</p>
                </div>
                <div class="content">
                    <h2>Hello {user.first_name or user.username}!</h2>
                    <p>Thank you for registering with <strong>{self.site_name}</strong>.</p>
                    
                    <p>Your account details:</p>
                    <div class="info">
                        <p><strong>Username:</strong> {user.username}</p>
                        <p><strong>Email:</strong> {user.email}</p>
                        <p><strong>Role:</strong> <span class="role-badge">{user.role}</span></p>
                    </div>
                    
                    <p>{role_message}</p>
                    
                    <p>For added security, we recommend enabling Two-Factor Authentication (2FA) in your account settings.</p>
                    
                    <center>
                        <a href="{self.frontend_url}/login" class="cta-button">Login to Your Account</a>
                    </center>
                </div>
                <div class="footer">
                    <p>This is an automated message. Please do not reply.</p>
                    <p>&copy; {self.site_name}</p>
                </div>
            </div>
        </body>
        </html>
        """
        
        text_content = f"""
        Welcome to {self.site_name}!
        
        Hello {user.first_name or user.username},
        
        Thank you for registering with {self.site_name}.
        
        Your account details:
        - Username: {user.username}
        - Email: {user.email}
        - Role: {user.role}
        
        {role_message}
        
        Login at: {self.frontend_url}/login
        """
        
        return self.send_email(user.email, subject, html_content, text_content)


# Global email service instance
email_service = EmailService()
