import os, sys, django
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()

from users.models import EmailAttachment, InsuranceCase

case = InsuranceCase.objects.latest('created_at')
print(f"Case: {case.claim_number}")
print(f"Policy#: {case.policy_number}")
print(f"\n{'='*80}")

# Get policy PDF
policy_pdfs = case.documents.filter(document_type='POLICY')
if policy_pdfs.exists():
    for pdf in policy_pdfs:
        print(f"\n📄 {pdf.document_name}")
        print(f"{'─'*80}")
        
        text = pdf.extracted_text or ""
        if text:
            # Show first 2000 characters
            print(text[:2000])
            print(f"\n... (total {len(text)} characters)")
            
            # Look for key information
            print(f"\n🔍 SEARCHING FOR KEY DATA:")
            
            # Vehicle number
            import re
            reg_patterns = [r'(?:Registration|Reg\.?)\s*[Nn]o\.?\s*[-:]?\s*([A-Z]{2}[-\s]?\d{2}[-\s]?[A-Z]{1,2}[-\s]?\d{4})']
            for pattern in reg_patterns:
                match = re.search(pattern, text[:5000], re.IGNORECASE)
                if match:
                    print(f"  ✓ Registration: {match.group(1)}")
            
            # Insured name
            insured_patterns = [
                r'Insured\s*[Nn]ame\s*[-:]?\s*([A-Z][A-Za-z\s\.]+?)(?:\n|,|;)',
                r'Name\s+of\s+Insured\s*[-:]?\s*([A-Z][A-Za-z\s\.]+?)(?:\n|,)',
            ]
            for pattern in insured_patterns:
                match = re.search(pattern, text[:5000])
                if match:
                    print(f"  ✓ Insured Name: {match.group(1).strip()}")
                    break
        else:
            print("  (No text extracted)")

# Get petition PDF
print(f"\n{'='*80}\n")
petition_pdfs = case.documents.filter(document_type='PETITION')
if petition_pdfs.exists():
    for pdf in petition_pdfs:
        print(f"\n📄 {pdf.document_name}")
        print(f"{'─'*80}")
        
        text = pdf.extracted_text or ""
        if text:
            # Show first 1500 characters
            print(text[:1500])
            print(f"\n... (total {len(text)} characters)")
        else:
            print("  (No text extracted - might be scanned image)")
