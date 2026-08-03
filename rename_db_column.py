import os, sys, django
sys.path.append(r'd:\Shoveltech\Shoveltech Internal Porject')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()
from django.db import connections

try:
    with connections['default'].cursor() as cursor:
        cursor.execute("ALTER TABLE cases RENAME COLUMN scope_of_work TO special_instructions")
        print('Column renamed successfully!')
except Exception as e:
    import traceback
    traceback.print_exc()
