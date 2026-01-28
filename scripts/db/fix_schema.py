import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()

from django.db import connection

cursor = connection.cursor()

# Add missing columns to users_admin table
print("Adding missing columns to users_admin...")
try:
    cursor.execute("""
        ALTER TABLE users_admin 
        ADD COLUMN IF NOT EXISTS department VARCHAR(255) DEFAULT '',
        ADD COLUMN IF NOT EXISTS employee_id VARCHAR(50) UNIQUE,
        ADD COLUMN IF NOT EXISTS contact_email VARCHAR(254) DEFAULT '',
        ADD COLUMN IF NOT EXISTS contact_phone VARCHAR(20) DEFAULT '',
        ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE,
        ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    """)
    connection.commit()
    print("✓ Added columns to users_admin")
except Exception as e:
    print(f"Info: {e}")

# Add missing columns to users_lawyer table
print("\nAdding missing columns to users_lawyer...")
try:
    cursor.execute("""
        ALTER TABLE users_lawyer 
        ADD COLUMN IF NOT EXISTS bar_license_number VARCHAR(50) UNIQUE,
        ADD COLUMN IF NOT EXISTS specialization VARCHAR(255) DEFAULT '',
        ADD COLUMN IF NOT EXISTS contact_email VARCHAR(254) DEFAULT '',
        ADD COLUMN IF NOT EXISTS contact_phone VARCHAR(20) DEFAULT '',
        ADD COLUMN IF NOT EXISTS office_address TEXT DEFAULT '',
        ADD COLUMN IF NOT EXISTS office_city VARCHAR(100) DEFAULT '',
        ADD COLUMN IF NOT EXISTS office_state VARCHAR(100) DEFAULT '',
        ADD COLUMN IF NOT EXISTS years_of_experience INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS bio TEXT DEFAULT '',
        ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE,
        ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    """)
    connection.commit()
    print("✓ Added columns to users_lawyer")
except Exception as e:
    print(f"Info: {e}")

print("\nColumns updated successfully!")
