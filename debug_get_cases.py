
import os, django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()
from users.api.cases import get_cases
class DummyUser:
    is_authenticated = True
    role = 'Super_Admin'
    id = 1
class DummyRequest:
    user = DummyUser()
req = DummyRequest()
print(get_cases(req, page=1, page_size=10))
    