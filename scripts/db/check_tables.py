import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()

from django.db import connection

cursor = connection.cursor()

# Get all tables
cursor.execute("""
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
    ORDER BY table_name
""")

print("All tables in database:")
for row in cursor.fetchall():
    table = row[0]
    if any(keyword in table.lower() for keyword in ['admin', 'lawyer', 'vendor', 'user', 'auth']):
        print(f"  {table}")
