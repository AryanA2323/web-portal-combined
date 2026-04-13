"""
Reports API endpoints for legal review system.
"""

import json
import logging
from typing import List, Optional
from datetime import datetime
from ninja import Router, Schema
from ninja.errors import HttpError
from django.http import HttpRequest
from django.utils import timezone
from django.db import connections
from django.db.models import Max, Subquery

from users.api.cases import _enrich_evidence_metadata
from users.models import Report, InsuranceCase, CustomUser

logger = logging.getLogger(__name__)

router = Router(tags=["Reports"])


# =============================================================================
# Schemas
# =============================================================================

class LawyerSchema(Schema):
    """Lawyer response schema for assignment dropdown."""
    id: int
    username: str
    email: str
    first_name: str
    last_name: str
    full_name: str


class CaseInfoSchema(Schema):
    """Minimal case info for report listing."""
    id: int
    case_number: str
    title: str
    claim_number: Optional[str] = None
    client_name: Optional[str] = None
    category: str
    status: str


class ReportSchema(Schema):
    """Report response schema."""
    id: int
    case_id: int
    case_number: str
    case_title: str
    claim_number: Optional[str] = None
    client_name: Optional[str] = None
    category: str
    report_content: str
    status: str
    assigned_lawyer_id: Optional[int] = None
    assigned_lawyer_name: Optional[str] = None
    review_notes: str
    created_at: datetime
    updated_at: datetime
    assigned_at: Optional[datetime] = None
    reviewed_at: Optional[datetime] = None
    evidence_photos: Optional[List[dict]] = None


class ReportListSchema(Schema):
    """Report list response with case details."""
    id: int
    case_number: str
    case_title: str
    claim_number: Optional[str] = None
    client_name: Optional[str] = None
    category: str
    status: str
    assigned_lawyer_name: Optional[str] = None
    created_at: datetime
    assigned_at: Optional[datetime] = None
    reviewed_at: Optional[datetime] = None


class CreateReportSchema(Schema):
    """Schema for creating a report."""
    case_id: int
    report_content: str


class BulkCreateReportSchema(Schema):
    """Schema for bulk creating reports (migration from localStorage)."""
    reports: List[CreateReportSchema]


class AssignLawyerSchema(Schema):
    """Schema for assigning a lawyer to a report."""
    lawyer_id: int


class ReviewReportSchema(Schema):
    """Schema for accepting/rejecting a report."""
    action: str  # 'accept' or 'reject'
    notes: str = ''


class UpdateReportSchema(Schema):
    """Schema for updating report content."""
    report_content: str


class ReassignReportSchema(Schema):
    """Schema for reassigning a rejected report to a new lawyer."""
    lawyer_id: int


class ReportStatsSchema(Schema):
    """Report statistics schema."""
    total: int
    pending: int
    assigned: int
    accepted: int
    rejected: int


# =============================================================================
# Helper Functions
# =============================================================================

def _parse_vendor_evidence(raw_value):
    """Parse vendor_evidence JSON values from check tables."""
    if not raw_value:
        return []

    if isinstance(raw_value, list):
        return raw_value

    if isinstance(raw_value, str):
        try:
            parsed = json.loads(raw_value)
        except (json.JSONDecodeError, TypeError, ValueError):
            return []
        return parsed if isinstance(parsed, list) else []

    return []


def _collect_report_evidence_photos(request: HttpRequest, case_id: int) -> List[dict]:
    """Collect and normalize vendor evidence photos for a case."""
    evidence_tables = [
        "claimant_checks",
        "insured_checks",
        "driver_checks",
        "spot_checks",
        "chargesheets",
        "rti_checks",
        "rto_checks",
    ]

    evidence_photos: List[dict] = []
    seen_keys = set()

    with connections['default'].cursor() as cursor:
        for table_name in evidence_tables:
            try:
                cursor.execute(
                    f"""
                    SELECT vendor_evidence
                    FROM {table_name}
                    WHERE case_id = %s
                      AND vendor_evidence IS NOT NULL
                    """,
                    [case_id],
                )
            except Exception as exc:
                logger.debug(f"Skipping evidence fetch from {table_name}: {exc}")
                continue

            for (raw_evidence,) in cursor.fetchall():
                for evidence_item in _parse_vendor_evidence(raw_evidence):
                    if not isinstance(evidence_item, (dict, str)):
                        continue

                    normalized = _enrich_evidence_metadata(request, evidence_item)
                    dedupe_key = (
                        normalized.get('preview_url')
                        or normalized.get('url')
                        or normalized.get('photo_url')
                        or normalized.get('filename')
                    )
                    if not dedupe_key or dedupe_key in seen_keys:
                        continue

                    seen_keys.add(dedupe_key)
                    evidence_photos.append(normalized)

    return evidence_photos


def report_to_schema(report: Report, request: Optional[HttpRequest] = None) -> dict:
    """Convert Report model to response dict."""
    case = report.case
    lawyer = report.assigned_lawyer
    evidence_photos = _collect_report_evidence_photos(request, case.id) if request else []
    return {
        'id': report.id,
        'case_id': case.id,
        'case_number': case.case_number,
        'case_title': case.title,
        'claim_number': case.claim_number,
        'client_name': case.client_name,
        'category': case.category,
        'report_content': report.report_content,
        'status': report.status,
        'assigned_lawyer_id': lawyer.id if lawyer else None,
        'assigned_lawyer_name': f"{lawyer.first_name} {lawyer.last_name}".strip() or lawyer.username if lawyer else None,
        'review_notes': report.review_notes,
        'created_at': report.created_at,
        'updated_at': report.updated_at,
        'assigned_at': report.assigned_at,
        'reviewed_at': report.reviewed_at,
        'evidence_photos': evidence_photos if evidence_photos else None,
    }


def report_to_list_schema(report: Report) -> dict:
    """Convert Report model to list response dict."""
    case = report.case
    lawyer = report.assigned_lawyer
    return {
        'id': report.id,
        'case_number': case.case_number,
        'case_title': case.title,
        'claim_number': case.claim_number,
        'client_name': case.client_name,
        'category': case.category,
        'status': report.status,
        'assigned_lawyer_name': f"{lawyer.first_name} {lawyer.last_name}".strip() or lawyer.username if lawyer else None,
        'created_at': report.created_at,
        'assigned_at': report.assigned_at,
        'reviewed_at': report.reviewed_at,
    }


def _latest_reports_per_case_queryset():
    """Return queryset with only the latest report for each case."""
    latest_report_ids = Report.objects.values('case_id').annotate(
        latest_id=Max('id')
    ).values('latest_id')

    return Report.objects.select_related('case', 'assigned_lawyer').filter(
        id__in=Subquery(latest_report_ids)
    )


# =============================================================================
# Admin Endpoints
# =============================================================================

@router.get(
    "/reports",
    response=List[ReportListSchema],
    summary="List all reports",
    description="Get all AI-generated reports for legal review (Admin only)."
)
def list_reports(request: HttpRequest, status: Optional[str] = None):
    """List all reports with optional status filter."""
    user = request.auth

    # Only admins can access this endpoint
    if user.role not in [CustomUser.Role.ADMIN, CustomUser.Role.SUPER_ADMIN]:
        raise HttpError(403, "Access denied")

    queryset = _latest_reports_per_case_queryset()

    if status:
        queryset = queryset.filter(status=status.upper())

    queryset = queryset.order_by('-created_at', '-id')

    return [report_to_list_schema(r) for r in queryset]


@router.get(
    "/reports/stats",
    response=ReportStatsSchema,
    summary="Get report statistics",
    description="Get statistics about reports (Admin only)."
)
def get_report_stats(request: HttpRequest):
    """Get report statistics."""
    user = request.auth

    if user.role not in [CustomUser.Role.ADMIN, CustomUser.Role.SUPER_ADMIN]:
        raise HttpError(403, "Access denied")

    base_queryset = _latest_reports_per_case_queryset()

    total = base_queryset.count()
    pending = base_queryset.filter(status=Report.Status.PENDING).count()
    assigned = base_queryset.filter(status=Report.Status.ASSIGNED).count()
    accepted = base_queryset.filter(status=Report.Status.ACCEPTED).count()
    rejected = base_queryset.filter(status=Report.Status.REJECTED).count()

    return {
        'total': total,
        'pending': pending,
        'assigned': assigned,
        'accepted': accepted,
        'rejected': rejected,
    }


@router.get(
    "/reports/{report_id}",
    response=ReportSchema,
    summary="Get report details",
    description="Get a specific report by ID."
)
def get_report(request: HttpRequest, report_id: int):
    """Get a specific report."""
    user = request.auth

    try:
        report = Report.objects.select_related('case', 'assigned_lawyer').get(id=report_id)
    except Report.DoesNotExist:
        raise HttpError(404, "Report not found")

    # Check access
    if user.role in [CustomUser.Role.ADMIN, CustomUser.Role.SUPER_ADMIN]:
        pass  # Admin can access any report
    elif user.role == CustomUser.Role.LAWYER:
        if report.assigned_lawyer_id != user.id:
            raise HttpError(403, "Access denied")
    else:
        raise HttpError(403, "Access denied")

    return report_to_schema(report, request)


@router.post(
    "/reports",
    response=ReportSchema,
    summary="Create a report",
    description="Create a new AI-generated report for a case."
)
def create_report(request: HttpRequest, payload: CreateReportSchema):
    """Create a new report."""
    user = request.auth

    if user.role not in [CustomUser.Role.ADMIN, CustomUser.Role.SUPER_ADMIN]:
        raise HttpError(403, "Access denied")

    # Check if case exists (try by ID from incident-db first, then fallback to case_number lookup)
    case = None
    try:
        case = InsuranceCase.objects.get(id=payload.case_id)
    except InsuranceCase.DoesNotExist:
        # If case not found by ID, try to find it by querying the cases table and matching by case_number
        try:
            with connections['default'].cursor() as cursor:
                cursor.execute("SELECT case_number FROM cases WHERE id = %s", [payload.case_id])
                result = cursor.fetchone()
                if result:
                    case_number = result[0]
                    case = InsuranceCase.objects.get(case_number=case_number)
                    logger.info(f"Mapped incident-db case ID {payload.case_id} to insurance_case ID {case.id} via case_number {case_number}")
        except (InsuranceCase.DoesNotExist, Exception) as e:
            logger.warning(f"Could not map case ID {payload.case_id} to insurance_case: {str(e)}")
            raise HttpError(404, "Case not found")

    if not case:
        raise HttpError(404, "Case not found")

    # Create report
    report = Report.objects.create(
        case=case,
        report_content=payload.report_content,
        status=Report.Status.PENDING,
        created_by=user,
    )

    logger.info(f"Report {report.id} created for case {case.case_number} by {user.username}")

    return report_to_schema(report, request)


@router.post(
    "/reports/bulk",
    response=dict,
    summary="Bulk create reports",
    description="Migrate multiple reports from localStorage to database."
)
def bulk_create_reports(request: HttpRequest, payload: BulkCreateReportSchema):
    """Bulk create reports for migration from localStorage."""
    user = request.auth

    if user.role not in [CustomUser.Role.ADMIN, CustomUser.Role.SUPER_ADMIN]:
        raise HttpError(403, "Access denied")

    created_count = 0
    skipped_count = 0
    errors = []

    for report_data in payload.reports:
        try:
            # Check if case exists
            case = InsuranceCase.objects.get(id=report_data.case_id)

            # Check if report already exists for this case
            if Report.objects.filter(case=case).exists():
                skipped_count += 1
                continue

            # Create report
            Report.objects.create(
                case=case,
                report_content=report_data.report_content,
                status=Report.Status.PENDING,
                created_by=user,
            )
            created_count += 1
        except InsuranceCase.DoesNotExist:
            errors.append(f"Case {report_data.case_id} not found")
        except Exception as e:
            errors.append(f"Error creating report for case {report_data.case_id}: {str(e)}")

    logger.info(f"Bulk report migration: {created_count} created, {skipped_count} skipped by {user.username}")

    return {
        'created': created_count,
        'skipped': skipped_count,
        'errors': errors,
    }


@router.get(
    "/lawyers",
    response=List[LawyerSchema],
    summary="List all lawyers",
    description="Get all active lawyers for assignment (Admin only)."
)
def list_lawyers(request: HttpRequest):
    """List all lawyers for assignment dropdown."""
    user = request.auth

    if user.role not in [CustomUser.Role.ADMIN, CustomUser.Role.SUPER_ADMIN]:
        raise HttpError(403, "Access denied")

    lawyers = CustomUser.objects.filter(
        role=CustomUser.Role.LAWYER,
        is_active=True
    ).order_by('first_name', 'last_name', 'username')

    return [
        {
            'id': l.id,
            'username': l.username,
            'email': l.email,
            'first_name': l.first_name or '',
            'last_name': l.last_name or '',
            'full_name': f"{l.first_name} {l.last_name}".strip() or l.username,
        }
        for l in lawyers
    ]


@router.post(
    "/reports/{report_id}/assign",
    response=ReportSchema,
    summary="Assign lawyer to report",
    description="Assign a lawyer to review a report (Admin only)."
)
def assign_lawyer(request: HttpRequest, report_id: int, payload: AssignLawyerSchema):
    """Assign a lawyer to a report."""
    user = request.auth

    if user.role not in [CustomUser.Role.ADMIN, CustomUser.Role.SUPER_ADMIN]:
        raise HttpError(403, "Access denied")

    try:
        report = Report.objects.select_related('case', 'assigned_lawyer').get(id=report_id)
    except Report.DoesNotExist:
        raise HttpError(404, "Report not found")

    # Check if lawyer exists and has lawyer role
    try:
        lawyer = CustomUser.objects.get(id=payload.lawyer_id, role=CustomUser.Role.LAWYER)
    except CustomUser.DoesNotExist:
        raise HttpError(404, "Lawyer not found")

    if not lawyer.is_active:
        raise HttpError(400, "Lawyer is not active")

    # Assign lawyer
    report.assigned_lawyer = lawyer
    report.assigned_at = timezone.now()
    report.status = Report.Status.ASSIGNED
    report.save()

    logger.info(f"Report {report.id} assigned to lawyer {lawyer.username} by {user.username}")

    return report_to_schema(report, request)


@router.put(
    "/reports/{report_id}/content",
    response=ReportSchema,
    summary="Update report content",
    description="Update the content of a report (Admin only, before assignment or after rejection)."
)
def update_report_content(request: HttpRequest, report_id: int, payload: UpdateReportSchema):
    """Update report content."""
    user = request.auth

    if user.role not in [CustomUser.Role.ADMIN, CustomUser.Role.SUPER_ADMIN]:
        raise HttpError(403, "Access denied")

    try:
        report = Report.objects.select_related('case', 'assigned_lawyer').get(id=report_id)
    except Report.DoesNotExist:
        raise HttpError(404, "Report not found")

    # Allow editing if report is PENDING, REJECTED, or has not been reviewed yet
    if report.status not in [Report.Status.PENDING, Report.Status.REJECTED]:
        # Allow editing ASSIGNED reports too before lawyer reviews them
        pass

    report.report_content = payload.report_content
    report.updated_at = timezone.now()
    report.save()

    logger.info(f"Report {report.id} content updated by {user.username}")

    return report_to_schema(report, request)


@router.post(
    "/reports/{report_id}/reassign",
    response=ReportSchema,
    summary="Reassign rejected report",
    description="Reassign a rejected report to a different lawyer (Admin only)."
)
def reassign_report(request: HttpRequest, report_id: int, payload: ReassignReportSchema):
    """Reassign a rejected report to a different lawyer."""
    user = request.auth

    if user.role not in [CustomUser.Role.ADMIN, CustomUser.Role.SUPER_ADMIN]:
        raise HttpError(403, "Access denied")

    try:
        report = Report.objects.select_related('case', 'assigned_lawyer').get(id=report_id)
    except Report.DoesNotExist:
        raise HttpError(404, "Report not found")

    # Can only reassign rejected reports
    if report.status != Report.Status.REJECTED:
        raise HttpError(400, "Can only reassign rejected reports")

    # Check if lawyer exists and has lawyer role
    try:
        lawyer = CustomUser.objects.get(id=payload.lawyer_id, role=CustomUser.Role.LAWYER)
    except CustomUser.DoesNotExist:
        raise HttpError(404, "Lawyer not found")

    if not lawyer.is_active:
        raise HttpError(400, "Lawyer is not active")

    # Reassign lawyer
    previous_lawyer = report.assigned_lawyer
    report.assigned_lawyer = lawyer
    report.assigned_at = timezone.now()
    report.reviewed_at = None  # Reset review timestamp
    report.review_notes = ''  # Clear previous review notes
    report.status = Report.Status.ASSIGNED
    report.save()

    logger.info(f"Report {report.id} reassigned from {previous_lawyer.username if previous_lawyer else 'None'} to {lawyer.username} by {user.username}")

    return report_to_schema(report, request)


# =============================================================================
# Lawyer Endpoints
# =============================================================================

@router.get(
    "/lawyer/reports",
    response=List[ReportListSchema],
    summary="Get lawyer's assigned reports",
    description="Get all reports assigned to the current lawyer."
)
def get_lawyer_reports(request: HttpRequest, status: Optional[str] = None):
    """Get reports assigned to the current lawyer."""
    user = request.auth

    if user.role != CustomUser.Role.LAWYER:
        raise HttpError(403, "Access denied")

    queryset = Report.objects.select_related('case', 'assigned_lawyer').filter(
        assigned_lawyer=user
    )

    if status:
        queryset = queryset.filter(status=status.upper())

    return [report_to_list_schema(r) for r in queryset]


@router.get(
    "/lawyer/reports/stats",
    response=ReportStatsSchema,
    summary="Get lawyer's report statistics",
    description="Get statistics about the lawyer's assigned reports."
)
def get_lawyer_report_stats(request: HttpRequest):
    """Get lawyer's report statistics."""
    user = request.auth

    if user.role != CustomUser.Role.LAWYER:
        raise HttpError(403, "Access denied")

    base_queryset = Report.objects.filter(assigned_lawyer=user)

    total = base_queryset.count()
    pending = base_queryset.filter(status=Report.Status.PENDING).count()
    assigned = base_queryset.filter(status=Report.Status.ASSIGNED).count()
    accepted = base_queryset.filter(status=Report.Status.ACCEPTED).count()
    rejected = base_queryset.filter(status=Report.Status.REJECTED).count()

    return {
        'total': total,
        'pending': pending + assigned,  # Combine pending and assigned for "pending review"
        'assigned': assigned,
        'accepted': accepted,
        'rejected': rejected,
    }


@router.post(
    "/lawyer/reports/{report_id}/review",
    response=ReportSchema,
    summary="Review a report",
    description="Accept or reject an assigned report."
)
def review_report(request: HttpRequest, report_id: int, payload: ReviewReportSchema):
    """Accept or reject a report."""
    user = request.auth

    if user.role != CustomUser.Role.LAWYER:
        raise HttpError(403, "Access denied")

    try:
        report = Report.objects.select_related('case', 'assigned_lawyer').get(
            id=report_id,
            assigned_lawyer=user
        )
    except Report.DoesNotExist:
        raise HttpError(404, "Report not found or not assigned to you")

    action = payload.action.lower()
    if action not in ['accept', 'reject']:
        raise HttpError(400, "Invalid action. Use 'accept' or 'reject'")

    # Update report
    report.status = Report.Status.ACCEPTED if action == 'accept' else Report.Status.REJECTED
    report.reviewed_at = timezone.now()
    report.review_notes = payload.notes
    report.save()

    logger.info(f"Report {report.id} {action}ed by lawyer {user.username}")

    return report_to_schema(report, request)


class LogEntrySchema(Schema):
    """Schema for activity log entries."""
    id: int
    case_number: str
    case_title: str
    client_name: Optional[str] = None
    action: str
    review_notes: str
    reviewed_at: Optional[datetime] = None
    assigned_at: Optional[datetime] = None
    created_at: datetime


@router.get(
    "/lawyer/logs",
    response=List[LogEntrySchema],
    summary="Get lawyer's activity logs",
    description="Get activity logs for the current lawyer's reviewed reports."
)
def get_lawyer_logs(request: HttpRequest):
    """Get lawyer's activity logs."""
    user = request.auth

    if user.role != CustomUser.Role.LAWYER:
        raise HttpError(403, "Access denied")

    # Get all reports assigned to this lawyer (both reviewed and pending)
    reports = Report.objects.select_related('case').filter(
        assigned_lawyer=user
    ).order_by('-reviewed_at', '-assigned_at', '-created_at')

    logs = []
    for report in reports:
        case = report.case

        # Determine action text based on status
        if report.status == Report.Status.ACCEPTED:
            action = 'Accepted'
        elif report.status == Report.Status.REJECTED:
            action = 'Rejected'
        elif report.status == Report.Status.ASSIGNED:
            action = 'Pending Review'
        else:
            action = report.status

        logs.append({
            'id': report.id,
            'case_number': case.case_number,
            'case_title': case.title,
            'client_name': case.client_name,
            'action': action,
            'review_notes': report.review_notes or '',
            'reviewed_at': report.reviewed_at,
            'assigned_at': report.assigned_at,
            'created_at': report.created_at,
        })

    return logs


@router.delete(
    "/reports/{report_id}",
    summary="Delete Report",
    description="Delete an AI-generated report. Admin access required.",
)
def delete_report(request: HttpRequest, report_id: int):
    """Delete a report by ID."""
    user = request.auth

    # Only admins can delete reports
    if user.role not in [CustomUser.Role.ADMIN, CustomUser.Role.SUPER_ADMIN]:
        raise HttpError(403, "Access denied")

    try:
        report = Report.objects.get(id=report_id)
        case_number = report.case.case_number if report.case else 'Unknown'
        report.delete()
        logger.info(f"[API] Report {report_id} for case {case_number} deleted by user {user.username}")
        return {"success": True, "message": f"Report {report_id} deleted successfully"}
    except Report.DoesNotExist:
        raise HttpError(404, f"Report with id {report_id} not found")
    except Exception as e:
        logger.error(f"[API] Failed to delete report {report_id}: {e}")
        raise HttpError(500, f"Failed to delete report: {str(e)}")
