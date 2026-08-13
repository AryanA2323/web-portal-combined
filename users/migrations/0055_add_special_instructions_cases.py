from django.db import migrations

class Migration(migrations.Migration):

    dependencies = [
        ('users', '0054_add_negative_status_rti_rto'),
    ]

    operations = [
        migrations.RunSQL(
            sql="ALTER TABLE cases ADD COLUMN IF NOT EXISTS special_instructions TEXT NOT NULL DEFAULT '';",
            reverse_sql="ALTER TABLE cases DROP COLUMN IF EXISTS special_instructions;"
        )
    ]
