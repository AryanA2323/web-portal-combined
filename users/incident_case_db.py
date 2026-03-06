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
  cases.case_type       : 'Full Case' | 'Partial Case' | 'Reassessment' | 'Connected Case'  (NOT NULL)
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
VALID_CASE_TYPES = {'Full Case', 'Partial Case', 'Reassessment', 'Connected Case'}
VALID_SLA = {'AT', 'WT'}
VALID_FULL_CASE_STATUS = {
    'WIP', 'Pending CS', 'Completed', 'IR-Writing', 'NI', 'Withdraw',
    'QC-1', 'Pending Additional Docs', 'Connected Pending', 'RCU Pending', 'Portal Upload',
}
VALID_INVESTIGATION_REPORT = {'Open', 'Approval', 'Stop', 'QC', 'Dispatch'}
VALID_CHECK_STATUS = {'Not Initiated', 'WIP', 'Completed', 'Stop'}


def _get_cursor():
    """Get a database cursor for incident_case_db."""
    return connections[DB_ALIAS].cursor()


def _nominatim_query(query: str):
    """
    Single Nominatim API call. Returns (lat, lng) or (None, None).
    Restricted to India (countrycodes=in) for better accuracy.
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
            return float(data[0]['lat']), float(data[0]['lon'])
    except Exception as e:
        logger.debug(f'[geocode] Nominatim call failed for "{query[:60]}": {e}')
    return None, None


def _geocode(address: str):
    """
    Convert an address string to (latitude, longitude) using the
    OpenStreetMap Nominatim API (free, no key required).

    Uses a progressive fallback strategy to handle verbose Indian addresses
    that contain noise words like "near X", "opp. X", "Octroi Naka" etc.
    which Nominatim cannot resolve directly.

    Fallback order:
      1. Full address as given
      2. Address with Indian noise phrases stripped
      3. Last 4 comma-separated parts
      4. Last 3 comma-separated parts
      5. 6-digit PIN code if present (highly accurate for India)
      6. Last 2 comma-separated parts

    Returns (None, None) only if ALL strategies fail, so it never
    blocks the database save.
    """
    if not address or not address.strip():
        return None, None

    # --- Strategy 1: full address ----------------------------------------------
    lat, lng = _nominatim_query(address)
    if lat is not None:
        logger.info(f'[geocode] Strategy-1 success: ({lat},{lng}) for "{address[:60]}"')
        return lat, lng

    # --- Strategy 2: strip Indian address noise --------------------------------
    cleaned = address
    # Remove "near X", "opp. X", "opposite X", "behind X" etc. (up to next comma)
    cleaned = re.sub(
        r'\b(near|opp\.?|opposite|behind|beside|adj\.?|adjacent|in front of)\s+[^,]+',
        '', cleaned, flags=re.IGNORECASE
    )
    # Remove common landmark noise words that Nominatim can't resolve
    cleaned = re.sub(
        r'\b(octroi naka|naka|chowk|bypass|flyover|overbridge|underpass|toll|signal)\b',
        '', cleaned, flags=re.IGNORECASE
    )
    cleaned = ', '.join(p.strip() for p in cleaned.split(',') if p.strip())
    if cleaned and cleaned != address:
        lat, lng = _nominatim_query(cleaned)
        if lat is not None:
            logger.info(f'[geocode] Strategy-2 (cleaned) success: ({lat},{lng})')
            return lat, lng

    # --- Strategy 3 & 4: last N comma-separated parts -------------------------
    parts = [p.strip() for p in address.split(',') if p.strip()]
    for n in (4, 3):
        if len(parts) >= n:
            candidate = ', '.join(parts[-n:])
            lat, lng = _nominatim_query(candidate)
            if lat is not None:
                logger.info(f'[geocode] Strategy-last{n} success: ({lat},{lng}) for "{candidate}"')
                return lat, lng

    # --- Strategy 5: Indian 6-digit PIN code ----------------------------------
    pincode_match = re.search(r'\b\d{6}\b', address)
    if pincode_match:
        lat, lng = _nominatim_query(f'{pincode_match.group()}, India')
        if lat is not None:
            logger.info(f'[geocode] Strategy-pincode success: ({lat},{lng}) for pin={pincode_match.group()}')
            return lat, lng

    # --- Strategy 6: last 2 parts (city + state) ------------------------------
    if len(parts) >= 2:
        candidate = ', '.join(parts[-2:])
        lat, lng = _nominatim_query(candidate)
        if lat is not None:
            logger.info(f'[geocode] Strategy-last2 success: ({lat},{lng}) for "{candidate}"')
            return lat, lng

    logger.warning(f'[geocode] All strategies failed for: "{address[:80]}"')
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
                completion_date=None, completion_month='',
                case_due_date=None, tat_days=None,
                sla='', case_type='',
                investigation_report_status='Open',
                full_case_status='WIP',
                scope_of_work='',
                case_number=''):
    """
    Insert a row into incident_case_db.cases.
    Lets Postgres auto-generate the id.
    Returns the generated case id so verifications can reference it.
    """
    # Enforce NOT NULL + CHECK constraints with sensible defaults
    if case_type not in VALID_CASE_TYPES:
        case_type = 'Full Case'
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
                     completion_date, completion_month,
                     case_due_date, tat_days, sla, case_type,
                     investigation_report_status, full_case_status,
                     scope_of_work, case_number, created_at, updated_at)
                VALUES
                    (%s, %s, %s,
                     %s, %s,
                     %s, %s,
                     %s, %s, %s, %s,
                     %s, %s,
                     %s, %s, NOW(), NOW())
                RETURNING id
            """, [
                claim_number, client_name or '', category or '',
                case_receive_date, receive_month or '',
                completion_date, completion_month or '',
                case_due_date, tat_days, sla_val, case_type,
                investigation_report_status, full_case_status,
                scope_of_work or '', case_number or '',
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
                          check_status='PENDING',
                          statement='', observation=''):
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
                     check_status, statement, observation,
                     claimant_lat, claimant_lng,
                     created_at, updated_at)
                VALUES
                    (%s, %s, %s,
                     %s, %s,
                     %s, %s, %s,
                     %s, %s, %s,
                     NULL, NULL,
                     NOW(), NOW())
                RETURNING id
            """, [
                case_id, claimant_name, claimant_contact,
                claimant_address, claimant_income,
                json.dumps(dependants or []), json.dumps(case_documents or []),
                json.dumps(vendor_documents or []),
                check_status, statement, observation,
            ])
            row_id = cursor.fetchone()[0]
        logger.info(f"[incident_case_db] Inserted claimant_check id={row_id} for case={case_id}")
        # Geocode in background — doesn't block the API response
        if claimant_address and claimant_address.strip():
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
                         check_status='PENDING',
                         statement='', observation=''):
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
                     check_status, statement, observation,
                     insured_lat, insured_lng,
                     created_at, updated_at)
                VALUES
                    (%s, %s, %s,
                     %s,
                     %s, %s,
                     %s, %s,
                     %s, %s,
                     %s, %s, %s,
                     NULL, NULL,
                     NOW(), NOW())
                RETURNING id
            """, [
                case_id, insured_name, insured_contact,
                insured_address,
                policy_number, policy_period,
                rc, permit,
                json.dumps(case_documents or []), json.dumps(vendor_documents or []),
                check_status, statement, observation,
            ])
            row_id = cursor.fetchone()[0]
        logger.info(f"[incident_case_db] Inserted insured_check id={row_id} for case={case_id}")
        # Geocode in background — doesn't block the API response
        if insured_address and insured_address.strip():
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
                        check_status='PENDING',
                        statement='', observation=''):
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
                     check_status, statement, observation,
                     driver_lat, driver_lng,
                     created_at, updated_at)
                VALUES
                    (%s, %s, %s,
                     %s,
                     %s, %s, %s,
                     %s, %s,
                     %s, %s, %s,
                     NULL, NULL,
                     NOW(), NOW())
                RETURNING id
            """, [
                case_id, driver_name, driver_contact,
                driver_address,
                dl, permit, occupation,
                json.dumps(case_documents or []), json.dumps(vendor_documents or []),
                check_status, statement, observation,
            ])
            row_id = cursor.fetchone()[0]
        logger.info(f"[incident_case_db] Inserted driver_check id={row_id} for case={case_id}")
        # Geocode in background
        if driver_address and driver_address.strip():
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
                      check_status='PENDING',
                      observations=''):
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
                     check_status, observations,
                     spot_lat, spot_lng,
                     created_at, updated_at)
                VALUES
                    (%s, %s, %s,
                     %s, %s,
                     %s, %s, %s,
                     %s, %s,
                     %s, %s,
                     NULL, NULL,
                     NOW(), NOW())
                RETURNING id
            """, [
                case_id, time_of_accident, place_of_accident,
                district, fir_number,
                city, police_station, accident_brief,
                json.dumps(case_documents or []), json.dumps(vendor_documents or []),
                check_status, observations,
            ])
            row_id = cursor.fetchone()[0]
        logger.info(f"[incident_case_db] Inserted spot_check id={row_id} for case={case_id}")
        # Build a combined location string and geocode in background
        location_query = ', '.join(filter(None, [place_of_accident, district]))
        if location_query.strip():
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
                       case_documents=None, vendor_documents=None,
                       check_status='PENDING',
                       statement='', observations=''):
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
                     case_documents, vendor_documents,
                     check_status, statement, observations,
                     chargesheet_lat, chargesheet_lng,
                     created_at, updated_at)
                VALUES
                    (%s, %s, %s, %s,
                     %s, %s,
                     %s, %s,
                     %s, %s,
                     %s, %s, %s,
                     NULL, NULL,
                     NOW(), NOW())
                RETURNING id
            """, [
                case_id, fir_number, city, court_name,
                mv_act, fir_delay_days,
                bsn_section, ipc,
                json.dumps(case_documents or []), json.dumps(vendor_documents or []),
                check_status, statement, observations,
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
                     check_status='PENDING'):
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
                     check_status='PENDING'):
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
                     NULL, NULL,
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
            ])
            row_id = cursor.fetchone()[0]
        logger.info(f"[incident_case_db] Inserted rto_check id={row_id} for case={case_id}")
        # Geocode RTO office address in background
        location_query = ', '.join(filter(None, [rto_name, rto_address]))
        if location_query.strip():
            _geocode_and_update('rto_checks', row_id, 'rto_lat', 'rto_lng', location_query)
    except Exception as e:
        logger.error(f"[incident_case_db] Failed to insert rto_check: {e}")
        raise
