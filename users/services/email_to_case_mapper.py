"""
Email to Insurance Case Mapper
Extracts data from emails and PDFs to create insurance case records
"""

import re
import logging
from datetime import datetime, timedelta
from typing import Dict, Any, Optional
from django.utils import timezone
from django.db import transaction

from users.models import (
    EmailIntake, EmailAttachment,
    InsuranceCase, CaseDocument, Client
)

logger = logging.getLogger(__name__)


class EmailToCaseMapper:
    """Service to map email data to insurance case model."""
    
    def __init__(self):
        """Initialize the mapper."""
        self.claim_number_patterns = [
            r'Claim\s*[Nn]o\.?\s*:?\s*([A-Z0-9\-]+)',
            r'[Cc]laim\s*[Nn]umber\s*:?\s*([A-Z0-9\-]+)',
            r'[Cc]laim\s*#?\s*:?\s*([A-Z0-9\-]+)',
        ]
        
        self.policy_number_patterns = [
            r'Policy\s*[Nn]o\.?\s*:?\s*([A-Z0-9\-]+)',
            r'Policy\s*[Nn]umber\s*:?\s*([A-Z0-9\-]+)',
        ]
        
        self.mact_number_patterns = [
            r'MACT\s*[Nn]o\.?\s*:?\s*([0-9/]+)',
            r'MACT\s*#?\s*:?\s*([0-9/]+)',
        ]
    
    @transaction.atomic
    def process_email_to_case(self, email: EmailIntake) -> Optional[InsuranceCase]:
        """
        Process email and create insurance case if possible.
        
        Args:
            email: EmailIntake instance
            
        Returns:
            InsuranceCase instance or None
        """
        try:
            logger.info(f"Processing email {email.message_id} to create case")
            
            # Extract data from email
            extracted_data = self.extract_case_data(email)
            
            if not extracted_data.get('claim_number'):
                logger.warning(f"No claim number found in email {email.message_id}")
                return None
            
            # Check if case already exists
            existing_case = InsuranceCase.objects.filter(
                claim_number=extracted_data['claim_number']
            ).first()
            
            if existing_case:
                logger.info(f"Case {extracted_data['claim_number']} already exists, updating...")
                return self.update_existing_case(existing_case, extracted_data, email)
            
            # Create new case
            case = self.create_new_case(extracted_data, email)
            
            # Link documents from attachments
            self.link_attachments_to_case(email, case)
            
            logger.info(f"Successfully created case {case.claim_number} from email")
            return case
            
        except Exception as e:
            logger.error(f"Failed to process email {email.message_id} to case: {e}", exc_info=True)
            return None
    
    def extract_case_data(self, email: EmailIntake) -> Dict[str, Any]:
        """
        Extract case data from email content and attachments.
        
        Args:
            email: EmailIntake instance
            
        Returns:
            Dictionary of extracted data
        """
        data = {}
        
        # Combine email body and attachment text for searching
        search_text = f"{email.subject}\n{email.body_text}\n{email.body_html}"
        
        # Add PDF text
        for attachment in email.attachments.filter(is_pdf=True):
            if attachment.extracted_text:
                search_text += f"\n{attachment.extracted_text}"
        
        # Extract claim number
        data['claim_number'] = self.extract_claim_number(search_text, email.subject)
        
        # Extract policy number
        data['policy_number'] = self.extract_policy_number(search_text)
        
        # Extract MACT number (if present)
        data['mact_number'] = self.extract_mact_number(search_text, email.subject)
        
        # Extract client name
        data['client_name'] = self.extract_client_name(email, search_text)
        
        # Extract names
        data['claimant_name'] = self.extract_claimant_name(email.subject, search_text)
        data['insured_name'] = self.extract_insured_name(search_text)
        
        # Extract location data
        data['location_info'] = self.extract_location_info(search_text)
        
        # Set dates
        data['case_receipt_date'] = email.received_at.date()
        data['receipt_month'] = email.received_at.strftime('%b-%y')
        
        # Determine category
        if 'MACT' in email.subject.upper() or data.get('mact_number'):
            data['category'] = 'MACT'
        else:
            data['category'] = 'OTHER'
        
        # Extract case type from subject
        if 'intimation' in email.subject.lower():
            data['case_type'] = 'Full Case'
        
        # Extract scope of work
        data['scope_of_work'] = self.extract_scope_of_work(search_text)
        
        # Set initial status
        data['full_case_status'] = 'Open'
        data['investigation_report_status'] = 'Pending'
        
        return data
    
    def extract_claim_number(self, text: str, subject: str) -> Optional[str]:
        """Extract claim number from text."""
        # Try subject first
        for pattern in self.claim_number_patterns:
            match = re.search(pattern, subject, re.IGNORECASE)
            if match:
                return match.group(1).strip()
        
        # Try full text
        for pattern in self.claim_number_patterns:
            match = re.search(pattern, text, re.IGNORECASE)
            if match:
                return match.group(1).strip()
        
        return None
    
    def extract_policy_number(self, text: str) -> Optional[str]:
        """Extract policy number from text."""
        for pattern in self.policy_number_patterns:
            match = re.search(pattern, text, re.IGNORECASE)
            if match:
                return match.group(1).strip()
        return None
    
    def extract_mact_number(self, text: str, subject: str) -> Optional[str]:
        """Extract MACT number from text."""
        for pattern in self.mact_number_patterns:
            match = re.search(pattern, subject + " " + text, re.IGNORECASE)
            if match:
                return match.group(1).strip()
        return None
    
    def extract_client_name(self, email: EmailIntake, text: str) -> str:
        """Extract client/insurance company name."""
        # Common insurance company names
        insurance_companies = [
            'SBI General', 'ICICI Lombard', 'HDFC ERGO', 'Bajaj Allianz',
            'Reliance General', 'TATA AIG', 'Oriental Insurance',
            'United India Insurance', 'National Insurance', 'New India Assurance',
            'Magma HDI', 'IndusInd', 'Generali', 'Shriram General',
        ]
        
        # Try to find in subject or body
        for company in insurance_companies:
            if company.lower() in email.subject.lower() or company.lower() in text.lower():
                return company
        
        # Default fallback
        return "Unknown Insurance Company"
    
    def extract_claimant_name(self, subject: str, text: str) -> str:
        """Extract claimant name from subject/text."""
        # Try to extract from subject patterns like "Name VS Company"
        vs_pattern = r'([A-Za-z\s]+)\s+VS\s+'
        match = re.search(vs_pattern, subject, re.IGNORECASE)
        if match:
            return match.group(1).strip()
        
        # Try "Petitioner Name" pattern
        petitioner_pattern = r'Petitioner\s+Name\s*[:-]\s*([A-Za-z\s]+?)(?:\s+\||$)'
        match = re.search(petitioner_pattern, subject + " " + text, re.IGNORECASE)
        if match:
            return match.group(1).strip()
        
        return ""
    
    def extract_insured_name(self, text: str) -> str:
        """Extract insured name from text."""
        insured_pattern = r'Insured\s*Name?\s*[:-]\s*([A-Za-z0-9\s,\.\-]+?)(?:\n|;|,\s*[A-Z]|\s{2,})'
        match = re.search(insured_pattern, text, re.IGNORECASE)
        if match:
            return match.group(1).strip()[:500]
        return ""
    
    def extract_location_info(self, text: str) -> Dict[str, str]:
        """Extract location information."""
        locations = {}
        
        # Try to extract district
        district_pattern = r'(?:District|Dist\.?)\s*[:-]?\s*([A-Za-z\s]+?)(?:\n|,|;|\s{2,})'
        match = re.search(district_pattern, text, re.IGNORECASE)
        if match:
            locations['district'] = match.group(1).strip()
        
        # Try to extract city/location
        location_pattern = r'Location\s*[:-]?\s*([A-Za-z\s,]+?)(?:\n|;|\s{2,})'
        match = re.search(location_pattern, text, re.IGNORECASE)
        if match:
            locations['city'] = match.group(1).strip()
        
        return locations
    
    def extract_scope_of_work(self, text: str) -> str:
        """Extract scope of work from text."""
        scope_keywords = ['Full Case', 'Partial Investigation', 'Connected Case', 'Spot', 'Claimant', 'Insured']
        
        for keyword in scope_keywords:
            if keyword.lower() in text.lower():
                return keyword
        
        return ""
    
    def create_new_case(self, data: Dict[str, Any], email: EmailIntake) -> InsuranceCase:
        """Create new insurance case from extracted data."""
        
        # Try to find matching client
        client = None
        if data.get('client_name'):
            client = Client.objects.filter(
                client_name__icontains=data['client_name']
            ).first()
        
        # Set due date (30 days from receipt)
        due_date = data['case_receipt_date'] + timedelta(days=30)
        
        # Create case
        case = InsuranceCase.objects.create(
            claim_number=data['claim_number'],
            client=client,
            client_name=data.get('client_name', 'Unknown'),
            category=data.get('category', 'OTHER'),
            crn=data.get('mact_number', ''),
            policy_number=data.get('policy_number', ''),
            
            # Dates
            case_receipt_date=data['case_receipt_date'],
            receipt_month=data['receipt_month'],
            case_due_date=due_date,
            
            # Case details
            case_type=data.get('case_type', ''),
            investigation_report_status=data['investigation_report_status'],
            full_case_status=data['full_case_status'],
            scope_of_work=data.get('scope_of_work', ''),
            
            # Names
            claimant_name=data.get('claimant_name', ''),
            insured_name=data.get('insured_name', ''),
            
            # Location
            claimant_district=data.get('location_info', {}).get('district', ''),
            
            # Link to email
            source_email=email,
            
            # Notes
            case_notes=f"Auto-created from email: {email.subject}"
        )
        
        logger.info(f"Created new case {case.claim_number}")
        return case
    
    def update_existing_case(self, case: InsuranceCase, data: Dict[str, Any], email: EmailIntake) -> InsuranceCase:
        """Update existing case with new data from email."""
        
        # Update fields if they were empty
        if not case.policy_number and data.get('policy_number'):
            case.policy_number = data['policy_number']
        
        if not case.claimant_name and data.get('claimant_name'):
            case.claimant_name = data['claimant_name']
        
        if not case.insured_name and data.get('insured_name'):
            case.insured_name = data['insured_name']
        
        # Append to case notes
        if case.case_notes:
            case.case_notes += f"\n\nUpdated from email on {timezone.now()}: {email.subject}"
        else:
            case.case_notes = f"Updated from email: {email.subject}"
        
        case.save()
        
        logger.info(f"Updated existing case {case.claim_number}")
        return case
    
    def link_attachments_to_case(self, email: EmailIntake, case: InsuranceCase):
        """Link email attachments to case as documents."""
        
        for attachment in email.attachments.all():
            # Determine document type from filename
            doc_type = self.classify_document_type(attachment.filename, attachment.extracted_text)
            
            # Copy file or link to existing
            doc = CaseDocument.objects.create(
                case=case,
                email_attachment=attachment,
                document_type=doc_type,
                document_name=attachment.filename,
                file_path=attachment.file_path,
                extracted_text=attachment.extracted_text,
            )
            
            logger.info(f"Linked attachment {attachment.filename} to case {case.claim_number} as {doc_type}")
    
    def classify_document_type(self, filename: str, text: str) -> str:
        """Classify document type based on filename and content."""
        filename_lower = filename.lower()
        text_lower = text.lower() if text else ""
        
        if 'policy' in filename_lower or 'policy' in text_lower[:500]:
            return 'POLICY'
        elif 'petition' in filename_lower:
            return 'PETITION'
        elif 'fir' in filename_lower or 'fir' in text_lower[:500]:
            return 'FIR'
        elif 'medical' in filename_lower or 'hospital' in filename_lower:
            return 'MEDICAL'
        elif 'spot' in filename_lower or 'photo' in filename_lower:
            return 'SPOT_PHOTO'
        elif 'dl' in filename_lower or 'driving' in filename_lower:
            return 'DL'
        elif 'rc' in filename_lower or 'registration' in filename_lower:
            return 'RC'
        elif 'permit' in filename_lower:
            return 'PERMIT'
        else:
            return 'OTHER'


def get_email_to_case_mapper() -> EmailToCaseMapper:
    """Get email to case mapper instance."""
    return EmailToCaseMapper()
