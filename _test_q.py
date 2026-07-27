import os, django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()
from django.db import connections
with connections['default'].cursor() as c:
    c.execute("SELECT questionnaire FROM claimant_checks WHERE questionnaire IS NOT NULL LIMIT 1")
    row = c.fetchone()
    print('Raw questionnaire:', row[0] if row else 'None')
    print('Type:', type(row[0]) if row else 'None')
