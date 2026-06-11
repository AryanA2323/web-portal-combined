"""Notification service for writing vendor_notifications records on check assignment changes."""

from __future__ import annotations

import logging
import json
from typing import Optional
from urllib import request as urllib_request
from urllib.error import URLError, HTTPError

from django.db import connections

logger = logging.getLogger(__name__)

# Maps check_type string to the corresponding raw-SQL table name.
CHECK_TABLE_MAP: dict[str, str] = {
    "claimant": "claimant_checks",
    "insured": "insured_checks",
    "driver": "driver_checks",
    "spot": "spot_checks",
    "chargesheet": "chargesheets",
    "rti": "rti_checks",
    "rto": "rto_checks",
}

# Maps check_type string to a human-readable label used in notification messages.
CHECK_TYPE_LABELS: dict[str, str] = {
    "claimant": "Claimant check",
    "insured": "Insured check",
    "driver": "Driver check",
    "spot": "Spot check",
    "chargesheet": "Chargesheet check",
    "rti": "RTI check",
    "rto": "RTO check",
}


def _build_message(notification_type: str, check_type: str, case_number: str) -> str:
    """Return a human-readable notification message.

    Examples:
        _build_message('CHECK_ASSIGNED', 'claimant', 'CASE-001')
        # "You have been assigned the Claimant check for case CASE-001."

        _build_message('CHECK_REMOVED', 'driver', 'CASE-001')
        # "The Driver check for case CASE-001 has been removed from your assignments."
    """
    label = CHECK_TYPE_LABELS.get(check_type, check_type)
    if notification_type == "CHECK_ASSIGNED":
        return f"You have been assigned the {label} for case {case_number}."
    return f"The {label} for case {case_number} has been removed from your assignments."


def _build_push_title(notification_type: str) -> str:
    """Return a short title for phone notification banners."""
    if notification_type == "CHECK_ASSIGNED":
        return "New check assigned"
    return "Check removed"


def _send_expo_push_notifications(
    vendor_id: int,
    notification_type: str,
    check_type: str,
    case_id: int,
    case_number: str,
    message: str,
) -> None:
    """Send best-effort Expo push notifications to active vendor devices."""
    try:
        with connections["default"].cursor() as cursor:
            cursor.execute(
                """
                SELECT expo_push_token
                FROM vendor_push_tokens
                WHERE vendor_id = %s AND is_active = TRUE
                """,
                [vendor_id],
            )
            tokens = [row[0] for row in cursor.fetchall()]
    except Exception as exc:
        logger.error("Failed to fetch push tokens for vendor=%s: %s", vendor_id, exc)
        return

    valid_tokens = [
        token for token in tokens
        if token and (
            str(token).startswith("ExponentPushToken[")
            or str(token).startswith("ExpoPushToken[")
        )
    ]
    if not valid_tokens:
        return

    payload = [
        {
            "to": token,
            "title": _build_push_title(notification_type),
            "body": message,
            "sound": "default",
            "data": {
                "notification_type": notification_type,
                "check_type": check_type,
                "case_id": case_id,
                "case_number": case_number,
            },
        }
        for token in valid_tokens
    ]

    try:
        req = urllib_request.Request(
            "https://exp.host/--/api/v2/push/send",
            data=json.dumps(payload).encode("utf-8"),
            headers={
                "Accept": "application/json",
                "Content-Type": "application/json",
            },
            method="POST",
        )
        with urllib_request.urlopen(req, timeout=10) as response:
            response.read()
    except (HTTPError, URLError, TimeoutError, OSError) as exc:
        logger.error("Expo push send failed for vendor=%s: %s", vendor_id, exc)


def notify_reassignment(
    case_id: int,
    check_type: str,
    old_vendor_id: Optional[int],
    new_vendor_id: Optional[int],
    case_number: str,
) -> None:
    """Create CHECK_REMOVED / CHECK_ASSIGNED records in vendor_notifications.

    Writes:
    - A CHECK_REMOVED record for ``old_vendor_id`` when it is not None.
    - A CHECK_ASSIGNED record for ``new_vendor_id`` when it is not None.

    All database errors are caught and logged at ERROR level; they are never
    re-raised so that a notification failure never blocks a successful assignment.
    """
    records: list[tuple[int, str]] = []
    if old_vendor_id:
        records.append((old_vendor_id, "CHECK_REMOVED"))
    if new_vendor_id:
        records.append((new_vendor_id, "CHECK_ASSIGNED"))

    if not records:
        return

    try:
        with connections["default"].cursor() as cursor:
            for vendor_id, ntype in records:
                msg = _build_message(ntype, check_type, case_number)
                cursor.execute(
                    """
                    INSERT INTO vendor_notifications
                        (vendor_id, notification_type, check_type,
                         case_id, case_number, message, is_read, created_at)
                    VALUES (%s, %s, %s, %s, %s, %s, FALSE, NOW())
                    """,
                    [vendor_id, ntype, check_type, case_id, case_number, msg],
                )
                _send_expo_push_notifications(
                    vendor_id=vendor_id,
                    notification_type=ntype,
                    check_type=check_type,
                    case_id=case_id,
                    case_number=case_number,
                    message=msg,
                )
    except Exception as exc:
        logger.error(
            "NotificationService failed to write notifications for "
            "case_id=%s check_type=%s: %s",
            case_id,
            check_type,
            exc,
        )
