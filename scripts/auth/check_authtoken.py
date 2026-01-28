import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()

from django.db import connection

cursor = connection.cursor()

# Check if table exists
cursor.execute("""
    SELECT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_name = 'users_authtoken'
    )
""")
table_exists = cursor.fetchone()[0]
print(f"Table exists: {table_exists}")

if table_exists:
    cursor.execute("""
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'users_authtoken' 
        ORDER BY ordinal_position
    """)
    print("\nColumns in users_authtoken:")
    for row in cursor.fetchall():
        print(f"  - {row[0]}")
