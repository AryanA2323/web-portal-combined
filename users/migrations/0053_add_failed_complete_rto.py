from django.db import migrations

class Migration(migrations.Migration):

    dependencies = [
        ('users', '0052_add_advocate_chargesheet_columns'),
    ]

    operations = [
        migrations.RunSQL(
            sql="""
            ALTER TABLE rto_checks DROP CONSTRAINT IF EXISTS rto_checks_check_status_check;
            ALTER TABLE rto_checks ADD CONSTRAINT rto_checks_check_status_check 
            CHECK (check_status IN ('Not Initiated', 'WIP', 'Completed', 'Stop', 'Verified', 'Reassigned', 'Failed Complete', 'Failed Complete '));
            """,
            reverse_sql="""
            ALTER TABLE rto_checks DROP CONSTRAINT IF EXISTS rto_checks_check_status_check;
            ALTER TABLE rto_checks ADD CONSTRAINT rto_checks_check_status_check 
            CHECK (check_status IN ('Not Initiated', 'WIP', 'Completed', 'Stop', 'Verified', 'Reassigned'));
            """
        ),
    ]
