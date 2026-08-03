import os
import django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()
from django.db import connection
cursor=connection.cursor()
for t in ['rto_checks', 'rti_checks']: 
  cursor.execute(f"SELECT column_name FROM information_schema.columns WHERE table_name = '{t}'")
  print(t, [r[0] for r in cursor.fetchall()])
