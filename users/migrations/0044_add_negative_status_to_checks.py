# Generated automatically to fix missing negative_status and insured_cum_driver columns

from django.db import migrations

class Migration(migrations.Migration):

    dependencies = [
        ('users', '0043_fix_fir_date_columns'),
    ]

    operations = [
        migrations.RunSQL(
            sql="""
            ALTER TABLE claimant_checks ADD COLUMN IF NOT EXISTS negative_status TEXT NOT NULL DEFAULT '';
            ALTER TABLE spot_checks ADD COLUMN IF NOT EXISTS negative_status TEXT NOT NULL DEFAULT '';
            ALTER TABLE chargesheets ADD COLUMN IF NOT EXISTS negative_status TEXT NOT NULL DEFAULT '';

            ALTER TABLE insured_checks 
                ADD COLUMN IF NOT EXISTS negative_status TEXT NOT NULL DEFAULT '',
                ADD COLUMN IF NOT EXISTS insured_cum_driver BOOLEAN NOT NULL DEFAULT FALSE;

            ALTER TABLE driver_checks 
                ADD COLUMN IF NOT EXISTS negative_status TEXT NOT NULL DEFAULT '',
                ADD COLUMN IF NOT EXISTS insured_cum_driver BOOLEAN NOT NULL DEFAULT FALSE;
            """,
            reverse_sql="""
            ALTER TABLE claimant_checks DROP COLUMN IF EXISTS negative_status;
            ALTER TABLE spot_checks DROP COLUMN IF EXISTS negative_status;
            ALTER TABLE chargesheets DROP COLUMN IF EXISTS negative_status;

            ALTER TABLE insured_checks 
                DROP COLUMN IF EXISTS negative_status,
                DROP COLUMN IF EXISTS insured_cum_driver;

            ALTER TABLE driver_checks 
                DROP COLUMN IF EXISTS negative_status,
                DROP COLUMN IF EXISTS insured_cum_driver;
            """,
        ),
    ]
