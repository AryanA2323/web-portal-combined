import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()

from django.db import connection

cursor = connection.cursor()

# Drop the old authtoken table
cursor.execute("DROP TABLE IF EXISTS users_authtoken CASCADE")
print("Dropped old users_authtoken table")

# Now let Django recreate it with the correct schema
from django.core.management import execute_from_command_line
execute_from_command_line(['manage.py', 'migrate', 'users', '0003_authtoken'])
print("Recreated authtoken table with new schema")
