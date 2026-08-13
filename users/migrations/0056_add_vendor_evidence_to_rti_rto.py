from django.db import migrations

class Migration(migrations.Migration):

    dependencies = [
        ('users', '0055_add_special_instructions_cases'),
    ]

    operations = [
        migrations.RunSQL(
            sql="""
            ALTER TABLE rto_checks ADD COLUMN IF NOT EXISTS vendor_evidence JSONB DEFAULT '[]'::jsonb;
            ALTER TABLE rti_checks ADD COLUMN IF NOT EXISTS vendor_evidence JSONB DEFAULT '[]'::jsonb;
            """,
            reverse_sql="""
            ALTER TABLE rto_checks DROP COLUMN IF EXISTS vendor_evidence;
            ALTER TABLE rti_checks DROP COLUMN IF EXISTS vendor_evidence;
            """
        )
    ]
