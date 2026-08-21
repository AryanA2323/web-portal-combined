from django.db import migrations

class Migration(migrations.Migration):

    dependencies = [
        ('users', '0064_add_device_name_to_authtoken'),
    ]

    operations = [
        migrations.DeleteModel(
            name='TatChangeRequest',
        ),
    ]
