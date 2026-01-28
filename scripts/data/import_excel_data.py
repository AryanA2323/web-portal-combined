"""
Script to import existing case data from Excel file into PostgreSQL database.

This script:
1. Creates client users for each insurance company
2. Imports all 501 cases from the Excel file
3. Maps Excel columns to the Case model fields
"""

import os
import sys
import django

# Setup Django environment
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()

import pandas as pd
from datetime import datetime
from django.db import transaction
from django.utils import timezone
from users.models import CustomUser
from cases.models import Case


# Client mapping: CLIENT CODE -> Company Name
CLIENT_MAPPING = {
    'M002': 'Magma HDI General Insurance Company Ltd',
    'F001': 'Generali Central Insurance Company Limited',
    'I001': 'Indusind General Insurance Co Ltd',
    'S001': 'SBI General Insurance Company Ltd',
    'B001': 'Bajaj Allianz General Insurance Company Ltd',
}


def create_client_users():
    """Create client users for each insurance company."""
    print("\n=== Creating Client Users ===")
    
    clients_created = 0
    for code, name in CLIENT_MAPPING.items():
        username = code.lower()
        email = f"{username}@insurance.com"
        
        user, created = CustomUser.objects.get_or_create(
            username=username,
            defaults={
                'email': email,
                'first_name': name,
                'role': CustomUser.Role.CLIENT,
                'is_active': True,
            }
        )
        
        if created:
            user.set_password('client123')  # Default password
            user.save()
            clients_created += 1
            print(f"  ✓ Created: {name} ({username})")
        else:
            print(f"  - Exists: {name} ({username})")
    
    print(f"\nTotal clients created: {clients_created}")
    return clients_created


def get_client_code_from_name(client_name):
    """Get client code from client name."""
    for code, name in CLIENT_MAPPING.items():
        if name == client_name:
            return code
    return None


def import_cases_from_excel(excel_path):
    """Import cases from Excel file."""
    print("\n=== Importing Cases from Excel ===")
    
    # Read Excel file
    df = pd.read_excel(excel_path)
    print(f"Found {len(df)} records in Excel file")
    
    # Track statistics
    cases_created = 0
    cases_skipped = 0
    errors = []
    
    with transaction.atomic():
        for index, row in df.iterrows():
            try:
                # Get CRN (Case Reference Number)
                crn = str(row.get('CRN', '')).strip()
                if not crn or crn == 'nan':
                    cases_skipped += 1
                    continue
                
                # Check if case already exists
                if Case.objects.filter(case_number=crn).exists():
                    cases_skipped += 1
                    continue
                
                # Get client
                client_code = str(row.get('CLIENT CODE', '')).strip()
                client_name = str(row.get('CLIENT NAME', '')).strip()
                
                # Find or determine client code
                if not client_code or client_code == 'nan':
                    client_code = get_client_code_from_name(client_name)
                
                if not client_code:
                    client_code = 'M002'  # Default to Magma
                
                # Get client user
                try:
                    client_user = CustomUser.objects.get(username=client_code.lower())
                except CustomUser.DoesNotExist:
                    client_user = CustomUser.objects.filter(role=CustomUser.Role.CLIENT).first()
                    if not client_user:
                        errors.append(f"Row {index}: No client found for {client_code}")
                        continue
                
                # Get insured name
                insured_name = str(row.get('INSURED NAME', '')).strip()
                if insured_name == 'nan':
                    insured_name = ''
                
                # Get title (use insured name or CRN)
                title = insured_name if insured_name else f"Case {crn}"
                
                # Get claim number
                claim_number = str(row.get('CLAIM NUMBER', '')).strip()
                if claim_number == 'nan':
                    claim_number = ''
                
                # Get category
                category_str = str(row.get('CATEGORY', 'MACT')).strip().upper()
                if category_str == 'nan' or not category_str:
                    category_str = 'MACT'
                category = Case.Category.MACT if category_str == 'MACT' else Case.Category.OTHER
                
                # Get receipt date
                receipt_date = row.get('CASE RECIPET DATE')
                if pd.notna(receipt_date):
                    if isinstance(receipt_date, str):
                        try:
                            receipt_date = datetime.strptime(receipt_date, '%Y-%m-%d')
                        except:
                            receipt_date = None
                else:
                    receipt_date = None
                
                # Helper function to safely convert to bool
                def to_bool(val):
                    if pd.isna(val):
                        return False
                    try:
                        return bool(int(float(val)))
                    except:
                        return False
                
                # Create case
                case = Case(
                    case_number=crn,
                    title=title,
                    description=f"Imported from Excel. Client: {client_name}",
                    client=client_user,
                    source=Case.Source.IMPORT,
                    status=Case.Status.OPEN,
                    priority=Case.Priority.MEDIUM,
                    category=category,
                    claim_number=claim_number,
                    client_code=client_code,
                    insured_name=insured_name,
                    # Investigation checklist fields
                    chk_insured=to_bool(row.get('INSURED')),
                    chk_134_notice=to_bool(row.get('134 NOTICE')),
                    chk_claimant=to_bool(row.get('CLAIMANT')),
                    chk_income=to_bool(row.get('INCOME')),
                    chk_driver=to_bool(row.get('DRIVER')),
                    chk_dl=to_bool(row.get('DL')),
                    chk_rc=to_bool(row.get('RC')),
                    chk_permit=to_bool(row.get('PERMIT')),
                    chk_spot=to_bool(row.get('SPOT')),
                    chk_court=to_bool(row.get('COURT')),
                    chk_notice=to_bool(row.get('NOTICE')),
                    chk_rti=to_bool(row.get('RTI')),
                    chk_hospital=to_bool(row.get('HOSPITAL')),
                    chk_witness=to_bool(row.get('WITNESS')),
                    chk_medical_verification=to_bool(row.get('MEDICAL VERIFICATION')),
                    workflow_type=str(row.get('WT', 'WT')).strip() if pd.notna(row.get('WT')) else 'WT',
                )
                case.save()
                cases_created += 1
                
                if cases_created % 50 == 0:
                    print(f"  Progress: {cases_created} cases imported...")
                
            except Exception as e:
                errors.append(f"Row {index}: {str(e)}")
    
    print(f"\n=== Import Summary ===")
    print(f"Cases created: {cases_created}")
    print(f"Cases skipped: {cases_skipped}")
    print(f"Errors: {len(errors)}")
    
    if errors:
        print("\nFirst 10 errors:")
        for error in errors[:10]:
            print(f"  - {error}")
    
    return cases_created, cases_skipped, errors


def main():
    """Main function to run the import."""
    print("=" * 60)
    print("INSURANCE MANAGEMENT SYSTEM - DATA IMPORT")
    print("=" * 60)
    
    # Excel file path
    excel_path = os.path.join(
        os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))),
        'Insurance Management Information System (2).xlsx'
    )
    
    if not os.path.exists(excel_path):
        print(f"ERROR: Excel file not found at: {excel_path}")
        return
    
    print(f"Excel file: {excel_path}")
    
    # Step 1: Create client users
    create_client_users()
    
    # Step 2: Import cases
    cases_created, cases_skipped, errors = import_cases_from_excel(excel_path)
    
    print("\n" + "=" * 60)
    print("IMPORT COMPLETED")
    print("=" * 60)
    print(f"Total cases in database: {Case.objects.count()}")
    print(f"Total clients in database: {CustomUser.objects.filter(role=CustomUser.Role.CLIENT).count()}")


if __name__ == '__main__':
    main()
