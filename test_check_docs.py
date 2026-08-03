import os
import django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()
from django.db import connection
cursor=connection.cursor()
cursor.execute('SELECT id, case_id, case_documents, vendor_documents FROM rto_checks')
print(cursor.fetchall())
