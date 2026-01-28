from django.contrib import admin
from django.contrib.auth.admin import UserAdmin
from .models import CustomUser, Vendor, AuthToken, EmailVerificationCode, PasswordResetToken


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
