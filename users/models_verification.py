"""
Case Verification Models
Handles verification tasks for insurance cases with document management
"""

from django.db import models
from django.conf import settings
from .models import InsuranceCase


class CaseVerification(models.Model):
    """Verification tasks for insurance cases (Claimant, Insured, Driver, Spot, Chargesheet)."""
    
    VERIFICATION_TYPE_CHOICES = [
        ('CLAIMANT_CHECK', 'Claimant Verification'),
        ('INSURED_CHECK', 'Insured Verification'),
        ('DRIVER_CHECK', 'Driver Verification'),
        ('SPOT_CHECK', 'Spot Investigation'),
        ('CHARGESHEET', 'Chargesheet Verification'),
    ]
    
    STATUS_CHOICES = [
        ('PENDING', 'Pending'),
        ('IN_PROGRESS', 'In Progress'),
        ('COMPLETED', 'Completed'),
        ('VERIFIED', 'Verified'),
        ('REJECTED', 'Rejected'),
        ('REQUIRES_REVISION', 'Requires Revision'),
    ]
    
    PRIORITY_CHOICES = [
        ('LOW', 'Low'),
        ('MEDIUM', 'Medium'),
        ('HIGH', 'High'),
        ('URGENT', 'Urgent'),
    ]
    
    # Core fields
    case = models.ForeignKey(InsuranceCase, on_delete=models.CASCADE, related_name='verifications')
    verification_type = models.CharField(max_length=50, choices=VERIFICATION_TYPE_CHOICES, db_index=True)
    status = models.CharField(max_length=30, choices=STATUS_CHOICES, default='PENDING', db_index=True)
    priority = models.CharField(max_length=20, choices=PRIORITY_CHOICES, default='MEDIUM')
    
    # Assignment tracking
    assigned_to = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='assigned_verifications'
    )
    verified_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='completed_verifications'
    )
    
    # Claimant fields
    claimant_name = models.CharField(max_length=500, blank=True)
    claimant_contact = models.CharField(max_length=20, blank=True)
    claimant_address = models.TextField(blank=True)
    income = models.DecimalField(max_digits=15, decimal_places=2, null=True, blank=True)
    fir_number_claimant = models.CharField(max_length=100, blank=True)
    court_name = models.CharField(max_length=500, blank=True)
    mv_act = models.CharField(max_length=500, blank=True)
    
    # Insured fields
    insured_name = models.CharField(max_length=500, blank=True)
    insured_contact = models.CharField(max_length=20, blank=True)
    insured_address = models.TextField(blank=True)
    policy_number = models.CharField(max_length=100, blank=True)
    policy_period = models.CharField(max_length=200, blank=True)
    rc_number = models.CharField(max_length=100, blank=True)
    permit_insured = models.CharField(max_length=200, blank=True)
    
    # Driver fields
    driver_name = models.CharField(max_length=500, blank=True)
    driver_contact = models.CharField(max_length=20, blank=True)
    driver_address = models.TextField(blank=True)
    dl_number = models.CharField(max_length=100, blank=True)
    permit_driver = models.CharField(max_length=200, blank=True)
    occupation = models.CharField(max_length=200, blank=True)
    driver_and_insured_same = models.BooleanField(default=False)
    
    # Spot investigation fields
    time_of_accident = models.CharField(max_length=100, blank=True)
    place_of_accident = models.CharField(max_length=500, blank=True)
    district = models.CharField(max_length=200, blank=True)
    fir_number_spot = models.CharField(max_length=100, blank=True)
    police_station = models.CharField(max_length=200, blank=True)
    accident_brief = models.TextField(blank=True)
    
    # Chargesheet fields
    fir_delay_in_days = models.IntegerField(null=True, blank=True)
    bsn_sections = models.CharField(max_length=500, blank=True)
    ipc_sections = models.CharField(max_length=500, blank=True)
    
    # Common fields
    check_status = models.CharField(max_length=50, blank=True)
    statement = models.TextField(blank=True)
    observations = models.TextField(blank=True)
    findings = models.TextField(blank=True)
    notes = models.TextField(blank=True)
    
    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    assigned_at = models.DateTimeField(null=True, blank=True)
    started_at = models.DateTimeField(null=True, blank=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    verified_at = models.DateTimeField(null=True, blank=True)
    
    class Meta:
        db_table = 'case_verification'
        verbose_name = 'Case Verification'
        verbose_name_plural = 'Case Verifications'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['case', 'verification_type']),
            models.Index(fields=['status', 'priority']),
            models.Index(fields=['assigned_to', 'status']),
            models.Index(fields=['created_at']),
        ]
        unique_together = [('case', 'verification_type')]
    
    def __str__(self):
        return f"{self.case.case_number} - {self.get_verification_type_display()}"


class VerificationDocument(models.Model):
    """Documents uploaded for verification tasks."""
    
    DOCUMENT_TYPE_CHOICES = [
        ('PHOTO', 'Photograph'),
        ('SCAN', 'Scanned Document'),
        ('PDF', 'PDF Document'),
        ('VIDEO', 'Video Recording'),
        ('AUDIO', 'Audio Recording'),
        ('REPORT', 'Investigation Report'),
        ('STATEMENT', 'Written Statement'),
        ('CERTIFICATE', 'Certificate'),
        ('OTHER', 'Other'),
    ]
    
    verification = models.ForeignKey(CaseVerification, on_delete=models.CASCADE, related_name='documents')
    document_type = models.CharField(max_length=30, choices=DOCUMENT_TYPE_CHOICES, default='PHOTO')
    title = models.CharField(max_length=500)
    description = models.TextField(blank=True)
    file_path = models.CharField(max_length=1000)
    file_name = models.CharField(max_length=500)
    file_size = models.BigIntegerField()
    mime_type = models.CharField(max_length=100, blank=True)
    
    uploaded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name='uploaded_verification_documents'
    )
    uploaded_at = models.DateTimeField(auto_now_add=True)
    
    is_verified = models.BooleanField(default=False)
    is_primary = models.BooleanField(default=False)
    notes = models.TextField(blank=True)
    
    class Meta:
        db_table = 'verification_document'
        verbose_name = 'Verification Document'
        verbose_name_plural = 'Verification Documents'
        ordering = ['-uploaded_at']
        indexes = [
            models.Index(fields=['verification', 'document_type']),
            models.Index(fields=['uploaded_at']),
        ]
    
    def __str__(self):
        return f"{self.verification} - {self.file_name}"


class VerificationComment(models.Model):
    """Comments on verification tasks."""
    
    verification = models.ForeignKey(CaseVerification, on_delete=models.CASCADE, related_name='comments')
    comment = models.TextField()
    is_internal = models.BooleanField(default=True)
    
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name='verification_comments'
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        db_table = 'verification_comment'
        verbose_name = 'Verification Comment'
        verbose_name_plural = 'Verification Comments'
        ordering = ['created_at']
        indexes = [
            models.Index(fields=['verification', 'created_at']),
        ]
    
    def __str__(self):
        return f"Comment on {self.verification}"


class ClaimantDependent(models.Model):
    """Dependents of claimants."""
    
    case = models.ForeignKey(InsuranceCase, on_delete=models.CASCADE, related_name='claimant_dependents')
    dependent_name = models.CharField(max_length=500)
    dependent_contact = models.CharField(max_length=20, blank=True)
    dependent_address = models.TextField(blank=True)
    relationship = models.CharField(max_length=100, blank=True)
    age = models.IntegerField(null=True, blank=True)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        db_table = 'claimant_dependent'
        verbose_name = 'Claimant Dependent'
        verbose_name_plural = 'Claimant Dependents'
        ordering = ['created_at']
        indexes = [
            models.Index(fields=['case']),
        ]
    
    def __str__(self):
        return f"{self.dependent_name} ({self.relationship})"
