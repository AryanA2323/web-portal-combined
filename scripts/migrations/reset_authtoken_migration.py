import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()

from django.db import connection

cursor = connection.cursor()

# Drop the old incorrect table
cursor.execute("DROP TABLE IF EXISTS users_authtoken CASCADE")
print("Dropped old users_authtoken table")

# Mark migrations as unapplied
cursor.execute("DELETE FROM django_migrations WHERE app='users' AND name='0003_authtoken'")
connection.commit()
print("Unapplied migration 0003_authtoken")
