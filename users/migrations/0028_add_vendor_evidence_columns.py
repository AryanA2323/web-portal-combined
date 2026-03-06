"""
Migration 0028: Add vendor_evidence JSONB column to check tables
for storing vendor-uploaded evidence metadata.
"""

from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ('users', '0027_add_case_number_to_cases_table'),
    ]

    operations = [
        migrations.RunSQL(
            sql="""
            ALTER TABLE claimant_checks ADD COLUMN IF NOT EXISTS vendor_evidence JSONB DEFAULT '[]'::jsonb;
            ALTER TABLE insured_checks ADD COLUMN IF NOT EXISTS vendor_evidence JSONB DEFAULT '[]'::jsonb;
            ALTER TABLE driver_checks ADD COLUMN IF NOT EXISTS vendor_evidence JSONB DEFAULT '[]'::jsonb;
            ALTER TABLE spot_checks ADD COLUMN IF NOT EXISTS vendor_evidence JSONB DEFAULT '[]'::jsonb;
            ALTER TABLE chargesheets ADD COLUMN IF NOT EXISTS vendor_evidence JSONB DEFAULT '[]'::jsonb;
            """,
            reverse_sql="""
            ALTER TABLE claimant_checks DROP COLUMN IF EXISTS vendor_evidence;
            ALTER TABLE insured_checks DROP COLUMN IF EXISTS vendor_evidence;
            ALTER TABLE driver_checks DROP COLUMN IF EXISTS vendor_evidence;
            ALTER TABLE spot_checks DROP COLUMN IF EXISTS vendor_evidence;
            ALTER TABLE chargesheets DROP COLUMN IF EXISTS vendor_evidence;
            """,
        ),
    ]
