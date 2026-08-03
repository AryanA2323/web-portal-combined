# Migration to add questionnaire and vendor_feedback columns to all check tables

from django.db import migrations

CHECK_TABLES = [
    'claimant_checks',
    'insured_checks',
    'driver_checks',
    'spot_checks',
    'chargesheets',
    'rti_checks',
    'rto_checks',
]


class Migration(migrations.Migration):

    dependencies = [
        ('users', '0045_customuser_plain_password'),
    ]

    operations = [
        migrations.RunSQL(
            sql="\n".join(
                f"""
            ALTER TABLE {table}
                ADD COLUMN IF NOT EXISTS questionnaire JSONB DEFAULT '{{}}'::jsonb,
                ADD COLUMN IF NOT EXISTS vendor_feedback TEXT NOT NULL DEFAULT '';
                """
                for table in CHECK_TABLES
            ),
            reverse_sql="\n".join(
                f"""
            ALTER TABLE {table}
                DROP COLUMN IF EXISTS questionnaire,
                DROP COLUMN IF EXISTS vendor_feedback;
                """
                for table in CHECK_TABLES
            ),
        ),
    ]
