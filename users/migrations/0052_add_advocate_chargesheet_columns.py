# Migration to add advocate-specific columns to chargesheets table

from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ('users', '0051_drop_check_status_constraints'),
    ]

    operations = [
        migrations.RunSQL(
            sql="""
            ALTER TABLE chargesheets
                ADD COLUMN IF NOT EXISTS applied_cs_photos JSONB DEFAULT '[]',
                ADD COLUMN IF NOT EXISTS dispatched_photos JSONB DEFAULT '[]',
                ADD COLUMN IF NOT EXISTS advocate_remark TEXT NOT NULL DEFAULT '',
                ADD COLUMN IF NOT EXISTS fir_date DATE,
                ADD COLUMN IF NOT EXISTS reason_if_delayed TEXT NOT NULL DEFAULT '';
            """,
            reverse_sql="""
            ALTER TABLE chargesheets
                DROP COLUMN IF EXISTS applied_cs_photos,
                DROP COLUMN IF EXISTS dispatched_photos,
                DROP COLUMN IF EXISTS advocate_remark,
                DROP COLUMN IF EXISTS fir_date,
                DROP COLUMN IF EXISTS reason_if_delayed;
            """,
        ),
    ]
