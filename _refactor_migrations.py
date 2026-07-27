import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()

from django.db import connections

with connections['default'].cursor() as c:
    c.execute("UPDATE django_migrations SET name = '0008_admin_qc' WHERE name = '0008_admin_lawyer'")
    c.execute("UPDATE django_migrations SET name = '0009_alter_qc_options_and_more' WHERE name = '0009_alter_lawyer_options_and_more'")

print("Migration table updated.")
