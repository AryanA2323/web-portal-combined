# Generated migration to remove old verification fields

from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ('users', '0018_add_verification_specific_fields'),
    ]

    operations = [
        # Remove old unused columns that don't exist in the model
        migrations.RunSQL(
            sql="""
                ALTER TABLE case_verification DROP COLUMN IF EXISTS title CASCADE;
                ALTER TABLE case_verification DROP COLUMN IF EXISTS description CASCADE;
                ALTER TABLE case_verification DROP COLUMN IF EXISTS location_address CASCADE;
                ALTER TABLE case_verification DROP COLUMN IF EXISTS latitude CASCADE;
                ALTER TABLE case_verification DROP COLUMN IF EXISTS longitude CASCADE;
                ALTER TABLE case_verification DROP COLUMN IF EXISTS person_name CASCADE;
                ALTER TABLE case_verification DROP COLUMN IF EXISTS person_phone CASCADE;
                ALTER TABLE case_verification DROP COLUMN IF EXISTS person_email CASCADE;
                ALTER TABLE case_verification DROP COLUMN IF EXISTS person_address CASCADE;
                ALTER TABLE case_verification DROP COLUMN IF EXISTS identification_number CASCADE;
                ALTER TABLE case_verification DROP COLUMN IF EXISTS document_type CASCADE;
                ALTER TABLE case_verification DROP COLUMN IF EXISTS document_number CASCADE;
                ALTER TABLE case_verification DROP COLUMN IF EXISTS document_verified CASCADE;
            """,
            reverse_sql=migrations.RunSQL.noop  # Cannot reverse this easily
        ),
    ]
