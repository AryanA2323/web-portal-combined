"""
URL configuration for incident management platform project.
"""
import os

from django.contrib import admin
from django.urls import path, re_path
from django.conf import settings
from django.conf.urls.static import static
from core.api import api
from core.media_serve import serve_media

caseManager_path = os.environ.get('DJANGO_ADMIN_PATH', 'caseManager').strip('/') or 'caseManager'

urlpatterns = [
    path("admin/", admin.site.urls),
    path('api/', api.urls),
    re_path(r'^media/(?P<path>.*)$', serve_media, {'document_root': settings.MEDIA_ROOT}),
]

# Serve static files in development
if settings.DEBUG:
    urlpatterns += static(settings.STATIC_URL, document_root=settings.STATIC_ROOT)
