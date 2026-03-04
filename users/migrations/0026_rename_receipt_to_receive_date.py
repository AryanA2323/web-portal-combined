"""
Migration 0026: Rename case_receipt_date → case_receive_date AND
receipt_month → receive_month in raw SQL tables and Django ORM models,
update SLA choice label from 'Achieved TAT' to 'Above TAT'.
"""

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('users', '0025_add_rti_rto_verification_types'),
    ]

    operations = [
        # ── 1. Rename column in raw SQL 'cases' table ────────────────────────
        migrations.RunSQL(
            sql="""
            ALTER TABLE cases RENAME COLUMN case_receipt_date TO case_receive_date;
            DROP INDEX IF EXISTS idx_cases_receipt_date;
            CREATE INDEX IF NOT EXISTS idx_cases_receive_date ON cases (case_receive_date);
            """,
            reverse_sql="""
            ALTER TABLE cases RENAME COLUMN case_receive_date TO case_receipt_date;
            DROP INDEX IF EXISTS idx_cases_receive_date;
            CREATE INDEX IF NOT EXISTS idx_cases_receipt_date ON cases (case_receipt_date);
            """,
        ),

        # ── 2. Rename receipt_month column in raw SQL 'cases' table ──────────
        migrations.RunSQL(
            sql="ALTER TABLE cases RENAME COLUMN receipt_month TO receive_month;",
            reverse_sql="ALTER TABLE cases RENAME COLUMN receive_month TO receipt_month;",
        ),

        # ── 3. Rename columns in Django ORM InsuranceCase (insurance_case table) ──
        migrations.RenameField(
            model_name='insurancecase',
            old_name='case_receipt_date',
            new_name='case_receive_date',
        ),
        migrations.RenameField(
            model_name='insurancecase',
            old_name='receipt_month',
            new_name='receive_month',
        ),

        # ── 4. Update SLA choices on InsuranceCase model ─────────────────
        migrations.AlterField(
            model_name='insurancecase',
            name='sla_status',
            field=models.CharField(
                blank=True,
                choices=[('AT', 'AT (Above TAT)'), ('WT', 'WT (Within TAT)')],
                help_text='SLA status - AT or WT',
                max_length=10,
            ),
        ),
    ]
