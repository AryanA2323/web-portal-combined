from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ('users', '0074_add_under_verification_to_full_case_status'),
    ]

    operations = [
        migrations.RunSQL(
            sql="""
            ALTER TABLE cases DROP CONSTRAINT IF EXISTS cases_full_case_status_check;
            ALTER TABLE cases ADD CONSTRAINT cases_full_case_status_check 
                CHECK (full_case_status IN (
                    'WIP', 'Pending CS', 'Completed', 'Closed', 'Open', 'IR-Writing', 'NI', 'Withdraw', 
                    'QC-1', 'Pending Additional Docs', 'Connected Pending', 'RCU Pending', 'Portal Upload',
                    'Not Initiated', 'Under Verification', 'Ready for Report', 'Report Generated', 'QA Verification'
                ));
            """,
            reverse_sql="""
            ALTER TABLE cases DROP CONSTRAINT IF EXISTS cases_full_case_status_check;
            ALTER TABLE cases ADD CONSTRAINT cases_full_case_status_check 
                CHECK (full_case_status IN (
                    'WIP', 'Pending CS', 'Completed', 'Closed', 'Open', 'IR-Writing', 'NI', 'Withdraw', 
                    'QC-1', 'Pending Additional Docs', 'Connected Pending', 'RCU Pending', 'Portal Upload',
                    'Not Initiated', 'Under Verification'
                ));
            """
        ),
    ]
