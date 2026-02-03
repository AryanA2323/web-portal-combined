"""
Script to test the email-to-case mapper on existing emails
"""

import os
import sys
import django

# Setup Django
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()

from users.models import EmailIntake, InsuranceCase
from users.services.email_to_case_mapper import get_email_to_case_mapper


def main():
    """Test case mapper on existing emails."""
    
    # Get all processed emails
    emails = EmailIntake.objects.filter(
        processing_status='COMPLETED'
    ).prefetch_related('attachments')
    
    print(f"Found {emails.count()} processed emails\n")
    
    if not emails:
        print("No emails to process")
        return
    
    mapper = get_email_to_case_mapper()
    
    for email in emails:
        print(f"\n{'='*80}")
        print(f"Processing Email:")
        print(f"  Subject: {email.subject}")
        print(f"  From: {email.sender_email}")
        print(f"  Date: {email.received_at}")
        print(f"  Attachments: {email.attachments.count()}")
        
        # Check if case already exists
        existing_case = InsuranceCase.objects.filter(
            source_email=email
        ).first()
        
        if existing_case:
            print(f"\n  ⚠ Case already exists: {existing_case.claim_number}")
            continue
        
        # Process email to case
        try:
            case = mapper.process_email_to_case(email)
            
            if case:
                print(f"\n  ✓ SUCCESS - Created Insurance Case:")
                print(f"    Claim Number: {case.claim_number}")
                print(f"    Category: {case.category}")
                print(f"    Client: {case.client_name}")
                print(f"    Policy Number: {case.policy_number}")
                print(f"    CRN/MACT: {case.crn}")
                print(f"    Claimant: {case.claimant_name}")
                print(f"    Insured: {case.insured_name}")
                print(f"    Status: {case.full_case_status}")
                print(f"    Documents Linked: {case.documents.count()}")
                
                # Show linked documents
                for doc in case.documents.all():
                    print(f"      - {doc.document_type}: {doc.document_name}")
            else:
                print(f"\n  ✗ FAILED - Could not extract case data")
                
        except Exception as e:
            print(f"\n  ✗ ERROR - {str(e)}")
            import traceback
            traceback.print_exc()
    
    print(f"\n{'='*80}")
    print(f"\nSummary:")
    print(f"  Total Emails: {emails.count()}")
    print(f"  Total Cases Created: {InsuranceCase.objects.count()}")
    

if __name__ == '__main__':
    main()
