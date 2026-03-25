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


class EvidencePhoto(models.Model):
    """
    Evidence photos uploaded by vendors for cases.
    REQUIRES GPS coordinates - photos without geotags cannot be uploaded.
    """
    
    # Case reference - using case_id as integer since cases_case table exists
    # but doesn't have a Django model in this app
    case_id = models.IntegerField(
        db_index=True,
        help_text='Reference to cases_case table'
    )
    
    # Vendor who uploaded the photo
    vendor = models.ForeignKey(
        Vendor,
        on_delete=models.CASCADE,
        related_name='evidence_photos',
    )
    
    # Photo file
    photo = models.ImageField(
        upload_to='evidence_photos/%Y/%m/%d/',
        help_text='Evidence photo with GPS metadata'
    )
    
    # GPS coordinates (REQUIRED - not nullable)
    latitude = models.DecimalField(
        max_digits=9,
        decimal_places=6,
        help_text='GPS latitude from photo EXIF data (REQUIRED)'
    )
    longitude = models.DecimalField(
        max_digits=9,
        decimal_places=6,
        help_text='GPS longitude from photo EXIF data (REQUIRED)'
    )
    
    # Optional metadata
    caption = models.CharField(max_length=500, blank=True)
    file_name = models.CharField(max_length=255)
    file_size = models.BigIntegerField(default=0, help_text='File size in bytes')
    
    # Timestamps
    uploaded_at = models.DateTimeField(auto_now_add=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        db_table = 'evidence_photo'
        indexes = [
            models.Index(fields=['case_id', 'uploaded_at']),
            models.Index(fields=['vendor', 'uploaded_at']),
            models.Index(fields=['case_id', 'vendor']),
        ]
        ordering = ['-uploaded_at']
    
    def __str__(self):
        return f"Evidence photo for case {self.case_id} by {self.vendor.company_name}"
    
    def clean(self):
        """Validate that GPS coordinates are present."""
        from django.core.exceptions import ValidationError
        if self.latitude is None or self.longitude is None:
            raise ValidationError(
                'GPS coordinates are required. Photos without geotag location cannot be uploaded.'
            )


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
    """Insurance Case model for tracking investigation cases."""
    
    # Category choices
    CATEGORY_CHOICES = [
        ('MACT', 'Motor Accident Claims Tribunal'),
        ('CIVIL', 'Civil Case'),
        ('CRIMINAL', 'Criminal Case'),
        ('CONSUMER', 'Consumer Forum'),
        ('OTHER', 'Other'),
    ]
    
    # Priority choices
    PRIORITY_CHOICES = [
        ('LOW', 'Low'),
        ('MEDIUM', 'Medium'),
        ('HIGH', 'High'),
        ('CRITICAL', 'Critical'),
    ]
    
    # Status choices
    STATUS_CHOICES = [
        ('OPEN', 'Open'),
        ('IN_PROGRESS', 'In Progress'),
        ('PENDING', 'Pending'),
        ('RESOLVED', 'Resolved'),
        ('CLOSED', 'Closed'),
    ]
    
    # Case Type choices
    CASE_TYPE_CHOICES = [
        ('Full Case', 'Full Case'),
        ('Partial Case', 'Partial Case'),
        ('Reassessment', 'Reassessment'),
        ('Connected Case', 'Connected Case'),
    ]
    
    # Investigation Report Status choices
    INVESTIGATION_REPORT_CHOICES = [
        ('Open', 'Open'),
        ('Approval', 'Approval'),
        ('Stop', 'Stop'),
        ('QC', 'QC'),
        ('Dispatch', 'Dispatch'),
    ]
    
    # Full Case Status choices
    FULL_CASE_STATUS_CHOICES = [
        ('WIP', 'WIP'),
        ('Pending CS', 'Pending CS'),
        ('Completed', 'Completed'),
        ('IR-Writing', 'IR-Writing'),
        ('NI', 'NI'),
        ('Withdraw', 'Withdraw'),
        ('QC-1', 'QC-1'),
        ('Pending Additional Docs', 'Pending Additional Docs'),
        ('Connected Pending', 'Connected Pending'),
        ('RCU Pending', 'RCU Pending'),
        ('Portal Upload', 'Portal Upload'),
    ]
    
    # SLA Status choices
    SLA_CHOICES = [
        ('AT', 'AT (Above TAT)'),
        ('WT', 'WT (Within TAT)'),
    ]
    
    # Workflow Type choices
    WORKFLOW_TYPE_CHOICES = [
        ('STANDARD', 'Standard Investigation'),
        ('EXPEDITED', 'Expedited'),
        ('FULL', 'Full Investigation'),
        ('PARTIAL', 'Partial Investigation'),
    ]
    
    # Source choices
    SOURCE_CHOICES = [
        ('EMAIL', 'Email'),
        ('MANUAL', 'Manual Entry'),
        ('WEB_PORTAL', 'Web Portal'),
        ('API', 'API'),
    ]
    
    # =========================================================================
    # Basic Information
    # =========================================================================
    case_number = models.CharField(max_length=100, unique=True, db_index=True)
    title = models.CharField(max_length=500)
    description = models.TextField(blank=True)
    category = models.CharField(max_length=20, choices=CATEGORY_CHOICES, default='MACT')
    priority = models.CharField(max_length=20, choices=PRIORITY_CHOICES, default='MEDIUM')
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='OPEN')
    
    # =========================================================================
    # Claim Information
    # =========================================================================
    claim_number = models.CharField(max_length=100, blank=True, db_index=True)
    client_code = models.CharField(max_length=100, blank=True)
    client_name = models.CharField(max_length=500, blank=True, help_text='Client / Insurance company name')
    
    # =========================================================================
    # Dates and Timing
    # =========================================================================
    case_receive_date = models.DateField(null=True, blank=True, help_text='Date case was received')
    receive_month = models.CharField(max_length=20, blank=True, help_text='Month of receive')
    completion_date = models.DateField(null=True, blank=True, help_text='Date case was completed')
    completion_month = models.CharField(max_length=20, blank=True, help_text='Month of completion')
    case_due_date = models.DateField(null=True, blank=True, help_text='Due date for the case')
    tat_days = models.IntegerField(null=True, blank=True, help_text='Turn Around Time in days')
    sla_status = models.CharField(max_length=10, choices=SLA_CHOICES, blank=True, help_text='SLA status - AT or WT')
    
    # =========================================================================
    # Case Classification
    # =========================================================================
    case_type = models.CharField(max_length=50, choices=CASE_TYPE_CHOICES, blank=True, help_text='Full Case / Partial / Reassessment / Connected')
    investigation_report_status = models.CharField(max_length=20, choices=INVESTIGATION_REPORT_CHOICES, default='Open', help_text='Investigation report status')
    full_case_status = models.CharField(max_length=30, choices=FULL_CASE_STATUS_CHOICES, default='WIP', help_text='Detailed case status')
    scope_of_work = models.TextField(blank=True, help_text='Scope of work for this case')
    
    # =========================================================================
    # People Information
    # =========================================================================
    insured_name = models.CharField(max_length=500, blank=True)
    claimant_name = models.CharField(max_length=500, blank=True)
    
    # =========================================================================
    # Incident Location
    # =========================================================================
    incident_address = models.TextField(blank=True)
    incident_city = models.CharField(max_length=200, blank=True)
    incident_state = models.CharField(max_length=200, blank=True)
    incident_postal_code = models.CharField(max_length=20, blank=True)
    incident_country = models.CharField(max_length=100, default='India')
    latitude = models.DecimalField(max_digits=10, decimal_places=7, null=True, blank=True)
    longitude = models.DecimalField(max_digits=10, decimal_places=7, null=True, blank=True)
    formatted_address = models.TextField(blank=True)
    
    # =========================================================================
    # Assignment
    # =========================================================================
    client = models.ForeignKey(Client, on_delete=models.PROTECT, related_name='insurance_cases', null=True, blank=True)
    created_by = models.ForeignKey(CustomUser, on_delete=models.SET_NULL, null=True, blank=True, related_name='created_insurance_cases')
    vendor = models.ForeignKey(Vendor, on_delete=models.SET_NULL, null=True, blank=True, related_name='assigned_insurance_cases')
    
    # =========================================================================
    # Workflow Information
    # =========================================================================
    source = models.CharField(max_length=20, choices=SOURCE_CHOICES, default='MANUAL')
    workflow_type = models.CharField(max_length=50, choices=WORKFLOW_TYPE_CHOICES, default='STANDARD')
    investigation_progress = models.IntegerField(default=0, help_text='Investigation progress percentage (0-100)')
    
    # =========================================================================
    # Verification Checklist (Boolean fields for tracking investigation tasks)
    # =========================================================================
    chk_spot = models.BooleanField(default=False, help_text='Spot investigation completed')
    chk_hospital = models.BooleanField(default=False, help_text='Hospital verification completed')
    chk_claimant = models.BooleanField(default=False, help_text='Claimant verification completed')
    chk_insured = models.BooleanField(default=False, help_text='Insured verification completed')
    chk_witness = models.BooleanField(default=False, help_text='Witness statement recorded')
    chk_driver = models.BooleanField(default=False, help_text='Driver verification completed')
    chk_dl = models.BooleanField(default=False, help_text='Driving License verified')
    chk_rc = models.BooleanField(default=False, help_text='RC verification completed')
    chk_permit = models.BooleanField(default=False, help_text='Permit verification completed')
    chk_court = models.BooleanField(default=False, help_text='Court records obtained')
    chk_notice = models.BooleanField(default=False, help_text='Notice verification completed')
    chk_134_notice = models.BooleanField(default=False, help_text='Section 134 notice verified')
    chk_rti = models.BooleanField(default=False, help_text='RTI filed')
    chk_medical_verification = models.BooleanField(default=False, help_text='Medical records verified')
    chk_income = models.BooleanField(default=False, help_text='Income verification completed')
    
    # =========================================================================
    # Dates (System managed)
    # =========================================================================
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    resolved_at = models.DateTimeField(null=True, blank=True)
    closed_at = models.DateTimeField(null=True, blank=True)
    
    # =========================================================================
    # Legacy Email Link (for backward compatibility)
    # =========================================================================
    source_email = models.ForeignKey(
        EmailIntake,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='created_insurance_cases'
    )
    
    class Meta:
        db_table = 'insurance_case'
        indexes = [
            models.Index(fields=['case_number']),
            models.Index(fields=['claim_number']),
            models.Index(fields=['status']),
            models.Index(fields=['category']),
            models.Index(fields=['priority']),
            models.Index(fields=['created_at']),
        ]
        ordering = ['-created_at']
    
    def __str__(self):
        return f"{self.case_number} - {self.title}"


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


class Report(models.Model):
    """AI-generated reports for legal review."""

    class Status(models.TextChoices):
        PENDING = 'PENDING', 'Pending'
        ASSIGNED = 'ASSIGNED', 'Assigned'
        ACCEPTED = 'ACCEPTED', 'Accepted'
        REJECTED = 'REJECTED', 'Rejected'

    case = models.ForeignKey(
        InsuranceCase,
        on_delete=models.CASCADE,
        related_name='reports',
    )
    report_content = models.TextField(
        help_text='AI-generated report content'
    )
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.PENDING,
        db_index=True,
    )
    assigned_lawyer = models.ForeignKey(
        CustomUser,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='assigned_reports',
        limit_choices_to={'role': CustomUser.Role.LAWYER},
    )
    assigned_at = models.DateTimeField(null=True, blank=True)
    reviewed_at = models.DateTimeField(null=True, blank=True)
    review_notes = models.TextField(
        blank=True,
        help_text='Lawyer review notes or rejection reason'
    )
    created_by = models.ForeignKey(
        CustomUser,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='created_reports',
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'reports'
        indexes = [
            models.Index(fields=['case', 'status']),
            models.Index(fields=['assigned_lawyer', 'status']),
            models.Index(fields=['status']),
            models.Index(fields=['created_at']),
        ]
        ordering = ['-created_at']

    def __str__(self):
        return f"Report for {self.case.case_number} - {self.status}"


# Import verification models
from .models_verification import CaseVerification, VerificationDocument, VerificationComment, ClaimantDependent
