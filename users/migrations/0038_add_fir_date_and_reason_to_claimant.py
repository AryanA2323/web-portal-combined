# Migration to add fir_date and reason_if_delayed columns to claimant_checks

from django.db import migrations

class Migration(migrations.Migration):

    dependencies = [
        ('users', '0037_delete_notification'),
    ]

    operations = [
        migrations.RunSQL(
            sql="""
            ALTER TABLE claimant_checks
            ADD COLUMN IF NOT EXISTS fir_date DATE,
            ADD COLUMN IF NOT EXISTS reason_if_delayed TEXT NOT NULL DEFAULT '';
            """,
            reverse_sql="""
            ALTER TABLE claimant_checks
            DROP COLUMN IF EXISTS fir_date,
            DROP COLUMN IF EXISTS reason_if_delayed;
            """,
        ),
    ]
