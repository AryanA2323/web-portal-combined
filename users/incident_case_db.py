"""
Helper module to write case and verification data to the incident_case_db database.

The incident_case_db has these tables with specific column names:
  - cases
  - claimant_checks
  - insured_checks
  - driver_checks
  - spot_checks
  - chargesheets

CHECK CONSTRAINTS (must use exact values):
  cases.investigation_type       : 'Full Case' | 'Partial Case' | 'Reassessment' | 'Connected Case'  (NOT NULL)
  cases.sla             : 'AT' | 'WT'  (nullable)
  cases.full_case_status: 'WIP' | 'Pending CS' | 'Completed' | 'IR-Writing' | 'NI' | 'Withdraw' | 'QC-1' | 'Pending Additional Docs' | 'Connected Pending' | 'RCU Pending' | 'Portal Upload'  (NOT NULL)
  cases.investigation_report_status: 'Open' | 'Approval' | 'Stop' | 'QC' | 'Dispatch'  (NOT NULL)
  *_checks.check_status : 'Not Initiated' | 'WIP' | 'Completed' | 'Stop'  (NOT NULL)

This module translates Django model data into the correct column names
for each table and performs INSERT/UPDATE operations.
"""

import json
import logging
import re
import threading
import urllib.request
import urllib.parse
from django.db import connections

logger = logging.getLogger(__name__)

DB_ALIAS = 'default'

# Valid values per CHECK constraints
VALID_INVESTIGATION_TYPES = {'Full Case', 'Partial Case', 'Reassessment', 'Connected Case'}
VALID_SLA = {'AT', 'WT'}
VALID_FULL_CASE_STATUS = {
    'WIP', 'Pending CS', 'Completed', 'Closed', 'Open', 'IR-Writing', 'NI', 'Withdraw',
    'QC-1', 'Pending Additional Docs', 'Connected Pending', 'RCU Pending', 'Portal Upload',
}
VALID_INVESTIGATION_REPORT = {'Open', 'Approval', 'Stop', 'QC', 'Dispatch'}
VALID_CHECK_STATUS = {
    'Not Initiated', 'WIP', 'Completed', 'Stop', 'Verified', 'Reassigned',
    'Applied for CS', 'CS Recieved to adv', 'Dispatched', 'not found',
    'Unable to Verify'
}


def _get_cursor():
    """Get a database cursor for incident_case_db."""
    return connections[DB_ALIAS].cursor()


# ─── Open Location Code / Google Plus Code Decoding Constants ───────────────
CODE_ALPHABET = "23456789CFGHJMPQRVWX"
CODE_ALPHABET_MAP = {c: i for i, c in enumerate(CODE_ALPHABET)}
SEPARATOR = "+"
SEPARATOR_POSITION = 8

# Reference coordinates for major Indian cities to instantly recover local plus codes
PLUS_CODE_CITY_COORDS = {
    'pune': (18.5204, 73.8567),
    'mumbai': (19.0760, 72.8777),
    'delhi': (28.6139, 77.2090),
    'bangalore': (12.9716, 77.5946),
    'bengaluru': (12.9716, 77.5946),
    'hyderabad': (17.3850, 78.4867),
    'chennai': (13.0827, 80.2707),
    'kolkata': (22.5726, 88.3639),
    'ahmedabad': (23.0225, 72.5714),
    'jaipur': (26.9124, 75.7873),
    'lucknow': (26.8467, 80.9462),
    'nagpur': (21.1458, 79.0882),
    'nashik': (19.9975, 73.7898),
    'aurangabad': (19.8762, 75.3433),
    'chhatrapati sambhajinagar': (19.8762, 75.3433),
    'thane': (19.2183, 72.9781),
    'solapur': (17.6599, 75.9064),
    'kolhapur': (16.7050, 74.2433),
    'amravati': (20.9374, 77.7796),
    'nanded': (19.1383, 77.3210),
    'sangli': (16.8524, 74.5815),
    'satara': (17.6805, 74.0183),
}


def _parse_dms(dms_str: str):
    """
    Parse Degrees Minutes Seconds (DMS) string to decimal (lat, lng) with 100% precision.
    Supports Google Maps DMS formats:
      - 18°33'54.7"N 73°56'41.3"E
      - 18°33'54.7\"N, 73°56'41.3\"E
      - 18 33 54.7 N 73 56 41.3 E
    """
    if not dms_str:
        return None
    pattern = r'(?i)(\d+)[\s°º\^]+(\d+)[\s\'\′]+(?:(\d+(?:\.\d+)?)[\s\"\″\”]*)?([NS])[\s,;+]+(\d+)[\s°º\^]+(\d+)[\s\'\′]+(?:(\d+(?:\.\d+)?)[\s\"\″\”]*)?([EW])'
    m = re.search(pattern, dms_str.strip())
    if m:
        lat_d, lat_m, lat_s, lat_dir, lng_d, lng_m, lng_s, lng_dir = m.groups()
        lat = float(lat_d) + float(lat_m) / 60.0 + (float(lat_s) if lat_s else 0.0) / 3600.0
        if lat_dir.upper() == 'S':
            lat = -lat
        lng = float(lng_d) + float(lng_m) / 60.0 + (float(lng_s) if lng_s else 0.0) / 3600.0
        if lng_dir.upper() == 'W':
            lng = -lng
        return round(lat, 7), round(lng, 7)
    return None


def _parse_decimal_coords(coord_str: str):
    """
    Parse Decimal Degrees string to (lat, lng) with 100% precision.
    Supports formats:
      - 18.565194, 73.944806
      - 18.565194 73.944806
      - 18.565194° N, 73.944806° E
      - Auto-fixes inverted (lng, lat) coordinates for India region.
    """
    if not coord_str:
        return None
    clean = re.sub(r'(?i)\b(lat|latitude|lng|long|longitude)[:=\s]+', '', coord_str)
    pattern = r'(?i)\b([+-]?\d{1,2}(?:\.\d{3,8}))\s*°?\s*([NS])?[\s,;+]+([+-]?\d{1,3}(?:\.\d{3,8}))\s*°?\s*([EW])?\b'
    m = re.search(pattern, clean.strip())
    if m:
        v1, dir1, v2, dir2 = m.groups()
        f1, f2 = float(v1), float(v2)
        if dir1 and dir1.upper() == 'S': f1 = -abs(f1)
        if dir1 and dir1.upper() == 'N': f1 = abs(f1)
        if dir2 and dir2.upper() == 'W': f2 = -abs(f2)
        if dir2 and dir2.upper() == 'E': f2 = abs(f2)

        # Check India bounding box and inverted coords (India lat 6-38, lng 68-98)
        if 68 <= f1 <= 98 and 6 <= f2 <= 38 and not dir1:
            return round(f2, 7), round(f1, 7)
        if -90 <= f1 <= 90 and -180 <= f2 <= 180:
            return round(f1, 7), round(f2, 7)
        if -90 <= f2 <= 90 and -180 <= f1 <= 180:
            return round(f2, 7), round(f1, 7)
    return None


def _parse_google_maps_url(url_str: str):
    """
    Extract coordinates from Google Maps URLs:
      - https://www.google.com/maps/place/.../@18.565194,73.944806,17z/...
      - https://maps.google.com/?q=18.565194,73.944806
      - https://maps.app.goo.gl/... (follows redirect)
    """
    if not url_str or not ('maps.google.' in url_str or 'google.com/maps' in url_str or 'goo.gl/maps' in url_str or 'maps.app.goo.gl' in url_str):
        return None
    target_url = url_str.strip()
    if 'goo.gl' in target_url or 'maps.app.goo.gl' in target_url:
        try:
            req = urllib.request.Request(target_url, headers={'User-Agent': 'Mozilla/5.0'})
            with urllib.request.urlopen(req, timeout=5) as resp:
                target_url = resp.geturl()
        except Exception:
            pass

    at_match = re.search(r'@([+-]?\d+\.\d+),([+-]?\d+\.\d+)', target_url)
    if at_match:
        return round(float(at_match.group(1)), 7), round(float(at_match.group(2)), 7)

    q_match = re.search(r'[?&](?:q|query|ll|loc|destination)=([+-]?\d+\.\d+)[,+ ]+([+-]?\d+\.\d+)', target_url)
    if q_match:
        return round(float(q_match.group(1)), 7), round(float(q_match.group(2)), 7)

    data_match = re.search(r'!3d([+-]?\d+\.\d+)!4d([+-]?\d+\.\d+)', target_url)
    if data_match:
        return round(float(data_match.group(1)), 7), round(float(data_match.group(2)), 7)

    return None


def _decode_full_plus_code(code: str):
    """Decode a full Open Location Code (e.g. 7658HW8W+2G) to (lat, lng)."""
    clean_code = code.upper().replace(SEPARATOR, "")
    if len(clean_code) < 2:
        return None
    lat_val = 0.0
    lng_val = 0.0
    lat_val += CODE_ALPHABET_MAP.get(clean_code[0], 0) * 20.0
    lng_val += CODE_ALPHABET_MAP.get(clean_code[1], 0) * 20.0
    resolution = 20.0
    pair_count = min(len(clean_code) // 2, 5)
    for i in range(1, pair_count):
        resolution /= 20.0
        lat_val += CODE_ALPHABET_MAP.get(clean_code[i * 2], 0) * resolution
        lng_val += CODE_ALPHABET_MAP.get(clean_code[i * 2 + 1], 0) * resolution
    lat_val -= 90.0
    lng_val -= 180.0
    if len(clean_code) > 10:
        row_res = resolution / 5.0
        col_res = resolution / 4.0
        for i in range(10, len(clean_code)):
            val = CODE_ALPHABET_MAP.get(clean_code[i], 0)
            row = val // 4
            col = val % 4
            lat_val += row * row_res
            lng_val += col * col_res
            row_res /= 5.0
            col_res /= 4.0
        resolution = row_res
    center_lat = lat_val + (resolution / 2.0 if len(clean_code) <= 10 else resolution * 2.5)
    center_lng = lng_val + (resolution / 2.0 if len(clean_code) <= 10 else resolution * 2.0)
    return round(center_lat, 7), round(center_lng, 7)


def _recover_nearest_plus_code(short_code: str, ref_lat: float, ref_lng: float):
    """Recover full plus code from a short code and reference coordinates."""
    short_code = short_code.upper().strip()
    sep_idx = short_code.find(SEPARATOR)
    if sep_idx < 0 or sep_idx > SEPARATOR_POSITION:
        return None
    digits_to_add = SEPARATOR_POSITION - sep_idx
    if digits_to_add % 2 != 0:
        return None
    norm_lat = ref_lat + 90.0
    norm_lng = ref_lng + 180.0
    prefix = ""
    res = 20.0
    for _ in range(digits_to_add // 2):
        lat_digit = int(norm_lat // res) % 20
        lng_digit = int(norm_lng // res) % 20
        prefix += CODE_ALPHABET[lat_digit] + CODE_ALPHABET[lng_digit]
        res /= 20.0
    full_code = prefix + short_code
    decoded = _decode_full_plus_code(full_code)
    if not decoded:
        return None
    lat, lng = decoded
    res_deg = res * 20.0
    while lat - ref_lat > res_deg / 2: lat -= res_deg
    while lat - ref_lat < -res_deg / 2: lat += res_deg
    while lng - ref_lng > res_deg / 2: lng -= res_deg
    while lng - ref_lng < -res_deg / 2: lng += res_deg
    return round(lat, 7), round(lng, 7)


def _parse_plus_code(text: str):
    """
    Parse a Google Plus Code (e.g. 'HW8W+2G Pune, Maharashtra' or '8V6QHW8W+2G').
    """
    if not text:
        return None
    m = re.search(r'\b([23456789CFGHJMPQRVWX]{4,8}\+[23456789CFGHJMPQRVWX]{2,3})\b', text.upper())
    if not m:
        return None
    code = m.group(1)
    if len(code.replace('+', '')) >= 8:
        return _decode_full_plus_code(code)
    lower_text = text.lower()
    for city, (clat, clng) in PLUS_CODE_CITY_COORDS.items():
        if city in lower_text:
            return _recover_nearest_plus_code(code, clat, clng)
    return _recover_nearest_plus_code(code, 18.5204, 73.8567)


def _google_maps_geocode(address: str):
    """
    Google Maps Geocoding API (highest accuracy for Indian POIs and businesses).
    Uses GOOGLE_MAPS_API_KEY if configured in settings/environment.
    """
    from django.conf import settings
    import os
    key = getattr(settings, 'GOOGLE_MAPS_API_KEY', '') or os.environ.get('GOOGLE_MAPS_API_KEY', '')
    if not key or key in ('your_google_maps_api_key', 'YOUR_GOOGLE_MAPS_API_KEY', ''):
        return None, None
    try:
        params = urllib.parse.urlencode({
            'address': address.strip(),
            'key': key.strip(),
            'region': 'in',
        })
        url = f'https://maps.googleapis.com/maps/api/geocode/json?{params}'
        req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
        with urllib.request.urlopen(req, timeout=8) as resp:
            data = json.loads(resp.read().decode())
        if data.get('status') == 'OK' and data.get('results'):
            loc = data['results'][0]['geometry']['location']
            return round(float(loc['lat']), 7), round(float(loc['lng']), 7)
    except Exception as e:
        logger.debug(f'[geocode] Google Maps Geocode failed: {e}')
    return None, None


def _mapbox_geocode(address: str):
    """
    Mapbox Geocoding API (100k free requests/month, no credit card required).
    Uses MAPBOX_ACCESS_TOKEN if configured in settings/environment.
    """
    from django.conf import settings
    import os
    token = getattr(settings, 'MAPBOX_ACCESS_TOKEN', '') or os.environ.get('MAPBOX_ACCESS_TOKEN', '')
    if not token or token in ('your_mapbox_token', 'YOUR_MAPBOX_ACCESS_TOKEN', ''):
        return None, None
    try:
        encoded_query = urllib.parse.quote(address.strip())
        url = f'https://api.mapbox.com/geocoding/v5/mapbox.places/{encoded_query}.json?access_token={token.strip()}&country=in&limit=1'
        req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
        with urllib.request.urlopen(req, timeout=8) as resp:
            data = json.loads(resp.read().decode())
        if data.get('features'):
            coords = data['features'][0]['geometry']['coordinates'] # [lng, lat]
            return round(float(coords[1]), 7), round(float(coords[0]), 7)
    except Exception as e:
        logger.debug(f'[geocode] Mapbox Geocode failed: {e}')
    return None, None


def _arcgis_query(query: str):
    """
    ArcGIS API call via geopy with coordinate inversion protection for India.
    """
    if not query or not query.strip():
        return None, None
    try:
        from geopy.geocoders import ArcGIS
        geolocator = ArcGIS(timeout=10)
        location = geolocator.geocode(query.strip())
        if location:
            lat, lng = location.latitude, location.longitude
            # Inversion fix (India latitude is 6-38, longitude is 68-98)
            if 68 <= lat <= 98 and 6 <= lng <= 38:
                lat, lng = lng, lat
            return round(lat, 7), round(lng, 7)
    except Exception as e:
        logger.debug(f'[geocode] ArcGIS call failed for "{query[:60]}": {e}')
    return None, None


def _nominatim_query(query: str):
    """
    Nominatim API call restricted to India.
    """
    if not query or not query.strip():
        return None, None
    params = urllib.parse.urlencode({
        'q': query.strip(),
        'format': 'json',
        'limit': 1,
        'countrycodes': 'in',
    })
    url = f'https://nominatim.openstreetmap.org/search?{params}'
    req = urllib.request.Request(url, headers={'User-Agent': 'IncidentMgmtPlatform/1.0'})
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            data = json.loads(resp.read().decode())
        if data:
            return round(float(data[0]['lat']), 7), round(float(data[0]['lon']), 7)
    except Exception as e:
        logger.debug(f'[geocode] Nominatim call failed for "{query[:60]}": {e}')
    return None, None


def _geocode(address: str):
    """
    Ultra-high accuracy location retriever supporting:
      1. Direct Google Maps URLs (short & long links)
      2. Degrees Minutes Seconds (DMS) coordinates from Google Maps (e.g. 18°33'54.7"N 73°56'41.3"E)
      3. Decimal coordinates (e.g. 18.565194, 73.944806)
      4. Google Plus Codes / Open Location Code (e.g. HW8W+2G Pune, Maharashtra)
      5. Embedded coordinates/Plus Codes inside place/address text
      6. Google Maps Geocoding API (highest accuracy building resolution)
      7. Mapbox Geocoding API (high accuracy POI and street resolution)
      8. ArcGIS with Indian coordinate inversion protection
      9. Nominatim progressive fallback for Indian addresses
    """
    if not address or not address.strip():
        return None, None

    raw = address.strip()

    # ── Strategy 1: Direct Google Maps URL / Share Link ─────────────────────
    coords = _parse_google_maps_url(raw)
    if coords:
        logger.info(f'[geocode] Strategy-GoogleMapsURL: {coords} from "{raw[:60]}"')
        return coords

    # ── Strategy 2: Direct DMS Coordinates (e.g. 18°33'54.7"N 73°56'41.3"E) ─
    coords = _parse_dms(raw)
    if coords:
        logger.info(f'[geocode] Strategy-DMS: {coords} from "{raw[:60]}"')
        return coords

    # ── Strategy 3: Direct Decimal Coordinates (e.g. 18.565194, 73.944806) ──
    coords = _parse_decimal_coords(raw)
    if coords:
        logger.info(f'[geocode] Strategy-DecimalCoords: {coords} from "{raw[:60]}"')
        return coords

    # ── Strategy 4: Google Plus Code / Open Location Code ───────────────────
    coords = _parse_plus_code(raw)
    if coords:
        logger.info(f'[geocode] Strategy-PlusCode: {coords} from "{raw[:60]}"')
        return coords

    # ── Strategy 5: Embedded coordinates/links inside full text ─────────────
    # Check if address contains embedded Google Maps URL
    url_match = re.search(r'https?://[^\s,]+', raw)
    if url_match:
        url_coords = _parse_google_maps_url(url_match.group(0))
        if url_coords:
            logger.info(f'[geocode] Strategy-EmbeddedURL: {url_coords}')
            return url_coords

    # Check if address contains embedded DMS
    dms_match = re.search(r'(\d+[\s°º\^]+\d+[\s\'\′]+(?:\d+(?:\.\d+)?[\s\"\″\”]*)?[NS][\s,;+]+\d+[\s°º\^]+\d+[\s\'\′]+(?:\d+(?:\.\d+)?[\s\"\″\”]*)?[EW])', raw)
    if dms_match:
        coords = _parse_dms(dms_match.group(1))
        if coords:
            logger.info(f'[geocode] Strategy-EmbeddedDMS: {coords}')
            return coords

    # Check if address contains embedded decimal coords
    dec_match = re.search(r'([+-]?\d{1,2}\.\d{4,8})\s*°?\s*([NS])?[\s,;+]+([+-]?\d{1,3}\.\d{4,8})\s*°?\s*([EW])?', raw)
    if dec_match:
        coords = _parse_decimal_coords(dec_match.group(0))
        if coords:
            logger.info(f'[geocode] Strategy-EmbeddedDec: {coords}')
            return coords

    # ── Strategy 6: Google Maps Geocoding API ───────────────────────────────
    lat, lng = _google_maps_geocode(raw)
    if lat is not None:
        logger.info(f'[geocode] Strategy-GoogleMapsAPI success: ({lat},{lng}) for "{raw[:60]}"')
        return lat, lng

    # ── Strategy 7: Mapbox Geocoding API ────────────────────────────────────
    lat, lng = _mapbox_geocode(raw)
    if lat is not None:
        logger.info(f'[geocode] Strategy-Mapbox success: ({lat},{lng}) for "{raw[:60]}"')
        return lat, lng

    # ── Strategy 8: ArcGIS High-Accuracy ────────────────────────────────────
    lat, lng = _arcgis_query(raw)
    if lat is not None:
        logger.info(f'[geocode] Strategy-ArcGIS success: ({lat},{lng}) for "{raw[:60]}"')
        return lat, lng

    # ── Strategy 9: Nominatim full address ──────────────────────────────────
    lat, lng = _nominatim_query(raw)
    if lat is not None:
        logger.info(f'[geocode] Strategy-Nominatim success: ({lat},{lng}) for "{raw[:60]}"')
        return lat, lng

    # ── Strategy 9: Strip Indian address noise words ────────────────────────
    cleaned = raw
    cleaned = re.sub(
        r'\b(near|opp\.?|opposite|behind|beside|adj\.?|adjacent|in front of)\s+[^,]+',
        '', cleaned, flags=re.IGNORECASE
    )
    cleaned = re.sub(
        r'\b(octroi naka|naka|chowk|bypass|flyover|overbridge|underpass|toll|signal)\b',
        '', cleaned, flags=re.IGNORECASE
    )
    cleaned = ', '.join(p.strip() for p in cleaned.split(',') if p.strip())
    if cleaned and cleaned != raw:
        lat, lng = _arcgis_query(cleaned)
        if lat is not None:
            return lat, lng
        lat, lng = _nominatim_query(cleaned)
        if lat is not None:
            return lat, lng

    # ── Strategy 10: Last N comma-separated parts ───────────────────────────
    parts = [p.strip() for p in raw.split(',') if p.strip()]
    for n in (4, 3):
        if len(parts) >= n:
            candidate = ', '.join(parts[-n:])
            lat, lng = _arcgis_query(candidate)
            if lat is not None:
                return lat, lng
            lat, lng = _nominatim_query(candidate)
            if lat is not None:
                return lat, lng

    # ── Strategy 11: Indian 6-digit PIN code ────────────────────────────────
    pincode_match = re.search(r'\b\d{6}\b', raw)
    if pincode_match:
        lat, lng = _nominatim_query(f'{pincode_match.group()}, India')
        if lat is not None:
            return lat, lng

    # ── Strategy 12: Last 2 parts (city + state) ────────────────────────────
    if len(parts) >= 2:
        candidate = ', '.join(parts[-2:])
        lat, lng = _nominatim_query(candidate)
        if lat is not None:
            return lat, lng

    logger.warning(f'[geocode] All strategies failed for: "{raw[:80]}"')
    return None, None


def _geocode_and_update(table: str, row_id: int, lat_col: str, lng_col: str, address: str):
    """
    Geocode address in a background thread and UPDATE the row with lat/lng.
    Called after the row has already been inserted with NULL coords.
    This way the API response is instant and coords appear within seconds.
    """
    def _worker():
        lat, lng = _geocode(address)
        if lat is None:
            return
        try:
            # Open a fresh connection in the thread (Django handles per-thread connections)
            from django.db import connections as _conns
            with _conns[DB_ALIAS].cursor() as cur:
                cur.execute(
                    f'UPDATE {table} SET {lat_col}=%s, {lng_col}=%s WHERE id=%s',
                    [lat, lng, row_id]
                )
            logger.info(f'[geocode] Updated {table} id={row_id} → ({lat},{lng})')
        except Exception as e:
            logger.warning(f'[geocode] Failed to update {table} id={row_id}: {e}')

    t = threading.Thread(target=_worker, daemon=True, name=f'geocode-{table}-{row_id}')
    t.start()


# =========================================================================
# CASES
# =========================================================================

def insert_case(claim_number, client_name, category,
                case_receive_date=None, receive_month='',
                closure_date=None, closure_month='',
                case_due_date=None, tat_days=None,
                sla='', investigation_type='',
                investigation_report_status='Open',
                full_case_status='WIP',
                special_instructions='',
                case_number='',
                policy_document='',
                petition_document=''):
    """
    Insert a row into incident_case_db.cases.
    Lets Postgres auto-generate the id.
    Returns the generated case id so verifications can reference it.
    """
    # Enforce NOT NULL + CHECK constraints with sensible defaults
    if investigation_type not in VALID_INVESTIGATION_TYPES:
        investigation_type = 'Full Case'
    if full_case_status not in VALID_FULL_CASE_STATUS:
        full_case_status = 'WIP'
    if investigation_report_status not in VALID_INVESTIGATION_REPORT:
        investigation_report_status = 'Open'
    # sla is nullable; only pass value if valid, else NULL
    sla_val = sla if sla in VALID_SLA else None

    try:
        with _get_cursor() as cursor:
            cursor.execute("""
                INSERT INTO cases
                    (claim_number, client_name, category,
                     case_receive_date, receive_month,
                     closure_date, closure_month,
                     case_due_date, tat_days, sla, investigation_type,
                     investigation_report_status, full_case_status,
                     special_instructions, case_number, policy_document, petition_document, created_at, updated_at)
                VALUES
                    (%s, %s, %s,
                     %s, %s,
                     %s, %s,
                     %s, %s, %s, %s,
                     %s, %s,
                     %s, %s, %s, %s, NOW(), NOW())
                RETURNING id
            """, [
                claim_number, client_name or '', category or '',
                case_receive_date, receive_month or '',
                closure_date, closure_month or '',
                case_due_date, tat_days, sla_val, investigation_type,
                investigation_report_status, full_case_status,
                special_instructions or '', case_number or '',
                policy_document or '', petition_document or '',
            ])
            new_id = cursor.fetchone()[0]
        logger.info(f"[incident_case_db] Inserted case id={new_id} claim={claim_number}")
        return new_id
    except Exception as e:
        logger.error(f"[incident_case_db] Failed to insert case: {e}")
        raise


# =========================================================================
# CLAIMANT CHECKS
# =========================================================================

def insert_claimant_check(case_id,
                          claimant_name='', claimant_contact='',
                          claimant_address='', claimant_income=None,
                          dependants=None, case_documents=None,
                          vendor_documents=None,
                          check_status='Not Initiated',
                          statement='', triggers='',
                          fir_date=None, reason_if_delayed='',
                          lat=None, lng=None):
    """Insert into incident_case_db.claimant_checks.
    Saves immediately with NULL coords, then geocodes in background thread.
    dependants: list of dicts [{dependent_name, dependent_contact, dependent_address, relationship, age}, ...]
    case_documents: list of dicts [{filename, url, size, mime_type, uploaded_at}, ...]
    vendor_documents: list of dicts [{filename, url, size, mime_type, uploaded_at}, ...]
    """
    if check_status not in VALID_CHECK_STATUS:
        check_status = 'WIP'
    try:
        with _get_cursor() as cursor:
            cursor.execute("""
                INSERT INTO claimant_checks
                    (case_id, claimant_name, claimant_contact,
                     claimant_address, claimant_income,
                     dependants, case_documents, vendor_documents,
                     check_status, statement, triggers,
                     claimant_lat, claimant_lng,
                     created_at, updated_at)
                VALUES
                    (%s, %s, %s,
                     %s, %s,
                     %s, %s, %s,
                     %s, %s, %s,
                     %s, %s,
                     NOW(), NOW())
                RETURNING id
            """, [
                case_id, claimant_name, claimant_contact,
                claimant_address, claimant_income,
                json.dumps(dependants or []), json.dumps(case_documents or []),
                json.dumps(vendor_documents or []),
                check_status, statement, triggers,
                lat, lng,
            ])
            row_id = cursor.fetchone()[0]
        logger.info(f"[incident_case_db] Inserted claimant_check id={row_id} for case={case_id}")
        # Geocode in background — doesn't block the API response
        if (lat is None or lng is None) and claimant_address and claimant_address.strip():
            _geocode_and_update('claimant_checks', row_id, 'claimant_lat', 'claimant_lng', claimant_address)
    except Exception as e:
        logger.error(f"[incident_case_db] Failed to insert claimant_check: {e}")
        raise


# =========================================================================
# INSURED CHECKS
# =========================================================================

def insert_insured_check(case_id,
                         insured_name='', insured_contact='',
                         insured_address='',
                         policy_number='', policy_period='',
                         rc='', permit='',
                         case_documents=None, vendor_documents=None,
                         check_status='Not Initiated',
                         statement='', triggers='',
                         lat=None, lng=None):
    """Insert into incident_case_db.insured_checks.
    Saves immediately with NULL coords, then geocodes in background thread.
    case_documents: list of dicts [{filename, url, size, mime_type, uploaded_at}, ...]
    vendor_documents: list of dicts [{filename, url, size, mime_type, uploaded_at}, ...]
    """
    if check_status not in VALID_CHECK_STATUS:
        check_status = 'WIP'
    try:
        with _get_cursor() as cursor:
            cursor.execute("""
                INSERT INTO insured_checks
                    (case_id, insured_name, insured_contact,
                     insured_address,
                     policy_number, policy_period,
                     rc, permit,
                     case_documents, vendor_documents,
                     check_status, statement, triggers,
                     insured_lat, insured_lng,
                     created_at, updated_at)
                VALUES
                    (%s, %s, %s,
                     %s,
                     %s, %s,
                     %s, %s,
                     %s, %s,
                     %s, %s, %s,
                     %s, %s,
                     NOW(), NOW())
                RETURNING id
            """, [
                case_id, insured_name, insured_contact,
                insured_address,
                policy_number, policy_period,
                rc, permit,
                json.dumps(case_documents or []), json.dumps(vendor_documents or []),
                check_status, statement, triggers,
                lat, lng,
            ])
            row_id = cursor.fetchone()[0]
        logger.info(f"[incident_case_db] Inserted insured_check id={row_id} for case={case_id}")
        # Geocode in background if coordinates not provided
        if (lat is None or lng is None) and insured_address and insured_address.strip():
            _geocode_and_update('insured_checks', row_id, 'insured_lat', 'insured_lng', insured_address)
    except Exception as e:
        logger.error(f"[incident_case_db] Failed to insert insured_check: {e}")
        raise


# =========================================================================
# DRIVER CHECKS
# =========================================================================

def insert_driver_check(case_id,
                        driver_name='', driver_contact='',
                        driver_address='',
                        dl='', permit='', occupation='',
                        case_documents=None, vendor_documents=None,
                        check_status='Not Initiated',
                        statement='', triggers='',
                        lat=None, lng=None):
    """Insert into incident_case_db.driver_checks.
    Saves immediately with NULL coords, then geocodes in background thread.
    case_documents: list of dicts [{filename, url, size, mime_type, uploaded_at}, ...]
    vendor_documents: list of dicts [{filename, url, size, mime_type, uploaded_at}, ...]
    """
    if check_status not in VALID_CHECK_STATUS:
        check_status = 'WIP'
    try:
        with _get_cursor() as cursor:
            cursor.execute("""
                INSERT INTO driver_checks
                    (case_id, driver_name, driver_contact,
                     driver_address,
                     dl, permit, occupation,
                     case_documents, vendor_documents,
                     check_status, statement, triggers,
                     driver_lat, driver_lng,
                     created_at, updated_at)
                VALUES
                    (%s, %s, %s,
                     %s,
                     %s, %s, %s,
                     %s, %s,
                     %s, %s, %s,
                     %s, %s,
                     NOW(), NOW())
                RETURNING id
            """, [
                case_id, driver_name, driver_contact,
                driver_address,
                dl, permit, occupation,
                json.dumps(case_documents or []), json.dumps(vendor_documents or []),
                check_status, statement, triggers,
                lat, lng,
            ])
            row_id = cursor.fetchone()[0]
        logger.info(f"[incident_case_db] Inserted driver_check id={row_id} for case={case_id}")
        # Geocode in background if coordinates not provided
        if (lat is None or lng is None) and driver_address and driver_address.strip():
            _geocode_and_update('driver_checks', row_id, 'driver_lat', 'driver_lng', driver_address)
    except Exception as e:
        logger.error(f"[incident_case_db] Failed to insert driver_check: {e}")
        raise


# =========================================================================
# SPOT CHECKS
# =========================================================================

def insert_spot_check(case_id,
                      time_of_accident='', place_of_accident='',
                      district='', fir_number='',
                      city='', police_station='', accident_brief='',
                      case_documents=None, vendor_documents=None,
                      check_status='Not Initiated',
                      triggers='',
                      lat=None, lng=None):
    """Insert into incident_case_db.spot_checks.
    Note: spot_checks has 'observations' (plural) and no 'statement' column.
    Geocodes the accident location using place_of_accident + district in background thread.
    case_documents: list of dicts [{filename, url, size, mime_type, uploaded_at}, ...]
    vendor_documents: list of dicts [{filename, url, size, mime_type, uploaded_at}, ...]
    """
    if check_status not in VALID_CHECK_STATUS:
        check_status = 'WIP'
    try:
        with _get_cursor() as cursor:
            cursor.execute("""
                INSERT INTO spot_checks
                    (case_id, time_of_accident, place_of_accident,
                     district, fir_number,
                     city, police_station, accident_brief,
                     case_documents, vendor_documents,
                     check_status, triggers,
                     spot_lat, spot_lng,
                     created_at, updated_at)
                VALUES
                    (%s, %s, %s,
                     %s, %s,
                     %s, %s, %s,
                     %s, %s,
                     %s, %s,
                     %s, %s,
                     NOW(), NOW())
                RETURNING id
            """, [
                case_id, time_of_accident, place_of_accident,
                district, fir_number,
                city, police_station, accident_brief,
                json.dumps(case_documents or []), json.dumps(vendor_documents or []),
                check_status, triggers,
                lat, lng,
            ])
            row_id = cursor.fetchone()[0]
        logger.info(f"[incident_case_db] Inserted spot_check id={row_id} for case={case_id}")
        # Build a combined location string and geocode in background if coordinates not provided
        location_query = ', '.join(filter(None, [place_of_accident, district]))
        if (lat is None or lng is None) and location_query.strip():
            _geocode_and_update('spot_checks', row_id, 'spot_lat', 'spot_lng', location_query)
    except Exception as e:
        logger.error(f"[incident_case_db] Failed to insert spot_check: {e}")
        raise


# =========================================================================
# CHARGESHEETS
# =========================================================================

def insert_chargesheet(case_id,
                       fir_number='', city='', court_name='',
                       mv_act='', fir_delay_days=None,
                       bsn_section='', ipc='',
                       police_station_name='', court_district='', court_case_no='',
                       case_documents=None, vendor_documents=None,
                       check_status='Not Initiated',
                       statement='', triggers=''):
    """Insert into incident_case_db.chargesheets.
    Geocodes the city/court location using OpenStreetMap Nominatim.
    case_documents: list of dicts [{filename, url, size, mime_type, uploaded_at}, ...]
    vendor_documents: list of dicts [{filename, url, size, mime_type, uploaded_at}, ...]
    """
    if check_status not in VALID_CHECK_STATUS:
        check_status = 'WIP'
    try:
        with _get_cursor() as cursor:
            cursor.execute("""
                INSERT INTO chargesheets
                    (case_id, fir_number, city, court_name,
                     mv_act, fir_delay_days,
                     bsn_section, ipc,
                     police_station_name, court_district, court_case_no,
                     case_documents, vendor_documents,
                     check_status, statement, triggers,
                     chargesheet_lat, chargesheet_lng,
                     created_at, updated_at)
                VALUES
                    (%s, %s, %s, %s,
                     %s, %s,
                     %s, %s,
                     %s, %s, %s,
                     %s, %s,
                     %s, %s, %s,
                     %s, %s,
                     NOW(), NOW())
                RETURNING id
            """, [
                case_id, fir_number, city, court_name,
                mv_act, fir_delay_days,
                bsn_section, ipc,
                police_station_name, court_district, court_case_no,
                json.dumps(case_documents or []), json.dumps(vendor_documents or []),
                check_status, statement, triggers,
                lat, lng,
            ])
            row_id = cursor.fetchone()[0]
        logger.info(f"[incident_case_db] Inserted chargesheet id={row_id} for case={case_id}")
        # Geocode court/city location in background
        location_query = ', '.join(filter(None, [court_name, city]))
        if location_query.strip():
            _geocode_and_update('chargesheets', row_id, 'chargesheet_lat', 'chargesheet_lng', location_query)
    except Exception as e:
        logger.error(f"[incident_case_db] Failed to insert chargesheet: {e}")
        raise


# =========================================================================
# RTI CHECKS  (Right to Information)
# =========================================================================

def insert_rti_check(case_id,
                     chargesheet_checked=False, fir_number='',
                     dl_checked=False, dl_number='',
                     permit_checked=False, permit_number='',
                     rc_checked=False, rc_number='',
                     remarks='',
                     case_documents=None, vendor_documents=None,
                     check_status='Not Initiated'):
    """Insert into incident_case_db.rti_checks.
    Each field has a boolean toggle and an associated number/text value.
    """
    if check_status not in VALID_CHECK_STATUS:
        check_status = 'WIP'
    try:
        with _get_cursor() as cursor:
            cursor.execute("""
                INSERT INTO rti_checks
                    (case_id,
                     chargesheet_checked, fir_number,
                     dl_checked, dl_number,
                     permit_checked, permit_number,
                     rc_checked, rc_number,
                     remarks,
                     case_documents, vendor_documents,
                     check_status,
                     created_at, updated_at)
                VALUES
                    (%s,
                     %s, %s,
                     %s, %s,
                     %s, %s,
                     %s, %s,
                     %s,
                     %s, %s,
                     %s,
                     NOW(), NOW())
                RETURNING id
            """, [
                case_id,
                chargesheet_checked, fir_number,
                dl_checked, dl_number,
                permit_checked, permit_number,
                rc_checked, rc_number,
                remarks,
                json.dumps(case_documents or []), json.dumps(vendor_documents or []),
                check_status,
                lat, lng,
            ])
            row_id = cursor.fetchone()[0]
        logger.info(f"[incident_case_db] Inserted rti_check id={row_id} for case={case_id}")
    except Exception as e:
        logger.error(f"[incident_case_db] Failed to insert rti_check: {e}")
        raise


# =========================================================================
# RTO CHECKS  (Regional Transport Office)
# =========================================================================

def insert_rto_check(case_id,
                     rto_name='', rto_address='',
                     dl_checked=False, dl_number='',
                     permit_checked=False, permit_number='',
                     rc_checked=False, rc_number='',
                     remarks='',
                     case_documents=None, vendor_documents=None,
                     check_status='Not Initiated',
                     lat=None, lng=None):
    """Insert into incident_case_db.rto_checks.
    Geocodes the RTO office address in background thread.
    """
    if check_status not in VALID_CHECK_STATUS:
        check_status = 'WIP'
    try:
        with _get_cursor() as cursor:
            cursor.execute("""
                INSERT INTO rto_checks
                    (case_id,
                     rto_name, rto_address,
                     dl_checked, dl_number,
                     permit_checked, permit_number,
                     rc_checked, rc_number,
                     remarks,
                     case_documents, vendor_documents,
                     check_status,
                     rto_lat, rto_lng,
                     created_at, updated_at)
                VALUES
                    (%s,
                     %s, %s,
                     %s, %s,
                     %s, %s,
                     %s, %s,
                     %s,
                     %s, %s,
                     %s,
                     %s, %s,
                     NOW(), NOW())
                RETURNING id
            """, [
                case_id,
                rto_name, rto_address,
                dl_checked, dl_number,
                permit_checked, permit_number,
                rc_checked, rc_number,
                remarks,
                json.dumps(case_documents or []), json.dumps(vendor_documents or []),
                check_status,
                lat, lng,
            ])
            row_id = cursor.fetchone()[0]
        logger.info(f"[incident_case_db] Inserted rto_check id={row_id} for case={case_id}")
        # Geocode RTO office address in background if coordinates not provided
        location_query = ', '.join(filter(None, [rto_name, rto_address]))
        if (lat is None or lng is None) and location_query.strip():
            _geocode_and_update('rto_checks', row_id, 'rto_lat', 'rto_lng', location_query)
    except Exception as e:
        logger.error(f"[incident_case_db] Failed to insert rto_check: {e}")
        raise


# =========================================================================
# DELETE CASE
# =========================================================================

def delete_case(case_id):
    """
    Delete a case, its AI generated reports, and all its related verification checks from incident_case_db.
    """
    try:
        with _get_cursor() as cursor:
            # First check if case exists and retrieve case_number
            case_number = None
            cursor.execute("SELECT case_number FROM cases WHERE id = %s", [case_id])
            row = cursor.fetchone()
            if row:
                case_number = row[0]
            else:
                cursor.execute("SELECT case_number FROM insurance_case WHERE id = %s", [case_id])
                row = cursor.fetchone()
                if row:
                    case_number = row[0]

            if not row:
                raise ValueError(f"Case with id {case_id} not found")
            
            # Delete all related verification checks first (due to foreign key constraints)
            cursor.execute("DELETE FROM claimant_checks WHERE case_id = %s", [case_id])
            cursor.execute("DELETE FROM insured_checks WHERE case_id = %s", [case_id])
            cursor.execute("DELETE FROM driver_checks WHERE case_id = %s", [case_id])
            cursor.execute("DELETE FROM spot_checks WHERE case_id = %s", [case_id])
            cursor.execute("DELETE FROM rti_checks WHERE case_id = %s", [case_id])
            cursor.execute("DELETE FROM rto_checks WHERE case_id = %s", [case_id])
            cursor.execute("DELETE FROM chargesheets WHERE case_id = %s", [case_id])

            # Delete AI generated report(s) associated with this case
            if case_number:
                cursor.execute(
                    "DELETE FROM reports WHERE case_id IN (SELECT id FROM insurance_case WHERE case_number = %s)",
                    [case_number]
                )
            cursor.execute("DELETE FROM reports WHERE case_id = %s", [case_id])
            
            # Delete the case itself from cases and insurance_case tables
            cursor.execute("DELETE FROM cases WHERE id = %s", [case_id])
            if case_number:
                cursor.execute("DELETE FROM cases WHERE case_number = %s", [case_number])
                cursor.execute("DELETE FROM insurance_case WHERE case_number = %s", [case_number])
            cursor.execute("DELETE FROM insurance_case WHERE id = %s", [case_id])
            
        logger.info(f"[incident_case_db] Deleted case id={case_id} ({case_number}) and all related AI reports & verification checks")
        return {"success": True, "message": f"Case {case_id} and all related AI reports & verification checks deleted successfully"}
    except ValueError as e:
        logger.warning(f"[incident_case_db] Case not found: {e}")
        raise
    except Exception as e:
        logger.error(f"[incident_case_db] Failed to delete case {case_id}: {e}")
        raise
