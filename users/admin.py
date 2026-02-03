from django.contrib import admin
from django.contrib.auth.admin import UserAdmin
from .models import (
    CustomUser, Vendor, AuthToken, EmailVerificationCode, PasswordResetToken,
    EmailIntake, EmailAttachment, GmailOAuthToken,
    Client, InsuranceCase, CaseDocument
)


@admin.register(CustomUser)
class CustomUserAdmin(UserAdmin):
    """Custom admin configuration for the CustomUser model."""
    
    list_display = ('username', 'email', 'role', 'is_staff', 'is_2fa_enabled')
    list_filter = ('role', 'is_staff', 'is_superuser', 'is_active', 'is_2fa_enabled')
    search_fields = ('username', 'email', 'first_name', 'last_name')
    ordering = ('username',)
    
    # Extend the default fieldsets to include custom fields
    fieldsets = UserAdmin.fieldsets + (
        ('Custom Fields', {
            'fields': ('role', 'is_2fa_enabled'),
        }),
    )
    
    # Extend add_fieldsets for creating new users
    add_fieldsets = UserAdmin.add_fieldsets + (
        ('Custom Fields', {
            'fields': ('role', 'is_2fa_enabled'),
        }),
    )


@admin.register(Vendor)
class VendorAdmin(admin.ModelAdmin):
    """Admin configuration for Vendor model."""
    
    list_display = ('company_name', 'contact_email', 'contact_phone', 'is_active', 'created_at')
    list_filter = ('is_active', 'created_at')
    search_fields = ('company_name', 'contact_email')
    ordering = ('company_name',)
    readonly_fields = ('created_at', 'updated_at')


@admin.register(AuthToken)
class AuthTokenAdmin(admin.ModelAdmin):
    """Admin configuration for AuthToken model."""
    
    list_display = ('user', 'token_preview', 'created_at', 'expires_at', 'is_expired')
    list_filter = ('created_at',)
    search_fields = ('user__username', 'user__email')
    readonly_fields = ('token', 'created_at')
    
    def token_preview(self, obj):
        """Show only first 8 characters of token for security."""
        return f"{obj.token[:8]}..." if obj.token else ""
    token_preview.short_description = 'Token (preview)'


@admin.register(EmailVerificationCode)
class EmailVerificationCodeAdmin(admin.ModelAdmin):
    """Admin configuration for EmailVerificationCode model."""
    
    list_display = ('user', 'purpose', 'code', 'created_at', 'expires_at', 'is_used', 'is_valid_display')
    list_filter = ('purpose', 'is_used', 'created_at')
    search_fields = ('user__username', 'user__email', 'code')
    readonly_fields = ('created_at',)
    ordering = ('-created_at',)
    
    def is_valid_display(self, obj):
        """Display whether the code is currently valid."""
        return obj.is_valid
    is_valid_display.short_description = 'Valid'
    is_valid_display.boolean = True


@admin.register(PasswordResetToken)
class PasswordResetTokenAdmin(admin.ModelAdmin):
    """Admin configuration for PasswordResetToken model."""
    
    list_display = ('user', 'token_preview', 'created_at', 'expires_at', 'is_used', 'is_valid_display')
    list_filter = ('is_used', 'created_at')
    search_fields = ('user__username', 'user__email')
    readonly_fields = ('token', 'created_at')
    ordering = ('-created_at',)
    
    def token_preview(self, obj):
        """Show only first 16 characters of token for security."""
        return f"{obj.token[:16]}..." if obj.token else ""
    token_preview.short_description = 'Token (preview)'
    
    def is_valid_display(self, obj):
        """Display whether the token is currently valid."""
        return obj.is_valid
    is_valid_display.short_description = 'Valid'
    is_valid_display.boolean = True


# ============================================================================
# Gmail OAuth & Email Intake Admin
# ============================================================================

@admin.register(GmailOAuthToken)
class GmailOAuthTokenAdmin(admin.ModelAdmin):
    """Admin for Gmail OAuth tokens."""
    
    list_display = ('email_address', 'is_active', 'last_synced_at', 'created_at', 'expires_at')
    list_filter = ('is_active', 'created_at')
    search_fields = ('email_address',)
    readonly_fields = ('access_token', 'refresh_token', 'created_at', 'updated_at')
    ordering = ('-created_at',)


class EmailAttachmentInline(admin.TabularInline):
    """Inline for email attachments."""
    model = EmailAttachment
    extra = 0
    readonly_fields = ('filename', 'content_type', 'file_size', 'is_pdf', 'created_at')
    fields = ('filename', 'content_type', 'file_size', 'is_pdf', 'file_path')
    

@admin.register(EmailIntake)
class EmailIntakeAdmin(admin.ModelAdmin):
    """Admin for email intake."""
    
    list_display = ('subject_preview', 'sender_email', 'received_at', 'has_attachments', 'processing_status')
    list_filter = ('processing_status', 'has_attachments', 'received_at')
    search_fields = ('subject', 'sender_email', 'body_text')
    readonly_fields = ('message_id', 'thread_id', 'received_at', 'processed_at', 'created_at')
    ordering = ('-received_at',)
    inlines = [EmailAttachmentInline]
    
    fieldsets = (
        ('Email Information', {
            'fields': ('message_id', 'thread_id', 'subject', 'sender_email', 'sender_name')
        }),
        ('Recipients', {
            'fields': ('recipient_email', 'cc_emails', 'bcc_emails')
        }),
        ('Content', {
            'fields': ('body_text', 'body_html')
        }),
        ('Processing', {
            'fields': ('processing_status', 'processing_error', 'received_at', 'processed_at')
        }),
        ('Metadata', {
            'fields': ('has_attachments', 'created_at')
        }),
    )
    
    def subject_preview(self, obj):
        """Show truncated subject."""
        return obj.subject[:60] + '...' if len(obj.subject) > 60 else obj.subject
    subject_preview.short_description = 'Subject'


@admin.register(EmailAttachment)
class EmailAttachmentAdmin(admin.ModelAdmin):
    """Admin for email attachments."""
    
    list_display = ('filename', 'email_subject', 'content_type', 'file_size_display', 'is_pdf', 'created_at')
    list_filter = ('is_pdf', 'content_type', 'created_at')
    search_fields = ('filename', 'email__subject')
    readonly_fields = ('created_at',)
    ordering = ('-created_at',)
    
    def email_subject(self, obj):
        """Show associated email subject."""
        return obj.email.subject[:50] + '...' if len(obj.email.subject) > 50 else obj.email.subject
    email_subject.short_description = 'Email'
    
    def file_size_display(self, obj):
        """Show file size in human readable format."""
        if obj.file_size < 1024:
            return f"{obj.file_size} B"
        elif obj.file_size < 1024 * 1024:
            return f"{obj.file_size / 1024:.1f} KB"
        else:
            return f"{obj.file_size / (1024 * 1024):.1f} MB"
    file_size_display.short_description = 'Size'


# ============================================================================
# Insurance Case Management Admin
# ============================================================================

@admin.register(Client)
class ClientAdmin(admin.ModelAdmin):
    """Admin for insurance clients."""
    
    list_display = ('client_code', 'client_name', 'is_active', 'created_at')
    list_filter = ('is_active', 'created_at')
    search_fields = ('client_code', 'client_name')
    ordering = ('client_name',)
    readonly_fields = ('created_at', 'updated_at')
    
    fieldsets = (
        ('Client Information', {
            'fields': ('client_code', 'client_name', 'is_active')
        }),
        ('Pricing - Full Investigation', {
            'fields': ('full_case_connected_price', 'full_case_not_connected_price', 'full_case_cancelled_price')
        }),
        ('Pricing - Partial Investigation', {
            'fields': ('partial_case_connected_price', 'partial_case_not_connected_price', 'partial_case_cancelled_price')
        }),
        ('Pricing - Individual Items', {
            'fields': ('claimant_price', 'insured_price', 'driver_price', 'spot_price', 
                      'police_price', 'hospital_price', 'income_price')
        }),
        ('Metadata', {
            'fields': ('created_at', 'updated_at')
        }),
    )


class CaseDocumentInline(admin.TabularInline):
    """Inline for case documents."""
    model = CaseDocument
    extra = 0
    readonly_fields = ('uploaded_date', 'document_type', 'document_name')
    fields = ('document_type', 'document_name', 'uploaded_date')


@admin.register(InsuranceCase)
class InsuranceCaseAdmin(admin.ModelAdmin):
    """Admin for insurance cases."""
    
    list_display = ('claim_number', 'client_name', 'category', 'case_receipt_date', 
                   'full_case_status', 'investigation_report_status', 'tat_display')
    list_filter = ('category', 'full_case_status', 'investigation_report_status', 
                  'case_receipt_date', 'completion_date')
    search_fields = ('claim_number', 'client_name', 'crn', 'policy_number', 
                    'claimant_name', 'insured_name')
    readonly_fields = ('created_at', 'updated_at')
    ordering = ('-case_receipt_date',)
    inlines = [CaseDocumentInline]
    date_hierarchy = 'case_receipt_date'
    
    fieldsets = (
        ('Case Identification', {
            'fields': ('claim_number', 'client', 'client_name', 'category', 'crn', 'policy_number')
        }),
        ('Dates & TAT', {
            'fields': ('case_receipt_date', 'receipt_month', 'completion_date', 
                      'completion_month', 'case_due_date', 'tat', 'sla')
        }),
        ('Case Details', {
            'fields': ('case_type', 'investigation_report_status', 'full_case_status', 'scope_of_work')
        }),
        ('Claimant Information', {
            'fields': ('claimant_name', 'claimant_address', 'claimant_district', 'claimant_status')
        }),
        ('Income Details', {
            'fields': ('income_details', 'income_address', 'income_district', 'income_status'),
            'classes': ('collapse',)
        }),
        ('Insured Information', {
            'fields': ('insured_name', 'insured_address', 'insured_district', 
                      'insured_132_notice', 'insured_status')
        }),
        ('Driver Information', {
            'fields': ('driver_name', 'driver_address', 'driver_district', 'driver_status'),
            'classes': ('collapse',)
        }),
        ('Document Status', {
            'fields': ('dl_status', 'rc_status', 'permit_status', 'fitness_status'),
            'classes': ('collapse',)
        }),
        ('Spot Details', {
            'fields': ('spot_location', 'spot_district', 'spot_status'),
            'classes': ('collapse',)
        }),
        ('Police Details', {
            'fields': ('fir_number', 'police_station', 'police_district', 
                      'rti_status', 'chargesheet_status', 'police_status'),
            'classes': ('collapse',)
        }),
        ('Hospital Details', {
            'fields': ('hospital_name', 'hospital_address', 'hospital_district', 'hospital_status'),
            'classes': ('collapse',)
        }),
        ('Dispatch', {
            'fields': ('dispatch_date', 'dispatch_status'),
            'classes': ('collapse',)
        }),
        ('Notes & Source', {
            'fields': ('case_notes', 'source_email')
        }),
        ('Metadata', {
            'fields': ('created_at', 'updated_at'),
            'classes': ('collapse',)
        }),
    )
    
    def tat_display(self, obj):
        """Display TAT in human readable format."""
        return f"{obj.tat} days" if obj.tat else "N/A"
    tat_display.short_description = 'TAT'


@admin.register(CaseDocument)
class CaseDocumentAdmin(admin.ModelAdmin):
    """Admin for case documents."""
    
    list_display = ('document_name', 'case_claim_number', 'document_type', 'uploaded_date')
    list_filter = ('document_type', 'uploaded_date')
    search_fields = ('document_name', 'case__claim_number')
    readonly_fields = ('uploaded_date',)
    ordering = ('-uploaded_date',)
    
    def case_claim_number(self, obj):
        """Show claim number of associated case."""
        return obj.case.claim_number
    case_claim_number.short_description = 'Claim Number'
