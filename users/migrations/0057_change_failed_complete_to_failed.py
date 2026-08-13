from django.db import migrations

class Migration(migrations.Migration):

    dependencies = [
        ('users', '0056_add_vendor_evidence_to_rti_rto'),
    ]

    operations = [
        migrations.RunSQL(
            sql="""
            ALTER TABLE rto_checks DROP CONSTRAINT IF EXISTS rto_checks_check_status_check;
            ALTER TABLE rto_checks ADD CONSTRAINT rto_checks_check_status_check 
            CHECK (check_status IN ('Not Initiated', 'WIP', 'Completed', 'Stop', 'Verified', 'Reassigned', 'Failed', 'Failed Complete', 'Failed Complete '));
            
            UPDATE rto_checks SET check_status = 'Failed' WHERE check_status IN ('Failed Complete', 'Failed Complete ');
            """,
            reverse_sql="""
            ALTER TABLE rto_checks DROP CONSTRAINT IF EXISTS rto_checks_check_status_check;
            ALTER TABLE rto_checks ADD CONSTRAINT rto_checks_check_status_check 
            CHECK (check_status IN ('Not Initiated', 'WIP', 'Completed', 'Stop', 'Verified', 'Reassigned', 'Failed Complete', 'Failed Complete '));
            
            UPDATE rto_checks SET check_status = 'Failed Complete' WHERE check_status = 'Failed';
            """
        ),
    ]
