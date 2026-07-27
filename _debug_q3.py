import os, django, json
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()
from django.db import connections

# Check the actual column data type
with connections['default'].cursor() as cursor:
    cursor.execute("""
        SELECT data_type, udt_name 
        FROM information_schema.columns 
        WHERE table_name = 'claimant_checks' AND column_name = 'questionnaire'
    """)
    row = cursor.fetchone()
    print(f"Column type: data_type={row[0]}, udt_name={row[1]}")
    
    # Also test what psycopg2 returns for a jsonb column
    cursor.execute("SELECT questionnaire FROM claimant_checks WHERE check_status = 'Verified' LIMIT 1")
    val = cursor.fetchone()[0]
    print(f"psycopg2 returns: type={type(val)}, value={repr(val)[:200]}")
    
    # Check if the questionnaire was saved with ::jsonb cast
    cursor.execute("SELECT questionnaire::text FROM claimant_checks WHERE check_status = 'Verified' LIMIT 1")
    val2 = cursor.fetchone()[0]
    print(f"Cast to text: type={type(val2)}, value={repr(val2)[:200]}")
