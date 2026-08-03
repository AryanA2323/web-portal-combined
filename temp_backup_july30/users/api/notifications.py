"""
Vendor Notifications API endpoints.
"""

import logging
from datetime import datetime, timezone as datetime_timezone
from typing import List, Optional

from django.db import connections
from django.http import HttpRequest
from ninja import Router, Schema

logger = logging.getLogger(__name__)

router = Router(tags=["Vendor Notifications"])


# =============================================================================
# Schemas
# =============================================================================

class NotificationItemSchema(Schema):
    """Schema for a single vendor notification."""
    id: int
    notification_type: str
    check_type: str
    case_id: int
    case_number: str
    claim_number: str
    message: str
    is_read: bool
    created_at: str


class NotificationsListResponse(Schema):
    """Response schema for listing vendor notifications."""
    notifications: List[NotificationItemSchema]
    unread_count: int


class ErrorSchema(Schema):
    """Error response schema."""
    error: str


class PushTokenSchema(Schema):
    """Request schema for registering a vendor device push token."""
    expo_push_token: str
    platform: Optional[str] = ""
    device_name: Optional[str] = ""


class PushTokenResponse(Schema):
    """Response schema for push token registration."""
    success: bool
    message: str


# =============================================================================
# Helper Functions
# =============================================================================

def _get_vendor_id(request) -> Optional[int]:
    """Resolve vendor_id for the authenticated vendor user.

    Returns None if the user is not authenticated or does not have the VENDOR role.
    """
    if not request.user.is_authenticated or request.user.role != 'VENDOR':
        return None
    try:
        from users.models import Vendor
        return Vendor.objects.get(user=request.user).id
    except Exception as exc:
        logger.error("Failed to resolve vendor ID for user %s: %s", request.user.id, exc)
        return None


def _format_created_at(value) -> str:
    """Return notification event time as an explicit UTC ISO string."""
    if not value:
        return ""

    if isinstance(value, datetime):
        if value.tzinfo is None:
            value = value.replace(tzinfo=datetime_timezone.utc)
        else:
            value = value.astimezone(datetime_timezone.utc)
        return value.isoformat().replace("+00:00", "Z")

    return str(value)


# =============================================================================
# Endpoints
# =============================================================================

@router.get(
    "/vendor/notifications",
    response={200: NotificationsListResponse, 401: ErrorSchema, 403: ErrorSchema},
    summary="List Vendor Notifications",
    description="Returns all notifications for the authenticated vendor, newest first, plus an unread count.",
)
def list_notifications(request: HttpRequest):
    """Fetch all notifications for the authenticated vendor."""
    if not request.user.is_authenticated:
        return 401, {"error": "Not authenticated"}

    vendor_id = _get_vendor_id(request)
    if vendor_id is None:
        return 403, {"error": "Vendor access required"}

    with connections['default'].cursor() as cursor:
        cursor.execute(
            """
            SELECT vn.id, vn.notification_type, vn.check_type, vn.case_id, vn.case_number,
                   COALESCE(NULLIF(ic.claim_number, ''), NULLIF(c.claim_number, ''), '') AS claim_number,
                   vn.message, vn.is_read, vn.created_at
            FROM vendor_notifications vn
            LEFT JOIN insurance_case ic ON ic.id = vn.case_id
            LEFT JOIN cases c ON c.id = vn.case_id
            WHERE vn.vendor_id = %s
            ORDER BY vn.created_at DESC
            """,
            [vendor_id],
        )
        rows = cursor.fetchall()

        cursor.execute(
            "SELECT COUNT(*) FROM vendor_notifications WHERE vendor_id = %s AND is_read = FALSE",
            [vendor_id],
        )
        unread_count = cursor.fetchone()[0]

    notifications = [
        {
            "id": r[0],
            "notification_type": r[1],
            "check_type": r[2],
            "case_id": r[3],
            "case_number": r[4],
            "claim_number": r[5],
            "message": r[6],
            "is_read": r[7],
            "created_at": _format_created_at(r[8]),
        }
        for r in rows
    ]

    return 200, {"notifications": notifications, "unread_count": unread_count}


@router.post(
    "/vendor/notifications/{notification_id}/read",
    response={
        200: NotificationItemSchema,
        401: ErrorSchema,
        403: ErrorSchema,
        404: ErrorSchema,
    },
    summary="Mark Notification as Read",
    description="Idempotently sets is_read=TRUE for the given notification. Returns the updated notification object.",
)
def mark_notification_read(request: HttpRequest, notification_id: int):
    """Mark a specific notification as read (idempotent)."""
    if not request.user.is_authenticated:
        return 401, {"error": "Not authenticated"}

    vendor_id = _get_vendor_id(request)
    if vendor_id is None:
        return 403, {"error": "Vendor access required"}

    with connections['default'].cursor() as cursor:
        # Check existence and ownership
        cursor.execute(
            "SELECT vendor_id FROM vendor_notifications WHERE id = %s",
            [notification_id],
        )
        row = cursor.fetchone()
        if row is None:
            return 404, {"error": "Notification not found"}
        if row[0] != vendor_id:
            return 403, {"error": "Access denied"}

        # Idempotent update — set is_read regardless of current value
        cursor.execute(
            """
            UPDATE vendor_notifications
            SET is_read = TRUE
            WHERE id = %s
            RETURNING id, notification_type, check_type, case_id, case_number,
                      message, is_read, created_at
            """,
            [notification_id],
        )
        r = cursor.fetchone()
        cursor.execute(
            """
            SELECT COALESCE(NULLIF(ic.claim_number, ''), NULLIF(c.claim_number, ''), '')
            FROM vendor_notifications vn
            LEFT JOIN insurance_case ic ON ic.id = vn.case_id
            LEFT JOIN cases c ON c.id = vn.case_id
            WHERE vn.id = %s
            """,
            [notification_id],
        )
        claim_row = cursor.fetchone()

    return 200, {
        "id": r[0],
        "notification_type": r[1],
        "check_type": r[2],
        "case_id": r[3],
        "case_number": r[4],
        "claim_number": claim_row[0] if claim_row else "",
        "message": r[5],
        "is_read": r[6],
        "created_at": _format_created_at(r[7]),
    }


@router.post(
    "/vendor/notifications/push-token",
    response={200: PushTokenResponse, 401: ErrorSchema, 403: ErrorSchema, 400: ErrorSchema},
    summary="Register Vendor Push Token",
    description="Stores the authenticated vendor's Expo push token for phone notification-bar alerts.",
)
def register_push_token(request: HttpRequest, payload: PushTokenSchema):
    """Register or reactivate an Expo push token for the authenticated vendor."""
    if not request.user.is_authenticated:
        return 401, {"error": "Not authenticated"}

    vendor_id = _get_vendor_id(request)
    if vendor_id is None:
        return 403, {"error": "Vendor access required"}

    expo_push_token = str(payload.expo_push_token or "").strip()
    if not expo_push_token:
        return 400, {"error": "expo_push_token is required"}

    platform = str(payload.platform or "")[:20]
    device_name = str(payload.device_name or "")[:255]

    with connections['default'].cursor() as cursor:
        cursor.execute(
            """
            INSERT INTO vendor_push_tokens
                (vendor_id, expo_push_token, platform, device_name, is_active, created_at, updated_at)
            VALUES (%s, %s, %s, %s, TRUE, NOW(), NOW())
            ON CONFLICT (expo_push_token)
            DO UPDATE SET
                vendor_id = EXCLUDED.vendor_id,
                platform = EXCLUDED.platform,
                device_name = EXCLUDED.device_name,
                is_active = TRUE,
                updated_at = NOW()
            """,
            [vendor_id, expo_push_token, platform, device_name],
        )

    return 200, {"success": True, "message": "Push token registered"}


@router.delete(
    "/vendor/notifications/push-token",
    response={200: PushTokenResponse, 401: ErrorSchema, 403: ErrorSchema},
    summary="Unregister Vendor Push Token",
    description="Marks a vendor device push token inactive.",
)
def unregister_push_token(request: HttpRequest, expo_push_token: str):
    """Deactivate a push token for the authenticated vendor."""
    if not request.user.is_authenticated:
        return 401, {"error": "Not authenticated"}

    vendor_id = _get_vendor_id(request)
    if vendor_id is None:
        return 403, {"error": "Vendor access required"}

    with connections['default'].cursor() as cursor:
        cursor.execute(
            """
            UPDATE vendor_push_tokens
            SET is_active = FALSE, updated_at = NOW()
            WHERE vendor_id = %s AND expo_push_token = %s
            """,
            [vendor_id, expo_push_token],
        )

    return 200, {"success": True, "message": "Push token unregistered"}
