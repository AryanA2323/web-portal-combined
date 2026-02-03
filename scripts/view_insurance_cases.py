"""
View created insurance cases and their details
"""

import os
import sys
import django

# Setup Django
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()

from users.models import InsuranceCase, CaseDocument


def main():
    """Display all insurance cases."""
    
    cases = InsuranceCase.objects.all().select_related('source_email', 'client').prefetch_related('documents')
    
    print(f"{'='*100}")
    print(f"INSURANCE CASES IN DATABASE")
    print(f"{'='*100}\n")
    
    for case in cases:
        print(f"Claim Number: {case.claim_number}")
        print(f"{'─'*100}")
        
        # Basic Info
        print(f"\n📋 BASIC INFORMATION:")
        print(f"  Category:           {case.category}")
        print(f"  Client:             {case.client_name}")
        print(f"  CRN/MACT Number:    {case.crn}")
        print(f"  Policy Number:      {case.policy_number or 'N/A'}")
        print(f"  Case Type:          {case.case_type or 'N/A'}")
        
        # Dates
        print(f"\n📅 DATES:")
        print(f"  Receipt Date:       {case.case_receipt_date}")
        print(f"  Receipt Month:      {case.receipt_month}")
        print(f"  Due Date:           {case.case_due_date}")
        print(f"  Completion Date:    {case.completion_date or 'Not Completed'}")
        
        # Status
        print(f"\n📊 STATUS:")
        print(f"  Full Case Status:   {case.full_case_status}")
        print(f"  Investigation:      {case.investigation_report_status}")
        print(f"  Scope of Work:      {case.scope_of_work or 'N/A'}")
        
        # Parties
        print(f"\n👥 PARTIES:")
        print(f"  Claimant:           {case.claimant_name or 'N/A'}")
        print(f"  Claimant District:  {case.claimant_district or 'N/A'}")
        print(f"  Insured:            {case.insured_name or 'N/A'}")
        print(f"  Driver:             {case.driver_name or 'N/A'}")
        
        # Documents
        print(f"\n📄 DOCUMENTS ({case.documents.count()}):")
        for doc in case.documents.all():
            size_kb = len(doc.extracted_text) if doc.extracted_text else 0
            print(f"  • {doc.document_type:15} - {doc.document_name}")
            if doc.extracted_text:
                print(f"    └─ Extracted Text: {size_kb:,} characters")
        
        # Source Email
        print(f"\n📧 SOURCE EMAIL:")
        if case.source_email:
            print(f"  Subject:            {case.source_email.subject[:80]}...")
            print(f"  From:               {case.source_email.sender_email}")
            print(f"  Received:           {case.source_email.received_at}")
        
        # Notes
        if case.case_notes:
            print(f"\n📝 NOTES:")
            for line in case.case_notes.split('\n')[:3]:
                print(f"  {line}")
        
        print(f"\n{'='*100}\n")
    
    print(f"\nTotal Cases: {cases.count()}")
    

if __name__ == '__main__':
    main()
