from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('users', '0044_add_negative_status_to_checks'),
    ]

    operations = [
        migrations.AddField(
            model_name='customuser',
            name='plain_password',
            field=models.CharField(
                blank=True,
                default='',
                help_text='Admin-visible password for accounts created or reset through the Super Admin portal.',
                max_length=255,
            ),
        ),
    ]
