from django.contrib import admin
from django.contrib.auth.admin import UserAdmin
from .models import (
    CustomUser, Vendor, AuthToken, EmailVerificationCode, PasswordResetToken,
    EmailIntake, EmailAttachment, GmailOAuthToken,
    Client, InsuranceCase, CaseDocument,
    CaseVerification, VerificationDocument, VerificationComment, ClaimantDependent
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
    
    list_display = ('case_number', 'title', 'claim_number', 'status', 'category', 
                   'priority', 'created_at')
    list_filter = ('status', 'category', 'priority', 'source', 'workflow_type', 'created_at')
    search_fields = ('case_number', 'title', 'claim_number', 'client_code', 
                    'claimant_name', 'insured_name', 'description')
    readonly_fields = ('created_at', 'updated_at', 'resolved_at', 'closed_at')
    ordering = ('-created_at',)
    date_hierarchy = 'created_at'
    
    fieldsets = (
        ('Basic Information', {
            'fields': ('case_number', 'title', 'description', 'category', 'priority', 'status')
        }),
        ('Claim Information', {
            'fields': ('claim_number', 'client_code', 'client')
        }),
        ('People Information', {
            'fields': ('insured_name', 'claimant_name')
        }),
        ('Incident Location', {
            'fields': ('incident_address', 'incident_city', 'incident_state', 
                      'incident_postal_code', 'incident_country', 'latitude', 
                      'longitude', 'formatted_address')
        }),
        ('Assignment', {
            'fields': ('created_by', 'vendor')
        }),
        ('Workflow Information', {
            'fields': ('source', 'workflow_type', 'investigation_progress')
        }),
        ('Verification Checklist', {
            'fields': ('chk_spot', 'chk_hospital', 'chk_claimant', 'chk_insured',
                      'chk_witness', 'chk_driver', 'chk_dl', 'chk_rc', 'chk_permit',
                      'chk_court', 'chk_notice', 'chk_134_notice', 'chk_rti',
                      'chk_medical_verification', 'chk_income'),
            'classes': ('collapse',)
        }),
        ('Dates', {
            'fields': ('created_at', 'updated_at', 'resolved_at', 'closed_at'),
            'classes': ('collapse',)
        }),
        ('Legacy', {
            'fields': ('source_email',),
            'classes': ('collapse',)
        }),
    )
    
    def get_queryset(self, request):
        qs = super().get_queryset(request)
        return qs.select_related('client', 'vendor', 'created_by', 'source_email')


@admin.register(CaseDocument)
class CaseDocumentAdmin(admin.ModelAdmin):
    """Admin for case documents."""
    
    list_display = ('document_name', 'case_number_display', 'document_type', 'uploaded_date')
    list_filter = ('document_type', 'uploaded_date')
    search_fields = ('document_name', 'case__case_number', 'case__claim_number')
    readonly_fields = ('uploaded_date',)
    ordering = ('-uploaded_date',)
    
    def case_number_display(self, obj):
        """Show case number of associated case."""
        return obj.case.case_number if obj.case else 'N/A'
    case_number_display.short_description = 'Case Number'


@admin.register(CaseVerification)
class CaseVerificationAdmin(admin.ModelAdmin):
    """Admin for case verifications."""
    
    list_display = ('id', 'case_number_display', 'verification_type', 'status', 'priority', 'created_at')
    list_filter = ('verification_type', 'status', 'priority', 'created_at')
    search_fields = ('case__case_number', 'case__claim_number', 'claimant_name', 'insured_name', 'driver_name')
    readonly_fields = ('created_at', 'updated_at', 'assigned_at', 'started_at', 'completed_at', 'verified_at')
    ordering = ('-created_at',)
    
    fieldsets = (
        ('Basic Information', {
            'fields': ('case', 'verification_type', 'status', 'priority')
        }),
        ('Assignment', {
            'fields': ('assigned_to', 'verified_by', 'assigned_at', 'started_at', 'completed_at', 'verified_at')
        }),
        ('Claimant Details', {
            'fields': ('claimant_name', 'claimant_contact', 'claimant_address', 'income', 'fir_number_claimant', 'court_name', 'mv_act'),
            'classes': ('collapse',)
        }),
        ('Insured Details', {
            'fields': ('insured_name', 'insured_contact', 'insured_address', 'policy_number', 'policy_period', 'rc_number', 'permit_insured'),
            'classes': ('collapse',)
        }),
        ('Driver Details', {
            'fields': ('driver_name', 'driver_contact', 'driver_address', 'dl_number', 'permit_driver', 'occupation', 'driver_and_insured_same'),
            'classes': ('collapse',)
        }),
        ('Spot Details', {
            'fields': ('time_of_accident', 'place_of_accident', 'district', 'fir_number_spot', 'police_station', 'accident_brief'),
            'classes': ('collapse',)
        }),
        ('Chargesheet Details', {
            'fields': ('fir_delay_in_days', 'bsn_sections', 'ipc_sections'),
            'classes': ('collapse',)
        }),
        ('Additional Information', {
            'fields': ('check_status', 'statement', 'observations', 'findings', 'notes'),
            'classes': ('collapse',)
        }),
        ('Timestamps', {
            'fields': ('created_at', 'updated_at'),
            'classes': ('collapse',)
        }),
    )
    
    def case_number_display(self, obj):
        """Show case number."""
        return obj.case.case_number if obj.case else 'N/A'
    case_number_display.short_description = 'Case Number'


@admin.register(VerificationDocument)
class VerificationDocumentAdmin(admin.ModelAdmin):
    """Admin for verification documents."""
    
    list_display = ('file_name', 'verification_display', 'document_type', 'file_size_display', 'uploaded_at', 'is_verified')
    list_filter = ('document_type', 'is_verified', 'is_primary', 'uploaded_at')
    search_fields = ('file_name', 'title', 'verification__case__case_number')
    readonly_fields = ('uploaded_at', 'file_size', 'mime_type')
    ordering = ('-uploaded_at',)
    
    def verification_display(self, obj):
        """Show verification info."""
        return f"{obj.verification.case.case_number} - {obj.verification.get_verification_type_display()}"
    verification_display.short_description = 'Verification'
    
    def file_size_display(self, obj):
        """Show file size in human readable format."""
        size_kb = obj.file_size / 1024
        if size_kb > 1024:
            return f"{size_kb/1024:.2f} MB"
        return f"{size_kb:.2f} KB"
    file_size_display.short_description = 'File Size'


@admin.register(VerificationComment)
class VerificationCommentAdmin(admin.ModelAdmin):
    """Admin for verification comments."""
    
    list_display = ('verification_display', 'comment_preview', 'created_by', 'is_internal', 'created_at')
    list_filter = ('is_internal', 'created_at')
    search_fields = ('comment', 'verification__case__case_number')
    readonly_fields = ('created_at', 'updated_at')
    ordering = ('-created_at',)
    
    def verification_display(self, obj):
        """Show verification info."""
        return f"{obj.verification.case.case_number} - {obj.verification.get_verification_type_display()}"
    verification_display.short_description = 'Verification'
    
    def comment_preview(self, obj):
        """Show comment preview."""
        return obj.comment[:50] + '...' if len(obj.comment) > 50 else obj.comment
    comment_preview.short_description = 'Comment'


@admin.register(ClaimantDependent)
class ClaimantDependentAdmin(admin.ModelAdmin):
    """Admin for claimant dependents."""
    
    list_display = ('dependent_name', 'case_number_display', 'relationship', 'age', 'created_at')
    list_filter = ('relationship', 'created_at')
    search_fields = ('dependent_name', 'case__case_number', 'case__claim_number')
    readonly_fields = ('created_at', 'updated_at')
    ordering = ('-created_at',)
    
    def case_number_display(self, obj):
        """Show case number."""
        return obj.case.case_number if obj.case else 'N/A'
    case_number_display.short_description = 'Case Number'
