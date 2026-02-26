"""
Case Verification API endpoints.
"""

import logging
import os
import json
from typing import List, Optional
from datetime import datetime
from ninja import Router, Schema, File, UploadedFile
from ninja.files import UploadedFile as NinjaUploadedFile
from django.http import HttpRequest
from django.core.files.storage import default_storage
from django.core.files.base import ContentFile
from django.conf import settings
from django.db import connections

from users.models_verification import (
    CaseVerification,
    VerificationDocument,
    VerificationComment,
    ClaimantDependent
)
from users.models import InsuranceCase

logger = logging.getLogger(__name__)

router = Router(tags=["Verifications"])


# =============================================================================
# Schemas
# =============================================================================

class CreateVerificationSchema(Schema):
    """Schema for creating a verification."""
    case_id: int
    incident_case_db_id: Optional[int] = None  # ID from incident_case_db.cases for FK reference
    check_type: str
    check_status: str = 'PENDING'
    
    # Common fields for all verification types
    statement: Optional[str] = None
    observations: Optional[str] = None
    
    # Claimant fields
    claimant_name: Optional[str] = None
    claimant_contact: Optional[str] = None
    claimant_address: Optional[str] = None
    income: Optional[float] = None
    fir_number_claimant: Optional[str] = None
    court_name: Optional[str] = None
    mv_act: Optional[str] = None
    
    # Insured fields
    insured_name: Optional[str] = None
    insured_contact: Optional[str] = None
    insured_address: Optional[str] = None
    policy_number: Optional[str] = None
    policy_period: Optional[str] = None
    rc_number: Optional[str] = None
    permit_insured: Optional[str] = None
    
    # Driver fields
    driver_name: Optional[str] = None
    driver_contact: Optional[str] = None
    driver_address: Optional[str] = None
    dl_number: Optional[str] = None
    permit_driver: Optional[str] = None
    occupation: Optional[str] = None
    driver_and_insured_same: bool = False
    
    # Spot fields
    time_of_accident: Optional[str] = None
    place_of_accident: Optional[str] = None
    district: Optional[str] = None
    fir_number_spot: Optional[str] = None
    spot_city: Optional[str] = None
    police_station: Optional[str] = None
    accident_brief: Optional[str] = None
    
    # Chargesheet fields
    chargesheet_city: Optional[str] = None
    fir_delay_in_days: Optional[int] = None
    bsn_sections: Optional[str] = None
    ipc_sections: Optional[str] = None


class CreateDependentSchema(Schema):
    """Schema for creating a dependent."""
    case_id: int
    dependent_name: str
    dependent_contact: Optional[str] = None
    dependent_address: Optional[str] = None
    relationship: Optional[str] = None
    age: Optional[int] = None


class VerificationResponseSchema(Schema):
    """Response schema for verification."""
    id: int
    case_id: int
    verification_type: str
    status: str
    created_at: datetime


class DependentResponseSchema(Schema):
    """Response schema for dependent."""
    id: int
    dependent_name: str
    relationship: Optional[str]
    age: Optional[int]


class SuccessResponse(Schema):
    """Generic success response."""
    success: bool
    message: str
    id: Optional[int] = None


class ErrorResponse(Schema):
    """Generic error response."""
    error: str
    details: Optional[str] = None


# =============================================================================
# Endpoints
# =============================================================================

@router.post(
    "/verifications",
    response={200: VerificationResponseSchema, 400: ErrorResponse, 403: ErrorResponse},
    summary="Create Verification",
    description="Create a new verification record for a case.",
)
def create_verification(request: HttpRequest, payload: CreateVerificationSchema):
    """Create a new verification."""
    try:
        # Get the case
        try:
            case = InsuranceCase.objects.get(id=payload.case_id)
        except InsuranceCase.DoesNotExist:
            return 400, {"error": "Case not found"}
        
        # Map check_type to verification_type
        type_mapping = {
            'CLAIMANT': 'CLAIMANT_CHECK',
            'INSURED': 'INSURED_CHECK',
            'DRIVER': 'DRIVER_CHECK',
            'SPOT': 'SPOT_CHECK',
            'CHARGESHEET': 'CHARGESHEET',
        }
        
        verification_type = type_mapping.get(payload.check_type, payload.check_type)
        
        # Check if verification already exists
        existing = CaseVerification.objects.filter(
            case=case,
            verification_type=verification_type
        ).first()
        
        if existing:
            # Update existing
            for field, value in payload.dict().items():
                if field not in ['case_id', 'check_type'] and value is not None:
                    setattr(existing, field, value)
            existing.check_status = payload.check_status
            existing.save()
            verification = existing
        else:
            # Create new
            verification = CaseVerification.objects.create(
                case=case,
                verification_type=verification_type,
                check_status=payload.check_status,
                status='PENDING',
                
                # Common fields
                statement=payload.statement or '',
                observations=payload.observations or '',
                
                # Claimant fields
                claimant_name=payload.claimant_name or '',
                claimant_contact=payload.claimant_contact or '',
                claimant_address=payload.claimant_address or '',
                income=payload.income,
                fir_number_claimant=payload.fir_number_claimant or '',
                court_name=payload.court_name or '',
                mv_act=payload.mv_act or '',
                
                # Insured fields
                insured_name=payload.insured_name or '',
                insured_contact=payload.insured_contact or '',
                insured_address=payload.insured_address or '',
                policy_number=payload.policy_number or '',
                policy_period=payload.policy_period or '',
                rc_number=payload.rc_number or '',
                permit_insured=payload.permit_insured or '',
                
                # Driver fields
                driver_name=payload.driver_name or '',
                driver_contact=payload.driver_contact or '',
                driver_address=payload.driver_address or '',
                dl_number=payload.dl_number or '',
                permit_driver=payload.permit_driver or '',
                occupation=payload.occupation or '',
                driver_and_insured_same=payload.driver_and_insured_same,
                
                # Spot fields
                time_of_accident=payload.time_of_accident or '',
                place_of_accident=payload.place_of_accident or '',
                district=payload.district or '',
                fir_number_spot=payload.fir_number_spot or '',
                police_station=payload.police_station or '',
                accident_brief=payload.accident_brief or '',
                
                # Chargesheet fields
                fir_delay_in_days=payload.fir_delay_in_days,
                bsn_sections=payload.bsn_sections or '',
                ipc_sections=payload.ipc_sections or '',
            )
        
        logger.info(f"Verification created: {verification.id} for case {case.case_number}")
        
        # ---- Also write to incident_case_db (correct table per type) ----
        # Use the incident_case_db case id (auto-generated, passed from frontend)
        db2_case_id = payload.incident_case_db_id
        if db2_case_id:
            try:
                from users.incident_case_db import (
                    insert_claimant_check, insert_insured_check,
                    insert_driver_check, insert_spot_check,
                    insert_chargesheet,
                )
                
                if verification_type == 'CLAIMANT_CHECK':
                    insert_claimant_check(
                        case_id=db2_case_id,
                        claimant_name=payload.claimant_name or '',
                        claimant_contact=payload.claimant_contact or '',
                        claimant_address=payload.claimant_address or '',
                        claimant_income=payload.income,
                        check_status=payload.check_status,
                        statement=payload.statement or '',
                        observation=payload.observations or '',
                    )
                elif verification_type == 'INSURED_CHECK':
                    insert_insured_check(
                        case_id=db2_case_id,
                        insured_name=payload.insured_name or '',
                        insured_contact=payload.insured_contact or '',
                        insured_address=payload.insured_address or '',
                        policy_number=payload.policy_number or '',
                        policy_period=payload.policy_period or '',
                        rc=payload.rc_number or '',
                        permit=payload.permit_insured or '',
                        check_status=payload.check_status,
                        statement=payload.statement or '',
                        observation=payload.observations or '',
                    )
                elif verification_type == 'DRIVER_CHECK':
                    insert_driver_check(
                        case_id=db2_case_id,
                        driver_name=payload.driver_name or '',
                        driver_contact=payload.driver_contact or '',
                        driver_address=payload.driver_address or '',
                        dl=payload.dl_number or '',
                        permit=payload.permit_driver or '',
                        occupation=payload.occupation or '',
                        check_status=payload.check_status,
                        statement=payload.statement or '',
                        observation=payload.observations or '',
                    )
                elif verification_type == 'SPOT_CHECK':
                    insert_spot_check(
                        case_id=db2_case_id,
                        time_of_accident=payload.time_of_accident or '',
                        place_of_accident=payload.place_of_accident or '',
                        district=payload.district or '',
                        fir_number=payload.fir_number_spot or '',
                        city=payload.spot_city or '',
                        police_station=payload.police_station or '',
                        accident_brief=payload.accident_brief or '',
                        check_status=payload.check_status,
                        observations=payload.observations or '',
                    )
                elif verification_type == 'CHARGESHEET':
                    insert_chargesheet(
                        case_id=db2_case_id,
                        fir_number=payload.fir_number_claimant or '',
                        city=payload.chargesheet_city or '',
                        court_name=payload.court_name or '',
                        mv_act=payload.mv_act or '',
                        fir_delay_days=payload.fir_delay_in_days,
                        bsn_section=payload.bsn_sections or '',
                        ipc=payload.ipc_sections or '',
                        check_status=payload.check_status,
                        statement=payload.statement or '',
                        observations=payload.observations or '',
                    )
            except Exception as db2_err:
                logger.error(f"Failed to write verification to incident_case_db: {db2_err}")
                # Non-fatal: primary record already saved
        else:
            logger.warning("No incident_case_db_id provided, skipping dual write for verification")
        
        return 200, {
            "id": verification.id,
            "case_id": case.id,
            "verification_type": verification.verification_type,
            "status": verification.status,
            "created_at": verification.created_at,
        }
        
    except Exception as e:
        logger.error(f"Error creating verification: {str(e)}")
        return 400, {"error": "Failed to create verification", "details": str(e)}


@router.post(
    "/verifications/dependents",
    response={200: DependentResponseSchema, 400: ErrorResponse},
    summary="Create Dependent",
    description="Create a claimant dependent record.",
)
def create_dependent(request: HttpRequest, payload: CreateDependentSchema):
    """Create a claimant dependent."""
    try:
        # Get the case
        try:
            case = InsuranceCase.objects.get(id=payload.case_id)
        except InsuranceCase.DoesNotExist:
            return 400, {"error": "Case not found"}
        
        # Create dependent
        dependent = ClaimantDependent.objects.create(
            case=case,
            dependent_name=payload.dependent_name,
            dependent_contact=payload.dependent_contact or '',
            dependent_address=payload.dependent_address or '',
            relationship=payload.relationship or '',
            age=payload.age,
        )
        
        logger.info(f"Dependent created: {dependent.id} for case {case.case_number}")
        
        # ---- Also update claimant_checks.dependants JSONB in incident_case_db ----
        try:
            with connections['default'].cursor() as cursor:
                # Find the claimant_checks row via claim_number -> cases.id
                cursor.execute("""
                    SELECT cc.id, cc.dependants
                    FROM claimant_checks cc
                    JOIN cases c ON c.id = cc.case_id
                    WHERE c.claim_number = %s
                    LIMIT 1
                """, [case.claim_number])
                row = cursor.fetchone()
                if row:
                    check_id = row[0]
                    existing = []
                    if row[1]:
                        try:
                            existing = json.loads(row[1]) if isinstance(row[1], str) else row[1]
                        except (json.JSONDecodeError, TypeError):
                            existing = []
                    dep_entry = {
                        "dependent_name": payload.dependent_name,
                        "dependent_contact": payload.dependent_contact or '',
                        "dependent_address": payload.dependent_address or '',
                        "relationship": payload.relationship or '',
                        "age": payload.age,
                    }
                    existing.append(dep_entry)
                    cursor.execute("""
                        UPDATE claimant_checks
                        SET dependants = %s::jsonb, updated_at = NOW()
                        WHERE id = %s
                    """, [json.dumps(existing), check_id])
                    logger.info(f"[incident_case_db] Updated claimant_checks.dependants for check_id={check_id}")
        except Exception as db_err:
            logger.error(f"Failed to sync dependent to incident_case_db: {db_err}")
            # Non-fatal: primary ORM record already saved
        
        return 200, {
            "id": dependent.id,
            "dependent_name": dependent.dependent_name,
            "relationship": dependent.relationship,
            "age": dependent.age,
        }
        
    except Exception as e:
        logger.error(f"Error creating dependent: {str(e)}")
        return 400, {"error": "Failed to create dependent", "details": str(e)}


@router.post(
    "/verifications/{verification_id}/upload",
    response={200: SuccessResponse, 400: ErrorResponse},
    summary="Upload Verification Documents",
    description="Upload documents for a verification.",
)
def upload_verification_documents(
    request: HttpRequest,
    verification_id: int,
    files: List[UploadedFile] = File(...)
):
    """Upload documents for a verification."""
    try:
        # Get verification
        try:
            verification = CaseVerification.objects.get(id=verification_id)
        except CaseVerification.DoesNotExist:
            return 400, {"error": "Verification not found"}
        
        uploaded_count = 0
        uploaded_docs = []  # Track for syncing to check table
        for file in files:
            # Generate file path
            file_extension = os.path.splitext(file.name)[1]
            file_path = f'verification_documents/{verification.case.case_number}/{verification.verification_type}/{file.name}'
            
            # Save file
            saved_path = default_storage.save(file_path, ContentFile(file.read()))
            
            # Create document record
            VerificationDocument.objects.create(
                verification=verification,
                document_type='SCAN',  # Default type
                title=file.name,
                file_path=saved_path,
                file_name=file.name,
                file_size=file.size,
                mime_type=file.content_type or '',
                uploaded_by=request.user if request.user.is_authenticated else None,
            )
            uploaded_count += 1
            uploaded_docs.append({
                "filename": file.name,
                "url": f'/media/{saved_path}',
                "size": file.size,
                "mime_type": file.content_type or '',
                "uploaded_at": datetime.now().isoformat(),
            })
        
        logger.info(f"Uploaded {uploaded_count} documents for verification {verification_id}")
        
        # ---- Also update the corresponding check table's documents JSONB ----
        _TYPE_TO_TABLE = {
            'CLAIMANT_CHECK': 'claimant_checks',
            'INSURED_CHECK': 'insured_checks',
            'DRIVER_CHECK': 'driver_checks',
            'SPOT_CHECK': 'spot_checks',
            'CHARGESHEET': 'chargesheets',
        }
        table = _TYPE_TO_TABLE.get(verification.verification_type)
        if table and uploaded_docs:
            try:
                claim_number = verification.case.claim_number
                with connections['default'].cursor() as cursor:
                    cursor.execute(f"""
                        SELECT ct.id, ct.documents
                        FROM {table} ct
                        JOIN cases c ON c.id = ct.case_id
                        WHERE c.claim_number = %s
                        LIMIT 1
                    """, [claim_number])
                    row = cursor.fetchone()
                    if row:
                        check_id = row[0]
                        existing = []
                        if row[1]:
                            try:
                                existing = json.loads(row[1]) if isinstance(row[1], str) else row[1]
                            except (json.JSONDecodeError, TypeError):
                                existing = []
                        existing.extend(uploaded_docs)
                        cursor.execute(f"""
                            UPDATE {table}
                            SET documents = %s::jsonb, updated_at = NOW()
                            WHERE id = %s
                        """, [json.dumps(existing), check_id])
                        logger.info(f"[incident_case_db] Updated {table}.documents for check_id={check_id}, {len(uploaded_docs)} doc(s)")
            except Exception as db_err:
                logger.error(f"Failed to sync documents to incident_case_db: {db_err}")
                # Non-fatal: primary ORM records already saved
        
        return 200, {
            "success": True,
            "message": f"Successfully uploaded {uploaded_count} document(s)",
        }
        
    except Exception as e:
        logger.error(f"Error uploading documents: {str(e)}")
        return 400, {"error": "Failed to upload documents", "details": str(e)}
