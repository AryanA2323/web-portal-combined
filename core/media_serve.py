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


def _resolve_media_file(document_root, path):
    """
    Resolve a relative media path against document_root, handling URL-decoding,
    literal %20 or space differences, underscore replacements, and directory traversals safely.
    """
    from urllib.parse import unquote
    root = Path(document_root).resolve()

    raw_clean = posixpath.normpath(str(path)).lstrip("/")
    unquoted = posixpath.normpath(unquote(str(path))).lstrip("/")

    candidates = [
        unquoted,
        raw_clean,
        unquoted.replace(" ", "_"),
        raw_clean.replace(" ", "_"),
        unquoted.replace(" ", "%20"),
        raw_clean.replace(" ", "%20"),
        unquoted.replace("_", " "),
        unquoted.replace("_", "%20"),
    ]

    for cand in candidates:
        cand_path = (root / cand).resolve()
        if str(cand_path).startswith(str(root)) and cand_path.is_file():
            return cand_path

    # Check parent directory for match (handling spaces/encoded chars)
    parent_cand = (root / posixpath.dirname(unquoted)).resolve()
    if str(parent_cand).startswith(str(root)) and parent_cand.is_dir():
        target_name_lower = posixpath.basename(unquoted).lower()
        target_raw_lower = posixpath.basename(raw_clean).lower()
        target_variants = {
            target_name_lower,
            target_raw_lower,
            target_name_lower.replace(" ", "_"),
            target_raw_lower.replace(" ", "_"),
            target_name_lower.replace(" ", "%20"),
            target_raw_lower.replace(" ", "%20"),
            target_raw_lower.replace("%20", " "),
            target_raw_lower.replace("%20", "_"),
        }
        for entry in parent_cand.iterdir():
            if entry.is_file() and entry.name.lower() in target_variants:
                return entry.resolve()

    return None


def serve_media(request, path, document_root=None):
    """
    Serve media files with support for HTTP Range requests (partial content).
    This is essential for audio/video playback in browsers.
    """
    fullpath = _resolve_media_file(document_root, path)

    if not fullpath:
        raise Http404(f"'{path}' could not be found")

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
    
    fullpath = _resolve_media_file(settings.MEDIA_ROOT, path)
    if not fullpath:
        raise Http404("File not found")

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
