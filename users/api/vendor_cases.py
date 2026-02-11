"""
Vendor cases API endpoints.
Endpoints for vendors to manage their assigned cases.
"""

import logging
from typing import List, Optional
from datetime import datetime
from ninja import Router, Schema
from django.db import connection
from django.http import HttpRequest
from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import UploadedFile

logger = logging.getLogger(__name__)

User = get_user_model()
router = Router(tags=["Vendor Cases"])


# =============================================================================
# Schemas
# =============================================================================

class CaseSchema(Schema):
    """Case response schema."""
    id: int
    case_number: str
    title: str
    description: str
    status: str
    priority: str
    category: str
    claim_number: str
    claimant_name: str
    insured_name: str
    client_code: str
    incident_address: str
    incident_city: str
    incident_state: str
    incident_country: str
    incident_postal_code: str
    formatted_address: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    assigned_vendor_id: Optional[int] = None
    assigned_vendor: Optional[str] = None
    client_id: int
    created_by_id: Optional[int] = None
    created_at: datetime
    updated_at: datetime
    resolved_at: Optional[datetime] = None
    closed_at: Optional[datetime] = None
    source: str
    workflow_type: str
    investigation_progress: int


class VendorCasesListResponse(Schema):
    """Vendor cases list response."""
    cases: List[CaseSchema]
    total: int
    statistics: dict


# =============================================================================
# Helper Functions
# =============================================================================

def dict_fetchall(cursor):
    """Convert database cursor results to list of dicts."""
    columns = [col[0] for col in cursor.description]
    return [
        dict(zip(columns, row))
        for row in cursor.fetchall()
    ]


def get_vendor_id_from_user(user):
    """Get vendor ID from authenticated user."""
    if not user.is_authenticated or user.role != 'VENDOR':
        return None
    
    try:
        from users.models import Vendor
        vendor = Vendor.objects.get(user=user)
        return vendor.id
    except Exception as e:
        logger.error(f"Failed to get vendor ID for user {user.id}: {e}")
        return None


# =============================================================================
# Endpoints
# =============================================================================

@router.get(
    "/vendor-cases",
    response=VendorCasesListResponse,
    summary="Get Vendor's Assigned Cases",
    description="Retrieve all cases assigned to the authenticated vendor.",
)
def get_vendor_cases(
    request: HttpRequest,
    page: int = 1,
    page_size: int = 20,
    status: Optional[str] = None,
    search: Optional[str] = None,
):
    """
    Get all cases assigned to the authenticated vendor.
    
    Filters:
    - status: Filter by case status (OPEN, IN_PROGRESS, RESOLVED, CLOSED)
    - search: Search in title, description, case_number, claim_number
    """
    if not request.user.is_authenticated:
        return 401, {"error": "Not authenticated"}
    
    if request.user.role != 'VENDOR':
        return 403, {"error": "Vendor access required"}
    
    vendor_id = get_vendor_id_from_user(request.user)
    if not vendor_id:
        return 403, {"error": "Vendor profile not found"}
    
    try:
        with connection.cursor() as cursor:
            # Build WHERE clause
            where_conditions = [f"assigned_vendor_id = {vendor_id}"]
            params = []
            
            if status:
                where_conditions.append("status = %s")
                params.append(status)
            
            if search:
                where_conditions.append(
                    "(title ILIKE %s OR description ILIKE %s OR case_number ILIKE %s OR claim_number ILIKE %s)"
                )
                search_param = f"%{search}%"
                params.extend([search_param, search_param, search_param, search_param])
            
            where_clause = " AND ".join(where_conditions)
            
            # Get total count
            count_query = f"SELECT COUNT(*) FROM cases_case WHERE {where_clause}"
            cursor.execute(count_query, params)
            total = cursor.fetchone()[0]
            
            # Get paginated data
            offset = (page - 1) * page_size
            data_query = f"""
                SELECT * FROM cases_case 
                WHERE {where_clause}
                ORDER BY created_at DESC
                LIMIT %s OFFSET %s
            """
            cursor.execute(data_query, params + [page_size, offset])
            cases = dict_fetchall(cursor)
            
            # Get statistics
            stats_query = f"""
                SELECT 
                    COUNT(*) as total,
                    COUNT(CASE WHEN status = 'OPEN' THEN 1 END) as open,
                    COUNT(CASE WHEN status = 'IN_PROGRESS' THEN 1 END) as in_progress,
                    COUNT(CASE WHEN status = 'RESOLVED' THEN 1 END) as resolved,
                    COUNT(CASE WHEN status = 'CLOSED' THEN 1 END) as closed
                FROM cases_case 
                WHERE assigned_vendor_id = {vendor_id}
            """
            cursor.execute(stats_query)
            stats_row = cursor.fetchone()
            statistics = {
                'total': stats_row[0] or 0,
                'open': stats_row[1] or 0,
                'in_progress': stats_row[2] or 0,
                'resolved': stats_row[3] or 0,
                'closed': stats_row[4] or 0,
            }
            
            return {
                "cases": cases,
                "total": total,
                "statistics": statistics
            }
    
    except Exception as e:
        logger.error(f"Failed to fetch vendor cases: {e}")
        return 500, {"error": "Failed to fetch cases"}


# =============================================================================
# Upload Evidence Endpoint
# =============================================================================

class EvidencePhotoSchema(Schema):
    """Evidence photo schema."""
    id: int
    file_name: str
    photo_url: str
    latitude: float
    longitude: float
    uploaded_at: datetime


class UploadEvidenceResponse(Schema):
    """Upload evidence response schema."""
    message: str
    uploaded_files: int
    case_id: int
    photos: List[dict]


class GetEvidencePhotosResponse(Schema):
    """Get evidence photos response."""
    case_id: int
    total: int
    photos: List[EvidencePhotoSchema]


class ErrorResponse(Schema):
    """Error response schema."""
    error: str


@router.get(
    "/cases/{case_id}/evidence-photos",
    response={200: GetEvidencePhotosResponse, 400: ErrorResponse, 401: ErrorResponse, 403: ErrorResponse, 404: ErrorResponse},
    summary="Get Evidence Photos for Case",
    description="Retrieve all uploaded evidence photos for a specific case.",
)
def get_evidence_photos(
    request: HttpRequest,
    case_id: int,
):
    """
    Get all evidence photos uploaded for a case.
    
    Requirements:
    - Vendor must be assigned to the case
    
    Returns:
    - List of evidence photos with URLs and GPS coordinates
    """
    from users.models import Vendor, EvidencePhoto
    from django.conf import settings
    
    # Verify user is authenticated vendor
    if not request.user.is_authenticated:
        return 401, {"error": "Not authenticated"}
    
    if request.user.role != 'VENDOR':
        return 403, {"error": "Vendor access required"}
    
    # Get vendor profile
    try:
        vendor = Vendor.objects.get(user=request.user)
    except Vendor.DoesNotExist:
        return 403, {"error": "Vendor profile not found"}
    
    # Verify case exists and is assigned to this vendor
    try:
        with connection.cursor() as cursor:
            cursor.execute(
                "SELECT id, case_number, assigned_vendor_id FROM cases_case WHERE id = %s",
                [case_id]
            )
            case_row = cursor.fetchone()
            
            if not case_row:
                return 404, {"error": "Case not found"}
            
            if case_row[2] != vendor.id:
                return 403, {"error": "You are not assigned to this case"}
    except Exception as e:
        logger.error(f"Failed to verify case assignment: {e}")
        return 500, {"error": "Failed to verify case"}
    
    # Get evidence photos for this case
    try:
        evidence_photos = EvidencePhoto.objects.filter(
            case_id=case_id,
            vendor=vendor
        ).order_by('-uploaded_at')
        
        photos_list = []
        for photo in evidence_photos:
            # Build photo URL
            photo_url = request.build_absolute_uri(photo.photo.url) if photo.photo else ''
            
            photos_list.append({
                'id': photo.id,
                'file_name': photo.file_name,
                'photo_url': photo_url,
                'latitude': float(photo.latitude),
                'longitude': float(photo.longitude),
                'uploaded_at': photo.uploaded_at,
            })
        
        logger.info(f"[Evidence] Retrieved {len(photos_list)} photos for case {case_id}")
        
        return {
            "case_id": case_id,
            "total": len(photos_list),
            "photos": photos_list,
        }
        
    except Exception as e:
        logger.error(f"[Evidence] Failed to retrieve photos: {e}")
        return 500, {"error": "Failed to retrieve evidence photos"}


class DeleteEvidenceResponse(Schema):
    """Delete evidence response schema."""
    message: str
    deleted_photo_id: int


@router.delete(
    "/evidence-photos/{photo_id}",
    response={200: DeleteEvidenceResponse, 400: ErrorResponse, 401: ErrorResponse, 403: ErrorResponse, 404: ErrorResponse},
    summary="Delete Evidence Photo",
    description="Delete an uploaded evidence photo from the database and storage.",
)
def delete_evidence_photo(
    request: HttpRequest,
    photo_id: int,
):
    """
    Delete an evidence photo.
    
    Requirements:
    - Vendor must be the owner of the photo
    - Photo file will be deleted from storage
    - Database record will be removed
    
    Returns:
    - Success message with deleted photo ID
    """
    from users.models import Vendor, EvidencePhoto
    import os
    from django.conf import settings
    
    # Verify user is authenticated vendor
    if not request.user.is_authenticated:
        return 401, {"error": "Not authenticated"}
    
    if request.user.role != 'VENDOR':
        return 403, {"error": "Vendor access required"}
    
    # Get vendor profile
    try:
        vendor = Vendor.objects.get(user=request.user)
    except Vendor.DoesNotExist:
        return 403, {"error": "Vendor profile not found"}
    
    # Get and verify photo ownership
    try:
        evidence_photo = EvidencePhoto.objects.get(id=photo_id, vendor=vendor)
    except EvidencePhoto.DoesNotExist:
        return 404, {"error": "Evidence photo not found or you don't have permission to delete it"}
    
    # Delete physical file from storage
    try:
        if evidence_photo.photo:
            photo_path = evidence_photo.photo.path
            if os.path.exists(photo_path):
                os.remove(photo_path)
                logger.info(f"[Evidence] Deleted file: {photo_path}")
    except Exception as e:
        logger.warning(f"[Evidence] Failed to delete file: {e}")
        # Continue with database deletion even if file deletion fails
    
    # Delete database record
    photo_id_backup = evidence_photo.id
    case_id = evidence_photo.case_id
    evidence_photo.delete()
    
    logger.info(f"[Evidence] Deleted photo {photo_id_backup} from case {case_id}")
    
    return {
        "message": "Evidence photo deleted successfully",
        "deleted_photo_id": photo_id_backup,
    }


@router.post(
    "/cases/{case_id}/upload-evidence",
    response={200: UploadEvidenceResponse, 400: ErrorResponse, 401: ErrorResponse, 403: ErrorResponse, 404: ErrorResponse, 500: ErrorResponse},
    summary="Upload Evidence Photos with GPS",
    description="Upload geotagged photos as evidence for a case. GPS coordinates are REQUIRED.",
)
def upload_evidence(
    request: HttpRequest,
    case_id: int,
):
    """
    Upload evidence photos for a case.
    
    Requirements:
    - Vendor must be assigned to the case
    - Photos must have GPS coordinates (latitude and longitude)
    - Photos without geotags will be rejected
    
    Form data:
    - files: Multiple image files
    - latitude: GPS latitude (required)
    - longitude: GPS longitude (required)
    """
    from users.models import Vendor, EvidencePhoto
    from PIL import Image
    from PIL.ExifTags import TAGS, GPSTAGS
    
    # Verify user is authenticated vendor
    if not request.user.is_authenticated:
        return 401, {"error": "Not authenticated"}
    
    if request.user.role != 'VENDOR':
        return 403, {"error": "Vendor access required"}
    
    # Get vendor profile
    try:
        vendor = Vendor.objects.get(user=request.user)
    except Vendor.DoesNotExist:
        return 403, {"error": "Vendor profile not found"}
    
    # Verify case exists and is assigned to this vendor
    case_location = None
    try:
        with connection.cursor() as cursor:
            cursor.execute(
                "SELECT id, case_number, title, assigned_vendor_id, latitude, longitude FROM cases_case WHERE id = %s",
                [case_id]
            )
            case_row = cursor.fetchone()
            
            if not case_row:
                return 404, {"error": "Case not found"}
            
            if case_row[3] != vendor.id:
                return 403, {"error": "You are not assigned to this case"}
            
            # Get case location for validation
            if case_row[4] is not None and case_row[5] is not None:
                case_location = {
                    'latitude': float(case_row[4]),
                    'longitude': float(case_row[5])
                }
                logger.info(f"[Evidence Upload] Case location: {case_location}")
    except Exception as e:
        logger.error(f"Failed to verify case assignment: {e}")
        return 500, {"error": "Failed to verify case"}
    
    # Get uploaded files
    files = request.FILES.getlist('photos') if hasattr(request, 'FILES') else []
    
    if not files:
        return 400, {"error": "No photos provided. Please upload at least one photo."}
    
    logger.info(f"[Evidence Upload] Received {len(files)} files for case {case_id}")
    
    uploaded_photos = []
    errors = []
    
    for file in files:
        try:
            # Extract GPS from EXIF
            latitude, longitude = extract_gps_from_image(file)
            
            if latitude is None or longitude is None:
                errors.append(f"{file.name}: Missing GPS coordinates")
                continue
            
            # Validate location match with case location (within 100 meters)
            if case_location is not None:
                from geopy.distance import geodesic
                
                photo_location = (latitude, longitude)
                case_coords = (case_location['latitude'], case_location['longitude'])
                
                # Calculate distance in meters
                distance_meters = geodesic(case_coords, photo_location).meters
                
                logger.info(
                    f"[Evidence Upload] Location validation for {file.name}: "
                    f"Distance = {distance_meters:.2f} meters"
                )
                
                # Reject if distance > 100 meters
                if distance_meters > 100:
                    errors.append(
                        f"{file.name}: Location mismatch. Photo taken {distance_meters:.0f}m away from case location. "
                        f"Maximum allowed distance is 100m."
                    )
                    logger.warning(
                        f"[Evidence Upload] Photo {file.name} rejected: "
                        f"{distance_meters:.2f}m away from case location"
                    )
                    continue
                else:
                    logger.info(
                        f"[Evidence Upload] Photo {file.name} location validated: "
                        f"{distance_meters:.2f}m from case location (within 100m tolerance)"
                    )
            else:
                logger.warning(f"[Evidence Upload] Case has no location set, skipping location validation")
            
            # Convert to Decimal with 6 decimal places precision
            from decimal import Decimal, ROUND_HALF_UP
            lat_decimal = Decimal(str(latitude)).quantize(Decimal('0.000001'), rounding=ROUND_HALF_UP)
            lon_decimal = Decimal(str(longitude)).quantize(Decimal('0.000001'), rounding=ROUND_HALF_UP)
            
            # Create EvidencePhoto record
            evidence_photo = EvidencePhoto(
                case_id=case_id,
                vendor=vendor,
                photo=file,
                latitude=lat_decimal,
                longitude=lon_decimal,
                file_name=file.name,
                file_size=file.size,
            )
            evidence_photo.full_clean()  # Validates GPS are not None
            evidence_photo.save()
            
            uploaded_photos.append({
                'id': evidence_photo.id,
                'file_name': evidence_photo.file_name,
                'latitude': float(evidence_photo.latitude),
                'longitude': float(evidence_photo.longitude),
                'uploaded_at': evidence_photo.uploaded_at.isoformat(),
            })
            
            logger.info(
                f"[Evidence Upload] Saved photo {file.name} with GPS: "
                f"({latitude}, {longitude})"
            )
            
        except Exception as e:
            logger.error(f"[Evidence Upload] Failed to save {file.name}: {e}")
            errors.append(f"{file.name}: {str(e)}")
            continue
    
    # Return response
    if not uploaded_photos and errors:
        error_msg = "All photos rejected. " + "; ".join(errors[:3])
        return 400, {"error": error_msg}
    
    response_message = f"Successfully uploaded {len(uploaded_photos)} photo(s)"
    if errors:
        response_message += f". {len(errors)} photo(s) rejected: " + "; ".join(errors[:2])
    
    return {
        "message": response_message,
        "uploaded_files": len(uploaded_photos),
        "case_id": case_id,
        "photos": uploaded_photos,
    }


def extract_gps_from_image(image_file: UploadedFile):
    """
    Extract GPS coordinates from image EXIF data.
    
    Returns:
        tuple: (latitude, longitude) or (None, None) if GPS data not found
    """
    from PIL import Image
    from PIL.ExifTags import TAGS, GPSTAGS
    
    try:
        # Read image
        image = Image.open(image_file)
        exif_data = image._getexif()
        
        if not exif_data:
            logger.warning(f"No EXIF data in {image_file.name}")
            return None, None
        
        # Find GPS IFD tag
        gps_ifd = None
        for tag_id, value in exif_data.items():
            tag_name = TAGS.get(tag_id, tag_id)
            if tag_name == 'GPSInfo':
                gps_ifd = value
                break
        
        if not gps_ifd:
            logger.warning(f"No GPS data in {image_file.name}")
            return None, None
        
        # Extract GPS coordinates
        gps_data = {}
        for tag_id in gps_ifd:
            tag_name = GPSTAGS.get(tag_id, tag_id)
            gps_data[tag_name] = gps_ifd[tag_id]
        
        # Convert to decimal degrees
        lat = gps_data.get('GPSLatitude')
        lat_ref = gps_data.get('GPSLatitudeRef')
        lon = gps_data.get('GPSLongitude')
        lon_ref = gps_data.get('GPSLongitudeRef')
        
        if not all([lat, lat_ref, lon, lon_ref]):
            logger.warning(f"Incomplete GPS data in {image_file.name}")
            return None, None
        
        latitude = convert_to_degrees(lat)
        if lat_ref == 'S':
            latitude = -latitude
        
        longitude = convert_to_degrees(lon)
        if lon_ref == 'W':
            longitude = -longitude
        
        # Round to 6 decimal places to match database field precision
        latitude = round(latitude, 6)
        longitude = round(longitude, 6)
        
        logger.info(f"Extracted GPS from {image_file.name}: ({latitude}, {longitude})")
        return latitude, longitude
        
    except Exception as e:
        logger.error(f"Failed to extract GPS from {image_file.name}: {e}")
        return None, None


def convert_to_degrees(value):
    """
    Convert GPS coordinates from degrees/minutes/seconds to decimal degrees.
    
    Args:
        value: tuple of (degrees, minutes, seconds)
    
    Returns:
        float: Decimal degrees
    """
    d, m, s = value
    return float(d) + float(m) / 60.0 + float(s) / 3600.0
