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

class QCSchema(Schema):
    """QC response schema for assignment dropdown."""
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
    assigned_qc_id: Optional[int] = None
    assigned_qc_name: Optional[str] = None
    review_notes: str
    created_at: datetime
    updated_at: datetime
    assigned_at: Optional[datetime] = None
    reviewed_at: Optional[datetime] = None
    evidence_photos: Optional[List[dict]] = None
    vendor_documents: Optional[List[dict]] = None
    case_documents: Optional[List[dict]] = None


class ReportListSchema(Schema):
    """Report list response with case details."""
    id: int
    case_number: str
    case_title: str
    claim_number: Optional[str] = None
    client_name: Optional[str] = None
    category: str
    status: str
    assigned_qc_name: Optional[str] = None
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


class AssignQCSchema(Schema):
    """Schema for assigning a qc to a report."""
    qc_id: int


class ReviewReportSchema(Schema):
    """Schema for accepting/rejecting a report."""
    action: str  # 'accept' or 'reject'
    notes: str = ''


class UpdateReportSchema(Schema):
    """Schema for updating report content."""
    report_content: str


class ReassignReportSchema(Schema):
    """Schema for reassigning a rejected report to a new qc."""
    qc_id: int


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


def _collect_report_evidence_photos(
    request: HttpRequest,
    case_id: int,
    fallback_location_name: str = "",
) -> List[dict]:
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

                    normalized = _enrich_evidence_metadata(
                        request,
                        evidence_item,
                        fallback_location_name=fallback_location_name,
                    )
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


def _resolve_incident_case_id(case: InsuranceCase) -> Optional[int]:
    """Resolve incident-db case id using case_number when ORM id differs."""
    try:
        with connections['default'].cursor() as cursor:
            cursor.execute("SELECT id FROM cases WHERE case_number = %s", [case.case_number])
            row = cursor.fetchone()
            return row[0] if row else None
    except Exception as exc:
        logger.debug(f"Failed to resolve incident case id for {case.case_number}: {exc}")
        return None


def _get_fallback_location_name(
    case: InsuranceCase,
    incident_case_id: Optional[int],
) -> str:
    """Fetch a fallback location string from incident-db or ORM fields."""
    def _clean_location(value: Optional[str]) -> str:
        text = str(value or "").strip()
        if not text:
            return ""
        if text.lower() == "india":
            return ""
        return text

    row = None
    try:
        with connections['default'].cursor() as cursor:
            if incident_case_id:
                cursor.execute(
                    """
                    SELECT incident_location, claimant_address, insured_address
                    FROM cases
                    WHERE id = %s
                    """,
                    [incident_case_id],
                )
                row = cursor.fetchone()

            if not row:
                cursor.execute(
                    """
                    SELECT incident_location, claimant_address, insured_address
                    FROM cases
                    WHERE case_number = %s
                    """,
                    [case.case_number],
                )
                row = cursor.fetchone()
    except Exception as exc:
        logger.debug(f"Failed to load fallback location for {case.case_number}: {exc}")
        row = None

    if row:
        for value in row:
            text = _clean_location(value)
            if text:
                return text

    if incident_case_id:
        try:
            with connections['default'].cursor() as cursor:
                cursor.execute(
                    """
                    SELECT place_of_accident, district, spot_city, police_station
                    FROM spot_checks
                    WHERE case_id = %s
                    ORDER BY id
                    LIMIT 1
                    """,
                    [incident_case_id],
                )
                spot_row = cursor.fetchone()
        except Exception as exc:
            logger.debug(f"Failed to load spot location for {case.case_number}: {exc}")
            spot_row = None

        if spot_row:
            parts = [_clean_location(value) for value in spot_row if _clean_location(value)]
            if parts:
                return ', '.join(parts)

        try:
            with connections['default'].cursor() as cursor:
                cursor.execute(
                    """
                    SELECT claimant_address
                    FROM claimant_checks
                    WHERE case_id = %s
                      AND claimant_address IS NOT NULL
                    ORDER BY id
                    LIMIT 1
                    """,
                    [incident_case_id],
                )
                claimant_row = cursor.fetchone()
        except Exception as exc:
            logger.debug(f"Failed to load claimant address for {case.case_number}: {exc}")
            claimant_row = None

        if claimant_row:
            claimant_address = _clean_location(claimant_row[0])
            if claimant_address:
                return claimant_address

        try:
            with connections['default'].cursor() as cursor:
                cursor.execute(
                    """
                    SELECT insured_address
                    FROM insured_checks
                    WHERE case_id = %s
                      AND insured_address IS NOT NULL
                    ORDER BY id
                    LIMIT 1
                    """,
                    [incident_case_id],
                )
                insured_row = cursor.fetchone()
        except Exception as exc:
            logger.debug(f"Failed to load insured address for {case.case_number}: {exc}")
            insured_row = None

        if insured_row:
            insured_address = _clean_location(insured_row[0])
            if insured_address:
                return insured_address

    incident_parts = [
        str(case.incident_city or '').strip(),
        str(case.incident_state or '').strip(),
        str(case.incident_postal_code or '').strip(),
    ]
    incident_compact = ', '.join([part for part in incident_parts if part])

    orm_candidates = [
        case.formatted_address,
        case.incident_address,
        incident_compact,
    ]
    for value in orm_candidates:
        text = _clean_location(value)
        if text:
            return text
    return ""


def report_to_schema(report: Report, request: Optional[HttpRequest] = None) -> dict:
    """Convert Report model to response dict."""
    case = report.case
    qc = report.assigned_qc
    incident_case_id = _resolve_incident_case_id(case) or case.id
    fallback_location_name = _get_fallback_location_name(case, incident_case_id)
    evidence_photos = (
        _collect_report_evidence_photos(
            request,
            incident_case_id,
            fallback_location_name=fallback_location_name,
        )
        if request
        else []
    )
    vendor_documents = []
    case_documents = []
    try:
        from users.api.cases import _fetch_ai_brief_case_context
        ctx = _fetch_ai_brief_case_context(incident_case_id)
        if ctx:
            for doc in ctx.get('vendor_documents', []):
                doc_url = doc.get('url') or doc.get('file_url') or doc.get('document_url') or doc.get('path')
                if doc_url:
                    vendor_documents.append({
                        'filename': doc.get('filename') or doc.get('name') or 'Vendor Document',
                        'url': request.build_absolute_uri(doc_url) if request and not doc_url.startswith('http') else doc_url
                    })
            for doc in ctx.get('case_documents', []):
                doc_url = doc.get('url') or doc.get('file_url') or doc.get('document_url') or doc.get('path')
                if doc_url:
                    case_documents.append({
                        'filename': doc.get('filename') or doc.get('name') or 'Case Document',
                        'url': request.build_absolute_uri(doc_url) if request and not doc_url.startswith('http') else doc_url
                    })
            if ctx.get('policy_document'):
                case_documents.append({
                    'filename': 'Policy Document',
                    'url': request.build_absolute_uri(str(ctx['policy_document'])) if request and not str(ctx['policy_document']).startswith('http') else str(ctx['policy_document'])
                })
            if ctx.get('petition_document'):
                case_documents.append({
                    'filename': 'Petition Document',
                    'url': request.build_absolute_uri(str(ctx['petition_document'])) if request and not str(ctx['petition_document']).startswith('http') else str(ctx['petition_document'])
                })
            if ctx.get('other_document'):
                case_documents.append({
                    'filename': 'Other Document',
                    'url': request.build_absolute_uri(str(ctx['other_document'])) if request and not str(ctx['other_document']).startswith('http') else str(ctx['other_document'])
                })
    except Exception as exc:
        logger.warning(f"Failed to fetch documents for report {report.id}: {exc}")

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
        'assigned_qc_id': qc.id if qc else None,
        'assigned_qc_name': f"{qc.first_name} {qc.last_name}".strip() or qc.username if qc else None,
        'review_notes': report.review_notes,
        'created_at': report.created_at,
        'updated_at': report.updated_at,
        'assigned_at': report.assigned_at,
        'reviewed_at': report.reviewed_at,
        'evidence_photos': evidence_photos if evidence_photos else None,
        'vendor_documents': vendor_documents if vendor_documents else None,
        'case_documents': case_documents if case_documents else None,
    }


def report_to_list_schema(report: Report) -> dict:
    """Convert Report model to list response dict."""
    case = report.case
    qc = report.assigned_qc
    return {
        'id': report.id,
        'case_number': case.case_number,
        'case_title': case.title,
        'claim_number': case.claim_number,
        'client_name': case.client_name,
        'category': case.category,
        'status': report.status,
        'assigned_qc_name': f"{qc.first_name} {qc.last_name}".strip() or qc.username if qc else None,
        'created_at': report.created_at,
        'assigned_at': report.assigned_at,
        'reviewed_at': report.reviewed_at,
    }


def _latest_reports_per_case_queryset():
    """Return queryset with only the latest report for each case."""
    active_case_numbers = _verified_incident_case_numbers()
    if not active_case_numbers:
        return Report.objects.none()

    latest_report_ids = Report.objects.values('case_id').annotate(
        latest_id=Max('id')
    ).values('latest_id')

    return Report.objects.select_related('case', 'assigned_qc').filter(
        id__in=Subquery(latest_report_ids),
        case__case_number__in=active_case_numbers,
    )


def _active_incident_case_numbers() -> List[str]:
    """Case numbers currently present in the incident cases table."""
    try:
        with connections['default'].cursor() as cursor:
            cursor.execute("SELECT case_number FROM cases")
            return [row[0] for row in cursor.fetchall() if row and row[0]]
    except Exception as exc:
        logger.error(f"Failed to fetch active incident case numbers: {exc}")
        return []


def _verified_incident_case_numbers() -> List[str]:
    """Case numbers where ALL vendor checks have status 'Verified'.

    This mirrors the AI Brief page filter so that the Legal Review page
    only displays cases whose AI reports are genuinely generated.
    """
    check_tables = [
        'claimant_checks',
        'insured_checks',
        'driver_checks',
        'spot_checks',
        'chargesheets',
    ]

    try:
        with connections['default'].cursor() as cursor:
            # Get all case ids and their case_numbers
            cursor.execute("SELECT id, case_number FROM cases")
            all_cases = {row[0]: row[1] for row in cursor.fetchall() if row and row[0]}

            if not all_cases:
                return []

            case_ids = list(all_cases.keys())
            ph = ",".join(["%s"] * len(case_ids))

            verified_case_ids = set(case_ids)

            for table in check_tables:
                try:
                    cursor.execute(
                        f"""
                        SELECT DISTINCT case_id
                        FROM {table}
                        WHERE case_id IN ({ph})
                          AND (
                              check_status IS NULL
                              OR check_status NOT IN ('Verified')
                          )
                        """,
                        case_ids,
                    )
                    non_verified = {row[0] for row in cursor.fetchall()}
                    verified_case_ids -= non_verified
                except Exception:
                    pass

            # Also exclude cases that have NO checks at all
            cases_with_checks = set()
            for table in check_tables:
                try:
                    cursor.execute(
                        f"SELECT DISTINCT case_id FROM {table} WHERE case_id IN ({ph})",
                        case_ids,
                    )
                    cases_with_checks.update(row[0] for row in cursor.fetchall())
                except Exception:
                    pass

            verified_case_ids &= cases_with_checks

            return [all_cases[cid] for cid in verified_case_ids if cid in all_cases]

    except Exception as exc:
        logger.error(f"Failed to fetch verified incident case numbers: {exc}")
        return []



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
        report = Report.objects.select_related('case', 'assigned_qc').get(id=report_id)
    except Report.DoesNotExist:
        raise HttpError(404, "Report not found")

    # Check access
    if user.role in [CustomUser.Role.ADMIN, CustomUser.Role.SUPER_ADMIN]:
        pass  # Admin can access any report
    elif user.role == CustomUser.Role.QC:
        if report.assigned_qc_id != user.id:
            raise HttpError(403, "Access denied")
    else:
        raise HttpError(403, "Access denied")

    return report_to_schema(report, request)


def _get_insurance_case_by_incident_case_id(incident_case_id: int) -> Optional[InsuranceCase]:
    """
    Find InsuranceCase for a given incident-db cases table ID.
    Always maps via case_number in cases table first to avoid ID collision between tables.
    """
    case_number = None
    try:
        with connections['default'].cursor() as cursor:
            cursor.execute("SELECT case_number FROM cases WHERE id = %s", [incident_case_id])
            res = cursor.fetchone()
            if res and res[0]:
                case_number = res[0]
    except Exception as e:
        logger.warning(f"Error querying cases table for ID {incident_case_id}: {e}")

    if case_number:
        try:
            return InsuranceCase.objects.get(case_number=case_number)
        except InsuranceCase.DoesNotExist:
            logger.warning(f"InsuranceCase not found for case_number {case_number}")

    # Fallback to direct ID lookup if no case_number match found
    try:
        return InsuranceCase.objects.get(id=incident_case_id)
    except InsuranceCase.DoesNotExist:
        return None


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

    case = _get_insurance_case_by_incident_case_id(payload.case_id)

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
    "/reports/bulk/",
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
            case = _get_insurance_case_by_incident_case_id(report_data.case_id)
            
            if not case:
                errors.append(f"Case {report_data.case_id} not found")
                continue

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
    "/qcs",
    response=List[QCSchema],
    summary="List all qcs",
    description="Get all active qcs for assignment (Admin only)."
)
def list_qcs(request: HttpRequest):
    """List all qcs for assignment dropdown."""
    user = request.auth

    if user.role not in [CustomUser.Role.ADMIN, CustomUser.Role.SUPER_ADMIN]:
        raise HttpError(403, "Access denied")

    qcs = CustomUser.objects.filter(
        role=CustomUser.Role.QC,
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
        for l in qcs
    ]


@router.post(
    "/reports/{report_id}/assign",
    response=ReportSchema,
    summary="Assign qc to report",
    description="Assign a qc to review a report (Admin only)."
)
def assign_qc(request: HttpRequest, report_id: int, payload: AssignQCSchema):
    """Assign a qc to a report."""
    user = request.auth

    if user.role not in [CustomUser.Role.ADMIN, CustomUser.Role.SUPER_ADMIN]:
        raise HttpError(403, "Access denied")

    try:
        report = Report.objects.select_related('case', 'assigned_qc').get(id=report_id)
    except Report.DoesNotExist:
        raise HttpError(404, "Report not found")

    # Check if qc exists and has qc role
    try:
        qc = CustomUser.objects.get(id=payload.qc_id, role=CustomUser.Role.QC)
    except CustomUser.DoesNotExist:
        raise HttpError(404, "QC not found")

    if not qc.is_active:
        raise HttpError(400, "QC is not active")

    # Assign qc
    report.assigned_qc = qc
    report.assigned_at = timezone.now()
    report.status = Report.Status.ASSIGNED
    report.save()

    logger.info(f"Report {report.id} assigned to qc {qc.username} by {user.username}")

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
        report = Report.objects.select_related('case', 'assigned_qc').get(id=report_id)
    except Report.DoesNotExist:
        raise HttpError(404, "Report not found")

    # Allow editing if report is PENDING, REJECTED, or has not been reviewed yet
    if report.status not in [Report.Status.PENDING, Report.Status.REJECTED]:
        # Allow editing ASSIGNED reports too before qc reviews them
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
    description="Reassign a rejected report to a different qc (Admin only)."
)
def reassign_report(request: HttpRequest, report_id: int, payload: ReassignReportSchema):
    """Reassign a rejected report to a different qc."""
    user = request.auth

    if user.role not in [CustomUser.Role.ADMIN, CustomUser.Role.SUPER_ADMIN]:
        raise HttpError(403, "Access denied")

    try:
        report = Report.objects.select_related('case', 'assigned_qc').get(id=report_id)
    except Report.DoesNotExist:
        raise HttpError(404, "Report not found")

    # Can only reassign rejected reports
    if report.status != Report.Status.REJECTED:
        raise HttpError(400, "Can only reassign rejected reports")

    # Check if qc exists and has qc role
    try:
        qc = CustomUser.objects.get(id=payload.qc_id, role=CustomUser.Role.QC)
    except CustomUser.DoesNotExist:
        raise HttpError(404, "QC not found")

    if not qc.is_active:
        raise HttpError(400, "QC is not active")

    # Reassign qc
    previous_qc = report.assigned_qc
    report.assigned_qc = qc
    report.assigned_at = timezone.now()
    report.reviewed_at = None  # Reset review timestamp
    report.review_notes = ''  # Clear previous review notes
    report.status = Report.Status.ASSIGNED
    report.save()

    logger.info(f"Report {report.id} reassigned from {previous_qc.username if previous_qc else 'None'} to {qc.username} by {user.username}")

    return report_to_schema(report, request)


# =============================================================================
# QC Endpoints
# =============================================================================

@router.get(
    "/qc/reports",
    response=List[ReportListSchema],
    summary="Get qc's assigned reports",
    description="Get all reports assigned to the current qc."
)
def get_qc_reports(request: HttpRequest, status: Optional[str] = None):
    """Get reports assigned to the current qc."""
    user = request.auth

    if user.role != CustomUser.Role.QC:
        raise HttpError(403, "Access denied")

    active_case_numbers = _active_incident_case_numbers()
    if not active_case_numbers:
        return []

    queryset = Report.objects.select_related('case', 'assigned_qc').filter(
        assigned_qc=user,
        case__case_number__in=active_case_numbers,
    )

    if status:
        queryset = queryset.filter(status=status.upper())

    return [report_to_list_schema(r) for r in queryset]


@router.get(
    "/qc/reports/stats",
    response=ReportStatsSchema,
    summary="Get qc's report statistics",
    description="Get statistics about the qc's assigned reports."
)
def get_qc_report_stats(request: HttpRequest):
    """Get qc's report statistics."""
    user = request.auth

    if user.role != CustomUser.Role.QC:
        raise HttpError(403, "Access denied")

    active_case_numbers = _active_incident_case_numbers()
    base_queryset = Report.objects.filter(
        assigned_qc=user,
        case__case_number__in=active_case_numbers,
    ) if active_case_numbers else Report.objects.none()

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
    "/qc/reports/{report_id}/review",
    response=ReportSchema,
    summary="Review a report",
    description="Accept or reject an assigned report."
)
def review_report(request: HttpRequest, report_id: int, payload: ReviewReportSchema):
    """Approve or reject a report."""
    user = request.auth

    if user.role != CustomUser.Role.QC:
        raise HttpError(403, "Access denied")

    try:
        report = Report.objects.select_related('case', 'assigned_qc').get(
            id=report_id,
            assigned_qc=user
        )
    except Report.DoesNotExist:
        raise HttpError(404, "Report not found or not assigned to you")

    action = payload.action.lower()
    if action not in ['accept', 'reject']:
        raise HttpError(400, "Invalid action. Use 'accept' or 'reject'")
    notes = str(payload.notes or '').strip()
    if not notes:
        raise HttpError(400, "Review notes are mandatory")

    # Update report
    report.status = Report.Status.ACCEPTED if action == 'accept' else Report.Status.REJECTED
    report.reviewed_at = timezone.now()
    report.review_notes = notes
    report.save()

    action_label = "approved" if action == 'accept' else 'rejected'
    logger.info(f"Report {report.id} {action_label} by qc {user.username}")

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
    "/qc/logs",
    response=List[LogEntrySchema],
    summary="Get qc's activity logs",
    description="Get activity logs for the current qc's reviewed reports."
)
def get_qc_logs(request: HttpRequest):
    """Get qc's activity logs."""
    user = request.auth

    if user.role != CustomUser.Role.QC:
        raise HttpError(403, "Access denied")

    # Get all reports assigned to this qc (both reviewed and pending)
    reports = Report.objects.select_related('case').filter(
        assigned_qc=user
    ).order_by('-reviewed_at', '-assigned_at', '-created_at')

    logs = []
    for report in reports:
        case = report.case

        # Determine action text based on status
        if report.status == Report.Status.ACCEPTED:
            action = 'Approved'
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
