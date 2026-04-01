"""
Reports API endpoints for legal review system.
"""

import logging
from typing import List, Optional
from datetime import datetime
from ninja import Router, Schema
from ninja.errors import HttpError
from django.http import HttpRequest
from django.utils import timezone
from django.db import connections

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

def report_to_schema(report: Report) -> dict:
    """Convert Report model to response dict."""
    case = report.case
    lawyer = report.assigned_lawyer
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

    queryset = Report.objects.select_related('case', 'assigned_lawyer').all()

    if status:
        queryset = queryset.filter(status=status.upper())

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

    total = Report.objects.count()
    pending = Report.objects.filter(status=Report.Status.PENDING).count()
    assigned = Report.objects.filter(status=Report.Status.ASSIGNED).count()
    accepted = Report.objects.filter(status=Report.Status.ACCEPTED).count()
    rejected = Report.objects.filter(status=Report.Status.REJECTED).count()

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

    return report_to_schema(report)


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

    return report_to_schema(report)


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

    return report_to_schema(report)


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

    return report_to_schema(report)


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
