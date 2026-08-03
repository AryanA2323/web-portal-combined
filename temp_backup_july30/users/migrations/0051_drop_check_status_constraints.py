# Migration to drop check_status constraints on ALL check tables so
# 'Verified' and 'Reassigned' statuses are allowed for review accept/reject.

from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ('users', '0050_merge_20260730_0556'),
    ]

    operations = [
        migrations.RunSQL(
            sql="""
            ALTER TABLE claimant_checks DROP CONSTRAINT IF EXISTS claimant_checks_check_status_check;
            ALTER TABLE insured_checks  DROP CONSTRAINT IF EXISTS insured_checks_check_status_check;
            ALTER TABLE driver_checks   DROP CONSTRAINT IF EXISTS driver_checks_check_status_check;
            ALTER TABLE spot_checks     DROP CONSTRAINT IF EXISTS spot_checks_check_status_check;
            ALTER TABLE rti_checks      DROP CONSTRAINT IF EXISTS rti_checks_check_status_check;
            ALTER TABLE rto_checks      DROP CONSTRAINT IF EXISTS rto_checks_check_status_check;
            """,
            reverse_sql="""
            ALTER TABLE claimant_checks ADD CONSTRAINT claimant_checks_check_status_check CHECK (check_status IN ('Not Initiated', 'WIP', 'Completed', 'Stop', 'Verified', 'Reassigned'));
            ALTER TABLE insured_checks  ADD CONSTRAINT insured_checks_check_status_check  CHECK (check_status IN ('Not Initiated', 'WIP', 'Completed', 'Stop', 'Verified', 'Reassigned'));
            ALTER TABLE driver_checks   ADD CONSTRAINT driver_checks_check_status_check   CHECK (check_status IN ('Not Initiated', 'WIP', 'Completed', 'Stop', 'Verified', 'Reassigned'));
            ALTER TABLE spot_checks     ADD CONSTRAINT spot_checks_check_status_check     CHECK (check_status IN ('Not Initiated', 'WIP', 'Completed', 'Stop', 'Verified', 'Reassigned'));
            ALTER TABLE rti_checks      ADD CONSTRAINT rti_checks_check_status_check      CHECK (check_status IN ('Not Initiated', 'WIP', 'Completed', 'Stop', 'Verified', 'Reassigned'));
            ALTER TABLE rto_checks      ADD CONSTRAINT rto_checks_check_status_check      CHECK (check_status IN ('Not Initiated', 'WIP', 'Completed', 'Stop', 'Verified', 'Reassigned'));
            """,
        ),
    ]
