import os, sys, django
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()

from users.models import EmailIntake

e = EmailIntake.objects.latest('received_at')
print(f"Subject: {e.subject}")
print(f"\nBody preview: {e.body_text[:800]}")
