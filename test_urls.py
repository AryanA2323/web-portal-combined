import os, django, json
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()
from users.api.vendor_cases import parse_json_list, build_absolute_media_url
from django.test import RequestFactory
request = RequestFactory().get('/')
request.META['HTTP_HOST'] = 'api.claimverify.shovelsolutions.in'
photo_list = parse_json_list('[{"filename": "test.jpg", "url": "/media/evidence_photos/test.jpg"}]')
for p in photo_list:
    p['preview_url'] = build_absolute_media_url(request, p.get('url'))
print(json.dumps(photo_list, indent=2))
