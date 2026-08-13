from django.db import migrations, models
import django.db.models.deletion
from django.conf import settings

class Migration(migrations.Migration):

    dependencies = [
        ('users', '0058_tatchangerequest'),
    ]

    operations = [
        migrations.CreateModel(
            name='CaseDeletionRequest',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('case_id', models.CharField(db_index=True, max_length=255)),
                ('case_number', models.CharField(blank=True, max_length=255, null=True)),
                ('requested_at', models.DateTimeField(auto_now_add=True)),
                ('reason', models.TextField()),
                ('status', models.CharField(choices=[('PENDING', 'Pending'), ('APPROVED', 'Approved'), ('REJECTED', 'Rejected')], default='PENDING', max_length=20)),
                ('reviewed_at', models.DateTimeField(blank=True, null=True)),
                ('requested_by', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='deletion_requests_made', to=settings.AUTH_USER_MODEL)),
                ('reviewed_by', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='deletion_requests_reviewed', to=settings.AUTH_USER_MODEL)),
            ],
            options={
                'db_table': 'case_deletion_requests',
                'ordering': ['-requested_at'],
            },
        ),
    ]
