"""
Migration 0027: Add case_number column to raw SQL 'cases' table
and generate case numbers in the format <client-code>-<serial>-SS-<year>.
"""

from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ('users', '0026_rename_receipt_to_receive_date'),
    ]

    operations = [
        # Add case_number column to raw SQL cases table
        migrations.RunSQL(
            sql="""
            ALTER TABLE cases ADD COLUMN IF NOT EXISTS case_number VARCHAR(100);
            CREATE INDEX IF NOT EXISTS idx_cases_case_number ON cases (case_number);
            """,
            reverse_sql="""
            DROP INDEX IF EXISTS idx_cases_case_number;
            ALTER TABLE cases DROP COLUMN IF EXISTS case_number;
            """,
        ),
    ]
