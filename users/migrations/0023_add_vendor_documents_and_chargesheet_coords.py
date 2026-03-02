# Migration to:
# 1. Add vendor_documents JSONB column to all 5 check tables
# 2. Rename documents -> case_documents on all 5 tables for clarity
# 3. Add lat/lng to chargesheets (court location geocoding)

from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ('users', '0022_create_raw_case_tables'),
    ]

    operations = [
        # =====================================================================
        # Rename documents -> case_documents  +  Add vendor_documents
        # =====================================================================
        migrations.RunSQL(
            sql="""
            -- claimant_checks
            ALTER TABLE claimant_checks RENAME COLUMN documents TO case_documents;
            ALTER TABLE claimant_checks ADD COLUMN vendor_documents JSONB NOT NULL DEFAULT '[]'::jsonb;

            -- insured_checks
            ALTER TABLE insured_checks RENAME COLUMN documents TO case_documents;
            ALTER TABLE insured_checks ADD COLUMN vendor_documents JSONB NOT NULL DEFAULT '[]'::jsonb;

            -- driver_checks
            ALTER TABLE driver_checks RENAME COLUMN documents TO case_documents;
            ALTER TABLE driver_checks ADD COLUMN vendor_documents JSONB NOT NULL DEFAULT '[]'::jsonb;

            -- spot_checks
            ALTER TABLE spot_checks RENAME COLUMN documents TO case_documents;
            ALTER TABLE spot_checks ADD COLUMN vendor_documents JSONB NOT NULL DEFAULT '[]'::jsonb;

            -- chargesheets
            ALTER TABLE chargesheets RENAME COLUMN documents TO case_documents;
            ALTER TABLE chargesheets ADD COLUMN vendor_documents JSONB NOT NULL DEFAULT '[]'::jsonb;

            -- Add coordinates to chargesheets (court/city location)
            ALTER TABLE chargesheets ADD COLUMN chargesheet_lat DOUBLE PRECISION;
            ALTER TABLE chargesheets ADD COLUMN chargesheet_lng DOUBLE PRECISION;
            """,
            reverse_sql="""
            ALTER TABLE claimant_checks RENAME COLUMN case_documents TO documents;
            ALTER TABLE claimant_checks DROP COLUMN IF EXISTS vendor_documents;

            ALTER TABLE insured_checks RENAME COLUMN case_documents TO documents;
            ALTER TABLE insured_checks DROP COLUMN IF EXISTS vendor_documents;

            ALTER TABLE driver_checks RENAME COLUMN case_documents TO documents;
            ALTER TABLE driver_checks DROP COLUMN IF EXISTS vendor_documents;

            ALTER TABLE spot_checks RENAME COLUMN case_documents TO documents;
            ALTER TABLE spot_checks DROP COLUMN IF EXISTS vendor_documents;

            ALTER TABLE chargesheets RENAME COLUMN case_documents TO documents;
            ALTER TABLE chargesheets DROP COLUMN IF EXISTS vendor_documents;
            ALTER TABLE chargesheets DROP COLUMN IF EXISTS chargesheet_lat;
            ALTER TABLE chargesheets DROP COLUMN IF EXISTS chargesheet_lng;
            """,
        ),
    ]
