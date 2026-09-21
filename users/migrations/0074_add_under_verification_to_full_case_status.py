from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ('users', '0073_add_claimant_income_per_annum_and_month'),
    ]

    operations = [
        migrations.RunSQL(
            sql="""
            ALTER TABLE cases DROP CONSTRAINT IF EXISTS cases_full_case_status_check;
            ALTER TABLE cases ADD CONSTRAINT cases_full_case_status_check 
                CHECK (full_case_status IN (
                    'WIP', 'Pending CS', 'Completed', 'Closed', 'Open', 'IR-Writing', 'NI', 'Withdraw', 
                    'QC-1', 'Pending Additional Docs', 'Connected Pending', 'RCU Pending', 'Portal Upload',
                    'Not Initiated', 'Under Verification'
                ));
            """,
            reverse_sql="""
            ALTER TABLE cases DROP CONSTRAINT IF EXISTS cases_full_case_status_check;
            ALTER TABLE cases ADD CONSTRAINT cases_full_case_status_check 
                CHECK (full_case_status IN (
                    'WIP', 'Pending CS', 'Completed', 'Closed', 'Open', 'IR-Writing', 'NI', 'Withdraw', 
                    'QC-1', 'Pending Additional Docs', 'Connected Pending', 'RCU Pending', 'Portal Upload',
                    'Not Initiated'
                ));
            """
        ),
    ]
