"""
Insurance Case Management Models
Based on traditional Excel database structure
"""

from django.db import models
from django.utils import timezone
from .models import EmailIntake, EmailAttachment


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
    """Main Insurance Case model - matches MIS sheet structure."""
    
    # Case Category choices
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
    client = models.ForeignKey(Client, on_delete=models.PROTECT, related_name='cases')
    client_name = models.CharField(max_length=500)  # Denormalized for quick access
    category = models.CharField(max_length=20, choices=CATEGORY_CHOICES)
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
    
    # ========== CLAIMANT DETAILS ==========
    claimant_name = models.CharField(max_length=500, blank=True)
    claimant_address = models.TextField(blank=True)
    claimant_district = models.CharField(max_length=200, blank=True)
    claimant_status = models.CharField(max_length=50, blank=True)
    
    # ========== INCOME DETAILS ==========
    income_details = models.TextField(blank=True)
    income_address = models.TextField(blank=True)
    income_district = models.CharField(max_length=200, blank=True)
    income_status = models.CharField(max_length=50, blank=True)
    
    # ========== INSURED DETAILS ==========
    insured_name = models.CharField(max_length=500, blank=True)
    insured_address = models.TextField(blank=True)
    insured_district = models.CharField(max_length=200, blank=True)
    notice_132 = models.CharField(max_length=50, blank=True, help_text='132 Notice details')
    insured_status = models.CharField(max_length=50, blank=True)
    
    # ========== DRIVER DETAILS ==========
    driver_name = models.CharField(max_length=500, blank=True)
    driver_address = models.TextField(blank=True)
    driver_district = models.CharField(max_length=200, blank=True)
    driver_status = models.CharField(max_length=50, blank=True)
    
    # ========== DOCUMENT VERIFICATION ==========
    dl_status = models.CharField(max_length=50, blank=True, help_text='Driving License')
    rc_status = models.CharField(max_length=50, blank=True, help_text='Registration Certificate')
    permit_status = models.CharField(max_length=50, blank=True)
    fitness_status = models.CharField(max_length=50, blank=True)
    
    # ========== SPOT INVESTIGATION ==========
    spot_location = models.TextField(blank=True)
    spot_district = models.CharField(max_length=200, blank=True)
    spot_status = models.CharField(max_length=50, blank=True)
    
    # ========== POLICE/LEGAL DETAILS ==========
    fir_number = models.CharField(max_length=100, blank=True)
    police_station = models.CharField(max_length=200, blank=True)
    police_district = models.CharField(max_length=200, blank=True)
    rti_status = models.CharField(max_length=50, blank=True, help_text='Right to Information')
    chargesheet_status = models.CharField(max_length=50, blank=True)
    
    # ========== HOSPITAL DETAILS ==========
    hospital_name = models.CharField(max_length=500, blank=True)
    hospital_address = models.TextField(blank=True)
    hospital_district = models.CharField(max_length=200, blank=True)
    hospital_status = models.CharField(max_length=50, blank=True)
    
    # ========== DISPATCH DETAILS ==========
    dispatch_date = models.DateField(null=True, blank=True)
    dispatch_status = models.CharField(max_length=50, blank=True)
    
    # Link to Email (if case was created from email)
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
            models.Index(fields=['client', 'full_case_status']),
            models.Index(fields=['case_receipt_date']),
            models.Index(fields=['completion_date']),
            models.Index(fields=['full_case_status']),
            models.Index(fields=['category']),
        ]
        ordering = ['-case_receipt_date']
    
    def __str__(self):
        return f"{self.claim_number} - {self.client_name}"
    
    def calculate_tat(self):
        """Calculate Turn Around Time."""
        if self.completion_date and self.case_receipt_date:
            delta = self.completion_date.date() - self.case_receipt_date
            self.tat_days = delta.days
            return self.tat_days
        elif self.case_receipt_date:
            delta = timezone.now().date() - self.case_receipt_date
            self.tat_days = delta.days
            return self.tat_days
        return None


class FieldInvestigator(models.Model):
    """Field Investigator/Advocate model."""
    
    name = models.CharField(max_length=500)
    location_district = models.CharField(max_length=200)
    contact_number = models.CharField(max_length=100, blank=True)
    email = models.EmailField(blank=True)
    onboard_date = models.DateField(null=True, blank=True)
    state = models.CharField(max_length=100, blank=True)
    subdistrict = models.CharField(max_length=200, blank=True)
    
    # Metadata
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        db_table = 'field_investigator'
        indexes = [
            models.Index(fields=['name']),
            models.Index(fields=['location_district']),
        ]
        ordering = ['name']
    
    def __str__(self):
        return f"{self.name} - {self.location_district}"


class CaseAllocation(models.Model):
    """Case allocation to field investigators."""
    
    STATUS_CHOICES = [
        ('Allocated', 'Allocated'),
        ('In Progress', 'In Progress'),
        ('Completed', 'Completed'),
        ('Cancelled', 'Cancelled'),
    ]
    
    case = models.ForeignKey(InsuranceCase, on_delete=models.CASCADE, related_name='allocations')
    investigator = models.ForeignKey(FieldInvestigator, on_delete=models.PROTECT, related_name='allocated_cases')
    
    allocation_type = models.CharField(max_length=100, help_text='Spot/Claimant/Police/etc')
    allocation_date = models.DateField()
    completion_date = models.DateField(null=True, blank=True)
    tat_days = models.IntegerField(null=True, blank=True)
    
    status = models.CharField(max_length=50, choices=STATUS_CHOICES, default='Allocated')
    allocation_remarks = models.TextField(blank=True)
    findings_remarks = models.TextField(blank=True)
    
    # Charges
    wages_charges = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    charges_status = models.CharField(max_length=50, blank=True)
    hardcopy_status = models.CharField(max_length=50, blank=True)
    
    # Metadata
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        db_table = 'case_allocation'
        indexes = [
            models.Index(fields=['case', 'investigator']),
            models.Index(fields=['allocation_date']),
            models.Index(fields=['status']),
        ]
        ordering = ['-allocation_date']
    
    def __str__(self):
        return f"{self.case.claim_number} -> {self.investigator.name}"


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
    extracted_data = models.JSONField(default=dict, blank=True, help_text='Structured data extracted from document')
    
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
