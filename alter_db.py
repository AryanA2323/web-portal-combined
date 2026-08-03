import os, django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()
from django.db import connections

try:
    with connections['default'].cursor() as cursor:
        cursor.execute("ALTER TABLE cases ADD COLUMN IF NOT EXISTS section134_sent_history JSONB DEFAULT '[]'::jsonb")
        print('Column added successfully!')
except Exception as e:
    import traceback
    traceback.print_exc()
