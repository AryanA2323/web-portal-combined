from django.db import migrations

class Migration(migrations.Migration):

    dependencies = [
        ('users', '0053_add_failed_complete_rto'),
    ]

    operations = [
        migrations.RunSQL(
            sql="""
            ALTER TABLE rto_checks ADD COLUMN IF NOT EXISTS negative_status TEXT NOT NULL DEFAULT '';
            ALTER TABLE rti_checks ADD COLUMN IF NOT EXISTS negative_status TEXT NOT NULL DEFAULT '';
            """,
            reverse_sql="""
            ALTER TABLE rto_checks DROP COLUMN IF EXISTS negative_status;
            ALTER TABLE rti_checks DROP COLUMN IF EXISTS negative_status;
            """
        )
    ]
