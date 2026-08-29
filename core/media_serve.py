"""
Custom media file serving view with HTTP Range request support.

Browsers require Range requests (Accept-Ranges: bytes, 206 Partial Content)
to determine audio/video duration and enable seeking. Django's built-in
`serve` view does NOT support Range requests, so we provide this custom view.
"""
import os
import re
import mimetypes
import posixpath
from pathlib import Path

from django.http import (
    FileResponse,
    HttpResponse,
    HttpResponseNotModified,
    Http404,
)
from django.utils.http import http_date
from django.views.static import was_modified_since


def serve_media(request, path, document_root=None):
    """
    Serve media files with support for HTTP Range requests (partial content).
    This is essential for audio/video playback in browsers.
    """
    # Normalise path (prevent directory traversal) and URL decode it
    from urllib.parse import unquote
    path = posixpath.normpath(unquote(path)).lstrip("/")
    fullpath = Path(document_root) / path

    if not fullpath.exists() or fullpath.is_dir():
        # Fallback: try replacing spaces with underscores in filename
        # (uploads use file.name.replace(' ', '_') but URLs may retain spaces)
        alt_name = fullpath.name.replace(' ', '_')
        alt_path = fullpath.parent / alt_name
        if alt_path.exists() and not alt_path.is_dir():
            fullpath = alt_path
        else:
            # Also try the entire path with spaces replaced
            alt_full = Path(document_root) / path.replace(' ', '_')
            if alt_full.exists() and not alt_full.is_dir():
                fullpath = alt_full
            else:
                raise Http404(f"'{path}' could not be found")

    # Resolve to absolute to prevent traversal
    fullpath = fullpath.resolve()
    if not str(fullpath).startswith(str(Path(document_root).resolve())):
        raise Http404("Access denied")

    statobj = fullpath.stat()
    content_type, _ = mimetypes.guess_type(str(fullpath))
    content_type = content_type or "application/octet-stream"

    # Handle If-Modified-Since
    if not was_modified_since(
        request.META.get("HTTP_IF_MODIFIED_SINCE"),
        statobj.st_mtime,
    ):
        return HttpResponseNotModified()

    file_size = statobj.st_size

    # ── Range request handling ───────────────────────────────────────
    range_header = request.META.get("HTTP_RANGE", "").strip()
    if range_header:
        range_match = re.match(r"bytes=(\d*)-(\d*)", range_header)
        if range_match:
            start = range_match.group(1)
            end = range_match.group(2)

            start = int(start) if start else 0
            end = int(end) if end else file_size - 1

            # Clamp
            if start >= file_size:
                start = 0
            if end >= file_size:
                end = file_size - 1

            length = end - start + 1

            f = open(fullpath, "rb")
            f.seek(start)

            response = HttpResponse(
                f.read(length),
                status=206,
                content_type=content_type,
            )
            response["Content-Length"] = str(length)
            response["Content-Range"] = f"bytes {start}-{end}/{file_size}"
            response["Accept-Ranges"] = "bytes"
            response["Last-Modified"] = http_date(statobj.st_mtime)
            response["Access-Control-Allow-Origin"] = "*"
            response["Access-Control-Allow-Headers"] = "Range"
            response["Access-Control-Expose-Headers"] = (
                "Content-Range, Accept-Ranges, Content-Length"
            )
            f.close()
            return response

    # ── Full-file response (no Range header) ─────────────────────────
    response = FileResponse(
        open(fullpath, "rb"),
        content_type=content_type,
    )
    response["Content-Length"] = str(file_size)
    response["Accept-Ranges"] = "bytes"
    response["Last-Modified"] = http_date(statobj.st_mtime)
    response["Access-Control-Allow-Origin"] = "*"
    response["Access-Control-Allow-Headers"] = "Range"
    response["Access-Control-Expose-Headers"] = (
        "Content-Range, Accept-Ranges, Content-Length"
    )
    return response


def download_file(request):
    """
    Handle forcing a file download with Content-Disposition.
    Required for Vendor Portal's /api/download-file endpoint.
    """
    from django.conf import settings
    from urllib.parse import unquote

    raw_url = request.GET.get('file_url')
    filename = request.GET.get('filename', 'document')

    if not raw_url:
        raise Http404("Missing file_url parameter")

    # Normalize the path from the URL
    path = str(raw_url)
    if path.startswith(("http://", "https://")):
        from urllib.parse import urlparse
        path = urlparse(path).path

    if path.startswith("/api/media/"):
        path = path[11:]
    elif path.startswith("/media/"):
        path = path[7:]
    elif path.startswith("media/"):
        path = path[6:]
    
    path = posixpath.normpath(unquote(path)).lstrip("/")
    fullpath = Path(settings.MEDIA_ROOT) / path

    if not fullpath.exists() or fullpath.is_dir():
        raise Http404("File not found")

    fullpath = fullpath.resolve()
    if not str(fullpath).startswith(str(Path(settings.MEDIA_ROOT).resolve())):
        raise Http404("Access denied")

    content_type, _ = mimetypes.guess_type(str(fullpath))
    content_type = content_type or "application/octet-stream"

    response = FileResponse(
        open(fullpath, "rb"),
        as_attachment=True,
        filename=filename,
        content_type=content_type
    )
    
    response["Content-Length"] = str(fullpath.stat().st_size)
    response["Access-Control-Allow-Origin"] = "*"
    return response
