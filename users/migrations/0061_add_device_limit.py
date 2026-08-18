from django.db import migrations, models

class Migration(migrations.Migration):

    dependencies = [
        ('users', '0060_add_session_tracking_and_activity_log'),
    ]

    operations = [
        migrations.AddField(
            model_name='customuser',
            name='device_limit',
            field=models.IntegerField(default=1, help_text='Maximum number of simultaneous active devices/sessions allowed.'),
        ),
    ]
