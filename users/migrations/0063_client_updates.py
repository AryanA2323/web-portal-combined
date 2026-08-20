from django.db import migrations, models

class Migration(migrations.Migration):

    dependencies = [
        ('users', '0062_merge_20260819_1459'),
    ]

    operations = [
        migrations.AddField(
            model_name='client',
            name='corporate_address',
            field=models.TextField(blank=True),
        ),
        migrations.AddField(
            model_name='client',
            name='gst_no',
            field=models.CharField(blank=True, max_length=50),
        ),
        migrations.AddField(
            model_name='client',
            name='pan_no',
            field=models.CharField(blank=True, max_length=20),
        ),
        migrations.AddField(
            model_name='client',
            name='agreement_copy',
            field=models.FileField(blank=True, null=True, upload_to='client_agreements/'),
        ),
        migrations.AddField(
            model_name='client',
            name='scope_of_work',
            field=models.JSONField(blank=True, default=list),
        ),
    ]
