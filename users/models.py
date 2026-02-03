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


class EmailIntake(models.Model):
    """Model for storing incoming emails from Gmail OAuth."""
    
    # Email metadata
    message_id = models.CharField(max_length=255, unique=True, db_index=True)
    thread_id = models.CharField(max_length=255, blank=True)
    subject = models.CharField(max_length=500)
    sender_email = models.EmailField()
    sender_name = models.CharField(max_length=255, blank=True)
    recipient_email = models.EmailField()
    cc_emails = models.TextField(blank=True, help_text='Comma-separated CC emails')
    bcc_emails = models.TextField(blank=True, help_text='Comma-separated BCC emails')
    
    # Email content
    body_text = models.TextField(blank=True)
    body_html = models.TextField(blank=True)
    
    # Email received date
    received_at = models.DateTimeField()
    
    # Processing status
    class ProcessingStatus(models.TextChoices):
        PENDING = 'PENDING', 'Pending'
        PROCESSING = 'PROCESSING', 'Processing'
        COMPLETED = 'COMPLETED', 'Completed'
        FAILED = 'FAILED', 'Failed'
    
    processing_status = models.CharField(
        max_length=20,
        choices=ProcessingStatus.choices,
        default=ProcessingStatus.PENDING,
        db_index=True,
    )
    processing_error = models.TextField(blank=True)
    
    # Has attachments flag
    has_attachments = models.BooleanField(default=False)
    
    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)
    processed_at = models.DateTimeField(null=True, blank=True)
    
    class Meta:
        indexes = [
            models.Index(fields=['message_id']),
            models.Index(fields=['processing_status', 'created_at']),
            models.Index(fields=['received_at']),
            models.Index(fields=['sender_email']),
        ]
        ordering = ['-received_at']
    
    def __str__(self):
        return f"Email from {self.sender_email}: {self.subject[:50]}"


class EmailAttachment(models.Model):
    """Model for storing email attachments."""
    
    email = models.ForeignKey(
        EmailIntake,
        on_delete=models.CASCADE,
        related_name='attachments'
    )
    
    # Attachment metadata
    filename = models.CharField(max_length=500)
    content_type = models.CharField(max_length=100)
    file_size = models.BigIntegerField(default=0, help_text='File size in bytes')
    
    # File storage
    file_path = models.FileField(upload_to='email_attachments/%Y/%m/%d/')
    
    # PDF extraction
    is_pdf = models.BooleanField(default=False)
    extracted_text = models.TextField(blank=True, help_text='Text extracted from PDF')
    
    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        indexes = [
            models.Index(fields=['email', 'filename']),
            models.Index(fields=['content_type']),
            models.Index(fields=['is_pdf']),
        ]
        ordering = ['filename']
    
    def __str__(self):
        return f"{self.filename} ({self.content_type})"


class GmailOAuthToken(models.Model):
    """Model for storing Gmail OAuth tokens."""
    
    # OAuth credentials
    access_token = models.TextField()
    refresh_token = models.TextField()
    token_uri = models.URLField(default='https://oauth2.googleapis.com/token')
    client_id = models.CharField(max_length=500)
    client_secret = models.CharField(max_length=500)
    scopes = models.TextField(help_text='JSON array of scopes')
    
    # Token expiry
    expires_at = models.DateTimeField()
    
    # Email account
    email_address = models.EmailField(unique=True)
    
    # Status
    is_active = models.BooleanField(default=True)
    last_synced_at = models.DateTimeField(null=True, blank=True)
    
    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        indexes = [
            models.Index(fields=['email_address']),
            models.Index(fields=['is_active']),
        ]
    
    def __str__(self):
        return f"Gmail OAuth Token for {self.email_address}"


# ============================================================================
# Insurance Case Management Models (From Traditional Excel Database)
# ============================================================================

class Client(models.Model):
    """Client/Insurance Company model."""
    
    client_code = models.CharField(max_length=20, unique=True, db_index=True)
    client_name = models.CharField(max_length=500)
    location = models.CharField(max_length=200, blank=True)
    date_of_commencement = models.DateField(null=True, blank=True)
    
    # Pricing per investigation type
    insured_rate = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    notice_134_rate = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    claimant_rate = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    income_rate = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    driver_rate = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    dl_rate = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    rc_rate = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    permit_rate = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    spot_rate = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    court_rate = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    notice_rate = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    rti_rate = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    hospital_rate = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    
    # Metadata
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        db_table = 'insurance_client'
        indexes = [
            models.Index(fields=['client_code']),
            models.Index(fields=['client_name']),
        ]
        ordering = ['client_name']
    
    def __str__(self):
        return f"{self.client_code} - {self.client_name}"


class InsuranceCase(models.Model):
    """Main Insurance Case model - matches traditional Excel MIS sheet structure."""
    
    # Category choices
    CATEGORY_CHOICES = [
        ('MACT', 'MACT'),
        ('CIVIL', 'Civil'),
        ('CRIMINAL', 'Criminal'),
        ('OTHER', 'Other'),
    ]
    
    # Case Type choices
    CASE_TYPE_CHOICES = [
        ('Full Case', 'Full Case'),
        ('Connected Case', 'Connected Case'),
        ('Partial Investigation', 'Partial Investigation'),
    ]
    
    # Status choices
    STATUS_CHOICES = [
        ('Open', 'Open'),
        ('WIP', 'Work In Progress'),
        ('Completed', 'Completed'),
        ('Dispatch', 'Dispatch'),
        ('Closed', 'Closed'),
    ]
    
    # Investigation Report Status
    REPORT_STATUS_CHOICES = [
        ('Pending', 'Pending'),
        ('Draft', 'Draft'),
        ('Completed', 'Completed'),
        ('Dispatch', 'Dispatch'),
    ]
    
    # Basic Information
    serial_number = models.IntegerField(null=True, blank=True)
    claim_number = models.CharField(max_length=100, unique=True, db_index=True)
    client = models.ForeignKey(Client, on_delete=models.PROTECT, related_name='cases', null=True, blank=True)
    client_name = models.CharField(max_length=500)
    category = models.CharField(max_length=20, choices=CATEGORY_CHOICES, default='MACT')
    crn = models.CharField(max_length=100, blank=True, help_text='Case Reference Number')
    
    # Dates and Timing
    case_receipt_date = models.DateField()
    receipt_month = models.CharField(max_length=20, blank=True)
    completion_date = models.DateTimeField(null=True, blank=True)
    completion_month = models.CharField(max_length=20, blank=True)
    case_due_date = models.DateField(null=True, blank=True)
    tat_days = models.IntegerField(null=True, blank=True, help_text='Turn Around Time in days')
    sla_status = models.CharField(max_length=20, blank=True, help_text='Service Level Agreement status')
    
    # Case Details
    case_type = models.CharField(max_length=50, choices=CASE_TYPE_CHOICES, blank=True)
    investigation_report_status = models.CharField(max_length=20, choices=REPORT_STATUS_CHOICES, default='Pending')
    full_case_status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='Open')
    scope_of_work = models.TextField(blank=True)
    case_notes = models.TextField(blank=True)
    
    # Policy Information
    policy_number = models.CharField(max_length=100, blank=True)
    
    # Claimant Details
    claimant_name = models.CharField(max_length=500, blank=True)
    claimant_address = models.TextField(blank=True)
    claimant_district = models.CharField(max_length=200, blank=True)
    claimant_status = models.CharField(max_length=50, blank=True)
    
    # Income Details
    income_details = models.TextField(blank=True)
    income_address = models.TextField(blank=True)
    income_district = models.CharField(max_length=200, blank=True)
    income_status = models.CharField(max_length=50, blank=True)
    
    # Insured Details
    insured_name = models.CharField(max_length=500, blank=True)
    insured_address = models.TextField(blank=True)
    insured_district = models.CharField(max_length=200, blank=True)
    notice_132 = models.CharField(max_length=50, blank=True)
    insured_status = models.CharField(max_length=50, blank=True)
    
    # Driver Details
    driver_name = models.CharField(max_length=500, blank=True)
    driver_address = models.TextField(blank=True)
    driver_district = models.CharField(max_length=200, blank=True)
    driver_status = models.CharField(max_length=50, blank=True)
    
    # Document Verification
    dl_status = models.CharField(max_length=50, blank=True)
    rc_status = models.CharField(max_length=50, blank=True)
    permit_status = models.CharField(max_length=50, blank=True)
    fitness_status = models.CharField(max_length=50, blank=True)
    
    # Spot Investigation
    spot_location = models.TextField(blank=True)
    spot_district = models.CharField(max_length=200, blank=True)
    spot_status = models.CharField(max_length=50, blank=True)
    
    # Police/Legal Details
    fir_number = models.CharField(max_length=100, blank=True)
    police_station = models.CharField(max_length=200, blank=True)
    police_district = models.CharField(max_length=200, blank=True)
    rti_status = models.CharField(max_length=50, blank=True)
    chargesheet_status = models.CharField(max_length=50, blank=True)
    
    # Hospital Details
    hospital_name = models.CharField(max_length=500, blank=True)
    hospital_address = models.TextField(blank=True)
    hospital_district = models.CharField(max_length=200, blank=True)
    hospital_status = models.CharField(max_length=50, blank=True)
    
    # Dispatch Details
    dispatch_date = models.DateField(null=True, blank=True)
    dispatch_status = models.CharField(max_length=50, blank=True)
    
    # Link to Email
    source_email = models.ForeignKey(
        EmailIntake,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='created_cases'
    )
    
    # Metadata
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        db_table = 'insurance_case'
        indexes = [
            models.Index(fields=['claim_number']),
            models.Index(fields=['case_receipt_date']),
            models.Index(fields=['full_case_status']),
            models.Index(fields=['category']),
        ]
        ordering = ['-case_receipt_date']
    
    def __str__(self):
        return f"{self.claim_number} - {self.client_name}"


class CaseDocument(models.Model):
    """Documents extracted from emails and linked to cases."""
    
    DOCUMENT_TYPE_CHOICES = [
        ('POLICY', 'Policy Document'),
        ('PETITION', 'Petition Copy'),
        ('FIR', 'FIR Copy'),
        ('MEDICAL', 'Medical Report'),
        ('SPOT_PHOTO', 'Spot Photograph'),
        ('DL', 'Driving License'),
        ('RC', 'Registration Certificate'),
        ('PERMIT', 'Permit'),
        ('OTHER', 'Other'),
    ]
    
    case = models.ForeignKey(InsuranceCase, on_delete=models.CASCADE, related_name='documents')
    email_attachment = models.ForeignKey(
        EmailAttachment,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='linked_case_documents'
    )
    
    document_type = models.CharField(max_length=50, choices=DOCUMENT_TYPE_CHOICES)
    document_name = models.CharField(max_length=500)
    file_path = models.FileField(upload_to='case_documents/%Y/%m/%d/')
    
    # Extracted data
    extracted_text = models.TextField(blank=True)
    extracted_data = models.JSONField(default=dict, blank=True)
    
    # Metadata
    uploaded_date = models.DateTimeField(auto_now_add=True)
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        db_table = 'case_document'
        indexes = [
            models.Index(fields=['case', 'document_type']),
            models.Index(fields=['uploaded_date']),
        ]
        ordering = ['-uploaded_date']
    
    def __str__(self):
        return f"{self.case.claim_number} - {self.document_name}"
