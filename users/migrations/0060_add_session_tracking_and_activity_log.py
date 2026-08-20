"""
Add session tracking fields to AuthToken and create ActivityLog model.
"""

from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('users', '0048_update_chargesheet_check_status_constraint'),
    ]

    operations = [
        # Add session tracking fields to AuthToken
        migrations.AddField(
            model_name='authtoken',
            name='ip_address',
            field=models.CharField(
                blank=True, default='', max_length=45,
                help_text='IP address from which the token was created',
            ),
        ),
        migrations.AddField(
            model_name='authtoken',
            name='device_info',
            field=models.CharField(
                blank=True, default='', max_length=512,
                help_text='User-Agent / device description',
            ),
        ),
        migrations.AddField(
            model_name='authtoken',
            name='is_active',
            field=models.BooleanField(
                default=True,
                help_text='Whether this token session is still active',
            ),
        ),
        migrations.AddIndex(
            model_name='authtoken',
            index=models.Index(fields=['user', 'is_active'], name='users_autht_user_id_active_idx'),
        ),

        # Create ActivityLog model
        migrations.CreateModel(
            name='ActivityLog',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('action', models.CharField(
                    choices=[
                        ('PROFILE_UPDATE', 'Profile Update'),
                        ('PASSWORD_CHANGE', 'Password Change'),
                        ('LOGIN', 'Login'),
                        ('LOGOUT', 'Logout'),
                        ('FORCE_LOGOUT', 'Force Logout'),
                    ],
                    max_length=30,
                )),
                ('details', models.TextField(blank=True, default='', help_text='Human-readable description of the change')),
                ('ip_address', models.CharField(blank=True, default='', max_length=45)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('user', models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='activity_logs',
                    to=settings.AUTH_USER_MODEL,
                )),
            ],
            options={
                'ordering': ['-created_at'],
            },
        ),
        migrations.AddIndex(
            model_name='activitylog',
            index=models.Index(fields=['user', '-created_at'], name='users_activ_user_id_created_idx'),
        ),
        migrations.AddIndex(
            model_name='activitylog',
            index=models.Index(fields=['action'], name='users_activ_action_idx'),
        ),
    ]
