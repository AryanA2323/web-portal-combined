# Migration to ensure admin_feedback and is_reassigned columns exist on all check tables
# These columns were added ad-hoc to the local database but never had a proper migration.

from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ('users', '0067_add_cs_received_photos_to_chargesheets'),
    ]

    operations = [
        migrations.RunSQL(
            sql="""
            ALTER TABLE claimant_checks ADD COLUMN IF NOT EXISTS admin_feedback TEXT NOT NULL DEFAULT '';
            ALTER TABLE claimant_checks ADD COLUMN IF NOT EXISTS is_reassigned BOOLEAN NOT NULL DEFAULT FALSE;

            ALTER TABLE insured_checks ADD COLUMN IF NOT EXISTS admin_feedback TEXT NOT NULL DEFAULT '';
            ALTER TABLE insured_checks ADD COLUMN IF NOT EXISTS is_reassigned BOOLEAN NOT NULL DEFAULT FALSE;

            ALTER TABLE driver_checks ADD COLUMN IF NOT EXISTS admin_feedback TEXT NOT NULL DEFAULT '';
            ALTER TABLE driver_checks ADD COLUMN IF NOT EXISTS is_reassigned BOOLEAN NOT NULL DEFAULT FALSE;

            ALTER TABLE spot_checks ADD COLUMN IF NOT EXISTS admin_feedback TEXT NOT NULL DEFAULT '';
            ALTER TABLE spot_checks ADD COLUMN IF NOT EXISTS is_reassigned BOOLEAN NOT NULL DEFAULT FALSE;

            ALTER TABLE chargesheets ADD COLUMN IF NOT EXISTS admin_feedback TEXT NOT NULL DEFAULT '';
            ALTER TABLE chargesheets ADD COLUMN IF NOT EXISTS is_reassigned BOOLEAN NOT NULL DEFAULT FALSE;

            ALTER TABLE rti_checks ADD COLUMN IF NOT EXISTS admin_feedback TEXT NOT NULL DEFAULT '';
            ALTER TABLE rti_checks ADD COLUMN IF NOT EXISTS is_reassigned BOOLEAN NOT NULL DEFAULT FALSE;

            ALTER TABLE rto_checks ADD COLUMN IF NOT EXISTS admin_feedback TEXT NOT NULL DEFAULT '';
            ALTER TABLE rto_checks ADD COLUMN IF NOT EXISTS is_reassigned BOOLEAN NOT NULL DEFAULT FALSE;
            """,
            reverse_sql="""
            -- No reverse needed; these columns should persist.
            """
        ),
    ]
