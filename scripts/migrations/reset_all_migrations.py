import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()

from django.db import connection

cursor = connection.cursor()

# Delete all migrations after 0003
cursor.execute("DELETE FROM django_migrations WHERE app='users' AND name IN ('0004_emailverificationcode_passwordresettoken', '0005_customuser_sub_role', '0006_customuser_permissions', '0007_alter_customuser_role')")
connection.commit()
print("Reset migrations back to 0003")
