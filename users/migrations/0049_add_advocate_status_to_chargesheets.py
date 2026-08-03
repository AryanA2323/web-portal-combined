from django.db import migrations

class Migration(migrations.Migration):

    dependencies = [
        ('users', '0048_update_chargesheet_check_status_constraint'),
    ]

    operations = [
        migrations.RunSQL(
            sql="""
            ALTER TABLE chargesheets ADD COLUMN IF NOT EXISTS advocate_status VARCHAR(100) NOT NULL DEFAULT '';
            """,
            reverse_sql="""
            ALTER TABLE chargesheets DROP COLUMN IF EXISTS advocate_status;
            """
        ),
    ]
