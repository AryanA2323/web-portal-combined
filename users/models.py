from django.db import models
from django.contrib.auth.models import AbstractUser
from django.utils import timezone
import secrets


class CustomUser(AbstractUser):
    """Custom user model with role-based access and 2FA support."""
    
    class Role(models.TextChoices):
        SUPER_ADMIN = 'SUPER_ADMIN', 'Super Admin'
        ADMIN = 'ADMIN', 'Admin'
        VENDOR = 'VENDOR', 'Vendor'
        CLIENT = 'CLIENT', 'Client'
        LAWYER = 'LAWYER', 'Lawyer'
    
    class AdminSubRole(models.TextChoices):
        CASE_HANDLER = 'CASE_HANDLER', 'Case Handler'
        REPORT_MANAGER = 'REPORT_MANAGER', 'Report Manager'
        LOG_MANAGER = 'LOG_MANAGER', 'Log Manager'
        SUPER_ADMIN = 'SUPER_ADMIN', 'Super Admin'
    
    role = models.CharField(
        max_length=20,
        choices=Role.choices,
        default=Role.CLIENT,
        db_index=True,
    )
    sub_role = models.CharField(
        max_length=20,
        choices=AdminSubRole.choices,
        blank=True,
        null=True,
        help_text='Sub-role for admin users only',
    )
    permissions = models.JSONField(
        default=list,
        blank=True,
        help_text='Custom page permissions for this user',
    )
    is_2fa_enabled = models.BooleanField(default=False)
    
    class Meta:
        indexes = [
            models.Index(fields=['email']),
            models.Index(fields=['role', 'is_active']),
        ]
    
    def __str__(self):
        return f"{self.username} ({self.role})"


class EmailVerificationCode(models.Model):
    """Model for storing email verification codes (2FA and email verification)."""
    
    class Purpose(models.TextChoices):
        TWO_FACTOR_AUTH = '2FA', 'Two-Factor Authentication'
        PASSWORD_RESET = 'RESET', 'Password Reset'
        EMAIL_VERIFICATION = 'VERIFY', 'Email Verification'
    
    user = models.ForeignKey(
        CustomUser,
        on_delete=models.CASCADE,
        related_name='verification_codes',
    )
    code = models.CharField(max_length=6)
    purpose = models.CharField(
        max_length=10,
        choices=Purpose.choices,
    )
    created_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField()
    is_used = models.BooleanField(default=False)
    attempts = models.PositiveIntegerField(default=0)
    
    class Meta:
        indexes = [
            models.Index(fields=['user', 'purpose', 'is_used']),
            models.Index(fields=['code', 'purpose']),
            models.Index(fields=['expires_at']),
        ]
        ordering = ['-created_at']
    
    def save(self, *args, **kwargs):
        if not self.code:
            # Generate 6-digit code
            self.code = ''.join([str(secrets.randbelow(10)) for _ in range(6)])
        if not self.expires_at:
            from datetime import timedelta
            # Code expires in 10 minutes by default
            self.expires_at = timezone.now() + timedelta(minutes=10)
        super().save(*args, **kwargs)
    
    @property
    def is_expired(self):
        return timezone.now() > self.expires_at
    
    @property
    def is_valid(self):
        return not self.is_used and not self.is_expired and self.attempts < 5
    
    def increment_attempts(self):
        self.attempts += 1
        self.save(update_fields=['attempts'])
    
    def mark_used(self):
        self.is_used = True
        self.save(update_fields=['is_used'])
    
    @classmethod
    def create_code(cls, user, purpose, expiry_minutes=10):
        """Create a new verification code, invalidating old ones."""
        # Invalidate existing unused codes for this purpose
        cls.objects.filter(
            user=user,
            purpose=purpose,
            is_used=False
        ).update(is_used=True)
        
        from datetime import timedelta
        return cls.objects.create(
            user=user,
            purpose=purpose,
            expires_at=timezone.now() + timedelta(minutes=expiry_minutes)
        )
    
    def __str__(self):
        return f"{self.purpose} code for {self.user.username}"


class PasswordResetToken(models.Model):
    """Model for password reset tokens (URL-based reset)."""
    
    user = models.ForeignKey(
        CustomUser,
        on_delete=models.CASCADE,
        related_name='password_reset_tokens',
    )
    token = models.CharField(max_length=64, unique=True, db_index=True)
    created_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField()
    is_used = models.BooleanField(default=False)
    
    class Meta:
        indexes = [
            models.Index(fields=['token']),
            models.Index(fields=['user', 'is_used']),
            models.Index(fields=['expires_at']),
        ]
    
    def save(self, *args, **kwargs):
        if not self.token:
            self.token = secrets.token_urlsafe(48)
        if not self.expires_at:
            from datetime import timedelta
            # Token expires in 1 hour
            self.expires_at = timezone.now() + timedelta(hours=1)
        super().save(*args, **kwargs)
    
    @property
    def is_expired(self):
        return timezone.now() > self.expires_at
    
    @property
    def is_valid(self):
        return not self.is_used and not self.is_expired
    
    def mark_used(self):
        self.is_used = True
        self.save(update_fields=['is_used'])
    
    @classmethod
    def create_token(cls, user):
        """Create a new reset token, invalidating old ones."""
        # Invalidate existing tokens
        cls.objects.filter(user=user, is_used=False).update(is_used=True)
        return cls.objects.create(user=user)
    
    def __str__(self):
        return f"Password reset token for {self.user.username}"


class Vendor(models.Model):
    """Vendor model for service providers linked to vendor users."""
    
    user = models.OneToOneField(
        CustomUser,
        on_delete=models.CASCADE,
        related_name='vendor_profile',
        limit_choices_to={'role': CustomUser.Role.VENDOR},
    )
    company_name = models.CharField(max_length=255)
    contact_email = models.EmailField(blank=True)
    contact_phone = models.CharField(max_length=20, blank=True)
    
    # Location placeholder fields for future geolocation features
    address = models.TextField(blank=True)
    city = models.CharField(max_length=100, blank=True)
    state = models.CharField(max_length=100, blank=True)
    postal_code = models.CharField(max_length=20, blank=True)
    country = models.CharField(max_length=100, default='USA')
    latitude = models.DecimalField(
        max_digits=9, decimal_places=6, null=True, blank=True
    )
    longitude = models.DecimalField(
        max_digits=9, decimal_places=6, null=True, blank=True
    )
    
    # Metadata
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        indexes = [
            models.Index(fields=['company_name']),
            models.Index(fields=['city', 'state']),
            models.Index(fields=['is_active']),
        ]
        ordering = ['company_name']
    
    def __str__(self):
        return self.company_name


class Admin(models.Model):
    """Admin model for administrative users."""
    
    user = models.OneToOneField(
        CustomUser,
        on_delete=models.CASCADE,
        related_name='admin_profile',
        limit_choices_to={'role': CustomUser.Role.ADMIN},
    )
    department = models.CharField(max_length=255, blank=True)
    employee_id = models.CharField(max_length=50, unique=True)
    contact_email = models.EmailField(blank=True)
    contact_phone = models.CharField(max_length=20, blank=True)
    
    # Admin-specific metadata
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        indexes = [
            models.Index(fields=['employee_id']),
            models.Index(fields=['department']),
            models.Index(fields=['is_active']),
        ]
        ordering = ['employee_id']
    
    def __str__(self):
        return f"Admin: {self.user.username} ({self.department})"


class Lawyer(models.Model):
    """Lawyer model for legal professionals."""
    
    user = models.OneToOneField(
        CustomUser,
        on_delete=models.CASCADE,
        related_name='lawyer_profile',
        limit_choices_to={'role': CustomUser.Role.LAWYER},
    )
    bar_registration_number = models.CharField(max_length=50, unique=True)
    specialization = models.CharField(max_length=255, blank=True)
    contact_email = models.EmailField(blank=True)
    contact_phone = models.CharField(max_length=20, blank=True)
    
    # Office/practice info
    office_address = models.TextField(blank=True)
    office_city = models.CharField(max_length=100, blank=True)
    office_state = models.CharField(max_length=100, blank=True)
    
    # Experience
    years_of_experience = models.PositiveIntegerField(default=0)
    bio = models.TextField(blank=True)
    
    # Metadata
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        indexes = [
            models.Index(fields=['bar_registration_number']),
            models.Index(fields=['specialization']),
            models.Index(fields=['is_active']),
        ]
        ordering = ['bar_registration_number']
    
    def __str__(self):
        return f"Lawyer: {self.user.username} ({self.specialization})"


class AuthToken(models.Model):
    """Token model for API authentication."""
    
    user = models.ForeignKey(
        CustomUser,
        on_delete=models.CASCADE,
        related_name='auth_tokens',
    )
    token = models.CharField(max_length=64, unique=True, db_index=True)
    created_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField(null=True, blank=True)
    last_used_at = models.DateTimeField(null=True, blank=True)
    
    class Meta:
        indexes = [
            models.Index(fields=['token']),
            models.Index(fields=['user', 'expires_at']),
        ]
    
    def save(self, *args, **kwargs):
        if not self.token:
            import secrets
            self.token = secrets.token_hex(32)
        if not self.expires_at:
            from datetime import datetime, timedelta
            # Token expires in 7 days by default
            self.expires_at = datetime.now() + timedelta(days=7)
        super().save(*args, **kwargs)
    
    @property
    def is_expired(self):
        from django.utils import timezone
        if self.expires_at is None:
            return False
        return timezone.now() > self.expires_at
    
    def __str__(self):
        return f"Token for {self.user.username} (expires: {self.expires_at})"
