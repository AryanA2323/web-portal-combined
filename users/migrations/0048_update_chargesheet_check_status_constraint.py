# Migration to drop check_status constraint on chargesheets table so custom status values (Applied for CS, CS Recieved to adv, Dispatched, not found) are allowed.

from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ('users', '0047_add_chargesheet_fields'),
    ]

    operations = [
        migrations.RunSQL(
            sql="""
            ALTER TABLE chargesheets DROP CONSTRAINT IF EXISTS chargesheets_check_status_check;
            """,
            reverse_sql="""
            ALTER TABLE chargesheets ADD CONSTRAINT chargesheets_check_status_check CHECK (check_status IN ('Not Initiated', 'WIP', 'Completed', 'Stop', 'Verified', 'Reassigned'));
            """,
        ),
    ]
