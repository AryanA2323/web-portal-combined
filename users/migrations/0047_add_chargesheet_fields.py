# Migration to add police_station_name, court_district, and court_case_no to chargesheets table

from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ('users', '0042_alter_customuser_role_alter_vendor_user'),
    ]

    operations = [
        migrations.RunSQL(
            sql="""
            ALTER TABLE chargesheets
                ADD COLUMN IF NOT EXISTS police_station_name TEXT NOT NULL DEFAULT '',
                ADD COLUMN IF NOT EXISTS court_district TEXT NOT NULL DEFAULT '',
                ADD COLUMN IF NOT EXISTS court_case_no TEXT NOT NULL DEFAULT '';
            """,
            reverse_sql="""
            ALTER TABLE chargesheets
                DROP COLUMN IF EXISTS police_station_name,
                DROP COLUMN IF EXISTS court_district,
                DROP COLUMN IF EXISTS court_case_no;
            """,
        ),
    ]
