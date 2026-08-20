from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('users', '0063_client_updates'),
    ]

    operations = [
        migrations.AddField(
            model_name='authtoken',
            name='device_name',
            field=models.CharField(
                blank=True,
                default='',
                help_text='Human-readable device name, e.g. "Chrome on Windows 10"',
                max_length=128,
            ),
        ),
    ]
