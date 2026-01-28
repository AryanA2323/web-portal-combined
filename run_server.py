import os
import sys
import traceback

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')

try:
    from django.core.management import execute_from_command_line
    print("Starting Django server...")
    execute_from_command_line(['manage.py', 'runserver'])
except Exception as e:
    print(f"ERROR: {e}")
    traceback.print_exc()
    sys.exit(1)
