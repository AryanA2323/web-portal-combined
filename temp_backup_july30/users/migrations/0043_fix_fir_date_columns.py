# Migration to fix fir_date and reason_if_delayed columns

from django.db import migrations

class Migration(migrations.Migration):

    dependencies = [
        ('users', '0042_alter_customuser_role_alter_vendor_user'),
    ]

    operations = [
        migrations.RunSQL(
            sql="""
            ALTER TABLE chargesheets
            ADD COLUMN IF NOT EXISTS fir_date DATE,
            ADD COLUMN IF NOT EXISTS reason_if_delayed TEXT NOT NULL DEFAULT '';
            """,
            reverse_sql="""
            ALTER TABLE chargesheets
            DROP COLUMN IF EXISTS fir_date,
            DROP COLUMN IF EXISTS reason_if_delayed;
            """,
        ),
        migrations.RunSQL(
            sql="""
            ALTER TABLE claimant_checks
            DROP COLUMN IF EXISTS fir_date,
            DROP COLUMN IF EXISTS reason_if_delayed;
            """,
            reverse_sql="""
            ALTER TABLE claimant_checks
            ADD COLUMN IF NOT EXISTS fir_date DATE,
            ADD COLUMN IF NOT EXISTS reason_if_delayed TEXT NOT NULL DEFAULT '';
            """,
        ),
    ]
