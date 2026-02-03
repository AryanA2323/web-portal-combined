"""
Enhanced Email to Insurance Case Mapper with Advanced Extraction
Extracts comprehensive data from emails and PDFs to populate all insurance case fields
"""

import re
import logging
from datetime import datetime, timedelta
from typing import Dict, Any, Optional, List
from django.utils import timezone
from django.db import transaction
from decimal import Decimal

from users.models import (
    EmailIntake, EmailAttachment,
    InsuranceCase, CaseDocument, Client
)

logger = logging.getLogger(__name__)


class EnhancedEmailToCaseMapper:
    """Enhanced service to map email data to insurance case model with comprehensive extraction."""
    
    def __init__(self):
        """Initialize the mapper with comprehensive patterns."""
        
        # Claim and case identification patterns
        self.claim_number_patterns = [
            r'Claim\s*[Nn]o\.?\s*[-:]?\s*([A-Z0-9\-]+)',
            r'[Cc]laim\s*[Nn]umber\s*[-:]?\s*([A-Z0-9\-]+)',
            r'[Cc]laim\s*#\s*[-:]?\s*([A-Z0-9\-]+)',
            r'Intimation\s*[-]\s*Claim\s*no\.\s*([0-9]+)',
            r'MTP[-\s]?[A-Z]?[-\s]?(\d{4}[-\s]\d{6})',  # MTP-N-2526-005829 format
            r'(?:MVC|MAC)\s+(\d+/\d{4})',  # MVC 2142/2025 format
        ]
        
        self.policy_number_patterns = [
            r'Policy\s*[Nn]o\.?\s*[-:]?\s*([A-Z0-9]+)',
            r'Policy\s*[Nn]umber\s*[-:]?\s*([A-Z0-9]+)',
            r'Policy\s*#\s*[-:]?\s*([A-Z0-9]+)',
            r'POLICY\s+NO[.:]\s*([A-Z0-9]+)',
        ]
        
        self.mact_number_patterns = [
            r'MACT\s*[Nn]o\.?\s*[-:]?\s*([0-9/]+)',
            r'MAC\s*[Cc]ase\s*[Nn]o\.?\s*[-:]?\s*([0-9/]+)',
        ]
        
        # Vehicle registration patterns
        self.registration_patterns = [
            r'(?:Registration|Reg\.?)\s*[Nn]o\.?\s*[-:]?\s*([A-Z]{2}[-\s]?\d{2}[-\s]?[A-Z]{1,2}[-\s]?\d{4})',
            r'(?:Vehicle|Veh\.?)\s*[Nn]o\.?\s*[-:]?\s*([A-Z]{2}[-\s]?\d{2}[-\s]?[A-Z]{1,2}[-\s]?\d{4})',
            r'\b([A-Z]{2}[-\s]?\d{2}[-\s]?[A-Z]{1,2}[-\s]?\d{4})\b',
        ]
        
        # Name patterns
        self.insured_patterns = [
            r'Insured\s*[Nn]ame\s*[-:]?\s*([A-Z][A-Za-z\s\.]+?)(?:\n|,|;|\s{2,})',
            r'Name\s+of\s+Insured\s*[-:]?\s*([A-Z][A-Za-z\s\.]+?)(?:\n|,)',
            r'INSURED\s+NAME\s*[-:]?\s*([A-Z][A-Za-z\s\.]+?)(?:\n|,)',
        ]
        
        self.claimant_patterns = [
            r'[Cc]laimant\s*[Nn]ame\s*[-:]?\s*([A-Z][A-Za-z\s\.]+?)(?:\n|,|;|\s{2,})',
            r'[Pp]etitioner\s*[Nn]ame\s*[-:]?\s*([A-Z][A-Za-z\s\.]+?)(?:\n|VS|,)',
            r'Petitioner\s+Name\s+[-]\s+([A-Za-z\s]+)',
        ]
        
        # Address patterns
        self.address_patterns = [
            r'Address\s*[-:]?\s*([^\n]+(?:\n[^\n]+){0,2})',
            r'[Rr]esiding\s+at\s*[-:]?\s*([^\n]+)',
        ]
        
        # District patterns
        self.district_patterns = [
            r'District\s*[-:]?\s*([A-Za-z\s]+?)(?:\n|,|;|\s{2,})',
            r'Dist\.?\s*[-:]?\s*([A-Za-z\s]+?)(?:\n|,)',
        ]
        
        # Location patterns
        self.location_patterns = [
            r'Location\s*[-:]?\s*([A-Za-z\s]+?)(?:\n|/)',
            r'Place\s+of\s+Accident\s*[-:]?\s*([^\n]+)',
        ]
        
        # Date patterns
        self.date_patterns = [
            r'(\d{1,2}[-/]\d{1,2}[-/]\d{2,4})',
            r'(\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{4})',
        ]
        
        # Amount patterns
        self.amount_patterns = [
            r'(?:Rs\.?|INR|₹)\s*([0-9,]+(?:\.\d{2})?)',
            r'(?:Claim|Amount)\s*[-:]?\s*(?:Rs\.?|INR|₹)?\s*([0-9,]+)',
        ]
    
    @transaction.atomic
    def process_email_to_case(self, email: EmailIntake) -> Optional[InsuranceCase]:
        """Process email and create comprehensive insurance case."""
        try:
            logger.info(f"Processing email {email.message_id} with enhanced extraction")
            
            # Extract comprehensive data
            extracted_data = self.extract_comprehensive_data(email)
            
            if not extracted_data.get('claim_number'):
                logger.warning(f"No claim number found in email {email.message_id}")
                return None
            
            # Check if case exists
            existing_case = InsuranceCase.objects.filter(
                claim_number=extracted_data['claim_number']
            ).first()
            
            if existing_case:
                logger.info(f"Updating existing case {extracted_data['claim_number']}")
                return self.update_existing_case(existing_case, extracted_data, email)
            
            # Create new case with all fields
            case = self.create_comprehensive_case(extracted_data, email)
            
            # Link documents
            self.link_attachments_to_case(email, case)
            
            logger.info(f"Created comprehensive case {case.claim_number}")
            return case
            
        except Exception as e:
            logger.error(f"Failed to process email: {e}", exc_info=True)
            return None
    
    def extract_comprehensive_data(self, email: EmailIntake) -> Dict[str, Any]:
        """Extract all possible data from email and PDFs."""
        data = {}
        
        # Get all text sources
        subject_text = email.subject or ""
        body_text = email.body_text or ""
        
        # Get PDF texts separately for targeted extraction
        policy_pdf_text = ""
        petition_pdf_text = ""
        
        for attachment in email.attachments.filter(is_pdf=True):
            text = attachment.extracted_text or ""
            if 'policy' in attachment.filename.lower():
                policy_pdf_text = text
            elif 'petition' in attachment.filename.lower():
                petition_pdf_text = text
            else:
                body_text += f"\n{text}"
        
        # Combined text for general searching
        all_text = f"{subject_text}\n{body_text}\n{policy_pdf_text}\n{petition_pdf_text}"
        
        # Extract basic identification
        data['claim_number'] = self.extract_claim_number(subject_text, all_text)
        data['policy_number'] = self.extract_policy_number(subject_text, all_text, policy_pdf_text)
        data['crn'] = self.extract_mact_number(subject_text, all_text)
        
        # Extract from subject line (structured data)
        data.update(self.extract_from_subject(subject_text))
        
        # Extract names
        data['insured_name'] = self.extract_insured_name(policy_pdf_text, all_text)
        data['claimant_name'] = self.extract_claimant_name(petition_pdf_text, subject_text, all_text)
        data['driver_name'] = self.extract_driver_name(all_text)
        
        # Extract addresses
        data['insured_address'] = self.extract_insured_address(policy_pdf_text, all_text)
        data['claimant_address'] = self.extract_claimant_address(petition_pdf_text, all_text)
        
        # Extract locations
        location_data = self.extract_location_data(subject_text, all_text, petition_pdf_text)
        data.update(location_data)
        
        # Extract vehicle details
        data['registration_number'] = self.extract_registration_number(policy_pdf_text, all_text)
        
        # Extract client/insurance company
        data['client_name'] = self.extract_client_name(email, policy_pdf_text, all_text)
        
        # Extract dates (if available in PDFs)
        date_info = self.extract_dates(all_text, petition_pdf_text)
        data.update(date_info)
        
        # Set category
        if data.get('crn') or 'MACT' in subject_text.upper():
            data['category'] = 'MACT'
        else:
            data['category'] = 'OTHER'
        
        # Set dates
        data['case_receipt_date'] = email.received_at.date()
        data['receipt_month'] = email.received_at.strftime('%b-%y')
        data['case_due_date'] = data['case_receipt_date'] + timedelta(days=30)
        
        # Determine case type and scope
        if 'intimation' in subject_text.lower() or 'Full Case' in all_text:
            data['case_type'] = 'Full Case'
            data['scope_of_work'] = 'Full Investigation'
        
        # Set initial status
        data['full_case_status'] = 'Open'
        data['investigation_report_status'] = 'Pending'
        
        return data
    
    def extract_from_subject(self, subject: str) -> Dict[str, Any]:
        """Extract structured data from email subject line."""
        data = {}
        
        # Pattern: "Location - Thane"
        location_match = re.search(r'Location\s*[-:]\s*([A-Za-z\s]+?)(?:\s*/|\s+/|$)', subject, re.IGNORECASE)
        if location_match:
            data['spot_location'] = location_match.group(1).strip()
            data['spot_district'] = location_match.group(1).strip()
        
        # Pattern: "File No W6607"
        file_no_match = re.search(r'File\s*No\.?\s*([A-Z0-9]+)', subject, re.IGNORECASE)
        if file_no_match:
            data['file_number'] = file_no_match.group(1).strip()
        
        return data
    
    def extract_claim_number(self, subject: str, text: str) -> Optional[str]:
        """Extract claim number with multiple patterns."""
        for pattern in self.claim_number_patterns:
            match = re.search(pattern, subject, re.IGNORECASE)
            if match:
                return match.group(1).strip()
        
        for pattern in self.claim_number_patterns:
            match = re.search(pattern, text[:2000], re.IGNORECASE)
            if match:
                return match.group(1).strip()
        
        return None
    
    def extract_policy_number(self, subject: str, text: str, policy_pdf: str) -> str:
        """Extract policy number from subject, text, or PDF."""
        # Try subject first (most reliable)
        for pattern in self.policy_number_patterns:
            match = re.search(pattern, subject, re.IGNORECASE)
            if match:
                number = match.group(1).strip()
                if len(number) > 5:  # Valid policy numbers are typically longer
                    return number
        
        # Try policy PDF
        if policy_pdf:
            for pattern in self.policy_number_patterns:
                match = re.search(pattern, policy_pdf[:3000], re.IGNORECASE)
                if match:
                    number = match.group(1).strip()
                    if len(number) > 5:
                        return number
        
        # Try general text
        for pattern in self.policy_number_patterns:
            match = re.search(pattern, text[:5000], re.IGNORECASE)
            if match:
                number = match.group(1).strip()
                if len(number) > 5:
                    return number
        
        return ""
    
    def extract_mact_number(self, subject: str, text: str) -> str:
        """Extract MACT case number."""
        for pattern in self.mact_number_patterns:
            match = re.search(pattern, subject + " " + text[:2000], re.IGNORECASE)
            if match:
                return match.group(1).strip()
        return ""
    
    def extract_registration_number(self, policy_pdf: str, text: str) -> str:
        """Extract vehicle registration number."""
        search_text = policy_pdf if policy_pdf else text
        
        for pattern in self.registration_patterns:
            match = re.search(pattern, search_text[:5000], re.IGNORECASE)
            if match:
                reg_no = match.group(1).strip()
                # Clean up registration number
                reg_no = re.sub(r'\s+', '', reg_no)  # Remove spaces
                reg_no = reg_no.upper()
                return reg_no
        
        return ""
    
    def extract_insured_name(self, policy_pdf: str, text: str) -> str:
        """Extract insured person's name from policy PDF."""
        search_text = policy_pdf if policy_pdf else text
        
        for pattern in self.insured_patterns:
            match = re.search(pattern, search_text[:5000])
            if match:
                name = match.group(1).strip()
                # Clean up name
                name = re.sub(r'\s{2,}', ' ', name)
                if len(name) > 3 and len(name) < 100:
                    return name
        
        return ""
    
    def extract_claimant_name(self, petition_pdf: str, subject: str, text: str) -> str:
        """Extract claimant/petitioner name."""
        # Try subject first
        for pattern in self.claimant_patterns:
            match = re.search(pattern, subject)
            if match:
                name = match.group(1).strip()
                name = re.sub(r'\s{2,}', ' ', name)
                if len(name) > 3 and len(name) < 100:
                    return name
        
        # Try petition PDF
        if petition_pdf:
            for pattern in self.claimant_patterns:
                match = re.search(pattern, petition_pdf[:3000])
                if match:
                    name = match.group(1).strip()
                    name = re.sub(r'\s{2,}', ' ', name)
                    if len(name) > 3 and len(name) < 100:
                        return name
        
        return ""
    
    def extract_driver_name(self, text: str) -> str:
        """Extract driver name if mentioned."""
        patterns = [
            r'Driver\s*[Nn]ame\s*[-:]?\s*([A-Z][A-Za-z\s\.]+?)(?:\n|,)',
            r'Name\s+of\s+Driver\s*[-:]?\s*([A-Z][A-Za-z\s\.]+?)(?:\n|,)',
        ]
        
        for pattern in patterns:
            match = re.search(pattern, text[:5000])
            if match:
                name = match.group(1).strip()
                if len(name) > 3 and len(name) < 100:
                    return name
        
        return ""
    
    def extract_insured_address(self, policy_pdf: str, text: str) -> str:
        """Extract insured address from policy."""
        search_text = policy_pdf if policy_pdf else text
        
        # Look for address after "Insured" keyword
        insured_section = re.search(r'(?:Insured|INSURED)(.*?)(?:Coverage|Policy|Premium|\n\n)', 
                                   search_text[:5000], re.DOTALL)
        if insured_section:
            section_text = insured_section.group(1)
            for pattern in self.address_patterns:
                match = re.search(pattern, section_text)
                if match:
                    address = match.group(1).strip()
                    address = re.sub(r'\s{2,}', ' ', address)
                    if len(address) > 10:
                        return address[:500]
        
        return ""
    
    def extract_claimant_address(self, petition_pdf: str, text: str) -> str:
        """Extract claimant address from petition."""
        search_text = petition_pdf if petition_pdf else text
        
        # Look for address after claimant/petitioner
        for pattern in self.address_patterns:
            match = re.search(pattern, search_text[:5000])
            if match:
                address = match.group(1).strip()
                address = re.sub(r'\s{2,}', ' ', address)
                if len(address) > 10:
                    return address[:500]
        
        return ""
    
    def extract_location_data(self, subject: str, text: str, petition: str) -> Dict[str, str]:
        """Extract location and district information."""
        data = {}
        
        # Extract location from subject
        location_match = re.search(r'Location\s*[-:]\s*([A-Za-z\s]+?)(?:\s*/|\s+/|$)', subject, re.IGNORECASE)
        if location_match:
            location = location_match.group(1).strip()
            data['spot_location'] = location
            data['claimant_district'] = location
            data['spot_district'] = location
        
        # Extract district from text
        for pattern in self.district_patterns:
            match = re.search(pattern, text[:3000])
            if match:
                district = match.group(1).strip()
                if not data.get('claimant_district'):
                    data['claimant_district'] = district
                break
        
        return data
    
    def extract_dates(self, text: str, petition: str) -> Dict[str, Any]:
        """Extract various dates from documents."""
        data = {}
        
        # Look for accident date
        accident_patterns = [
            r'(?:Date|Dt\.?)\s+of\s+Accident\s*[-:]?\s*(\d{1,2}[-/]\d{1,2}[-/]\d{2,4})',
            r'Accident\s+(?:occurred|happened)\s+on\s*[-:]?\s*(\d{1,2}[-/]\d{1,2}[-/]\d{2,4})',
        ]
        
        for pattern in accident_patterns:
            match = re.search(pattern, text[:3000], re.IGNORECASE)
            if match:
                try:
                    date_str = match.group(1)
                    # Parse date (simple parsing, can be enhanced)
                    # Store as string for now
                    data['accident_date'] = date_str
                except:
                    pass
                break
        
        return data
    
    def extract_client_name(self, email: EmailIntake, policy_pdf: str, text: str) -> str:
        """Extract insurance company name."""
        # Known insurance companies
        companies = [
            'SBI General', 'ICICI Lombard', 'HDFC ERGO', 'Bajaj Allianz',
            'Reliance General', 'TATA AIG', 'Oriental Insurance',
            'United India Insurance', 'National Insurance', 'New India Assurance',
            'Magma HDI', 'IndusInd', 'Generali', 'Shriram General',
            'Royal Sundaram', 'Cholamandalam', 'Future Generali',
            'Liberty General', 'Bharti AXA', 'Iffco Tokio',
        ]
        
        # Check policy PDF first
        if policy_pdf:
            for company in companies:
                if company.lower() in policy_pdf[:2000].lower():
                    return company
        
        # Check subject and body
        combined = f"{email.subject} {text}"
        for company in companies:
            if company.lower() in combined.lower():
                return company
        
        return "Unknown Insurance Company"
    
    def create_comprehensive_case(self, data: Dict[str, Any], email: EmailIntake) -> InsuranceCase:
        """Create insurance case with all extracted fields."""
        
        # Try to find matching client
        client = None
        if data.get('client_name'):
            client = Client.objects.filter(
                client_name__icontains=data['client_name']
            ).first()
        
        # Create case with all fields populated
        case = InsuranceCase.objects.create(
            # Identification
            claim_number=data['claim_number'],
            client=client,
            client_name=data.get('client_name', 'Unknown'),
            category=data.get('category', 'OTHER'),
            crn=data.get('crn', ''),
            policy_number=data.get('policy_number', ''),
            
            # Dates
            case_receipt_date=data['case_receipt_date'],
            receipt_month=data['receipt_month'],
            case_due_date=data['case_due_date'],
            
            # Case details
            case_type=data.get('case_type', ''),
            investigation_report_status=data['investigation_report_status'],
            full_case_status=data['full_case_status'],
            scope_of_work=data.get('scope_of_work', ''),
            
            # Claimant information
            claimant_name=data.get('claimant_name', ''),
            claimant_address=data.get('claimant_address', ''),
            claimant_district=data.get('claimant_district', ''),
            claimant_status='To be verified',
            
            # Insured information
            insured_name=data.get('insured_name', ''),
            insured_address=data.get('insured_address', ''),
            insured_district=data.get('spot_district', ''),
            insured_status='To be verified',
            
            # Driver information
            driver_name=data.get('driver_name', ''),
            driver_status='To be verified' if data.get('driver_name') else '',
            
            # Spot details
            spot_location=data.get('spot_location', ''),
            spot_district=data.get('spot_district', ''),
            spot_status='Pending' if data.get('spot_location') else '',
            
            # Document status
            dl_status='Pending',
            rc_status='Pending',
            permit_status='Pending',
            fitness_status='Pending',
            
            # Police details (no police_status field - use individual fields)
            rti_status='Pending',
            chargesheet_status='Pending',
            
            # Link to email
            source_email=email,
            
            # Notes
            case_notes=f"Auto-created from email: {email.subject}\n\nExtracted data includes: Policy#{data.get('policy_number')}, MACT#{data.get('crn')}"
        )
        
        logger.info(f"Created comprehensive case {case.claim_number} with {len([v for v in data.values() if v])} populated fields")
        return case
    
    def update_existing_case(self, case: InsuranceCase, data: Dict[str, Any], email: EmailIntake) -> InsuranceCase:
        """Update existing case with new data."""
        
        # Update only empty fields
        if not case.policy_number and data.get('policy_number'):
            case.policy_number = data['policy_number']
        
        if not case.claimant_name and data.get('claimant_name'):
            case.claimant_name = data['claimant_name']
        
        if not case.insured_name and data.get('insured_name'):
            case.insured_name = data['insured_name']
        
        if not case.insured_address and data.get('insured_address'):
            case.insured_address = data['insured_address']
        
        if not case.claimant_address and data.get('claimant_address'):
            case.claimant_address = data['claimant_address']
        
        if not case.spot_location and data.get('spot_location'):
            case.spot_location = data['spot_location']
        
        # Append to notes
        if case.case_notes:
            case.case_notes += f"\n\nUpdated from email on {timezone.now()}: {email.subject}"
        else:
            case.case_notes = f"Updated from email: {email.subject}"
        
        case.save()
        logger.info(f"Updated case {case.claim_number}")
        return case
    
    def link_attachments_to_case(self, email: EmailIntake, case: InsuranceCase):
        """Link email attachments to case as documents."""
        
        for attachment in email.attachments.all():
            # Classify document
            doc_type = self.classify_document_type(attachment.filename, attachment.extracted_text)
            
            # Create case document
            CaseDocument.objects.create(
                case=case,
                email_attachment=attachment,
                document_type=doc_type,
                document_name=attachment.filename,
                file_path=attachment.file_path.name if attachment.file_path else '',
                extracted_text=attachment.extracted_text,
            )
            
            logger.info(f"Linked {doc_type} document: {attachment.filename}")
    
    def classify_document_type(self, filename: str, text: str) -> str:
        """Classify document type."""
        filename_lower = filename.lower()
        text_lower = (text or "")[:500].lower()
        
        if 'policy' in filename_lower or 'policy' in text_lower:
            return 'POLICY'
        elif 'petition' in filename_lower:
            return 'PETITION'
        elif 'fir' in filename_lower or 'fir' in text_lower:
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


def get_email_to_case_mapper() -> EnhancedEmailToCaseMapper:
    """Get enhanced email to case mapper instance."""
    return EnhancedEmailToCaseMapper()
