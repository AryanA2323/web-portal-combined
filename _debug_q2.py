import os, django, json
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()
from django.db import connections

# Simulate the exact backend code path
_CHECK_DETAIL_COLUMNS = {
    'claimant_checks': {
        'select': '''cc.id, cc.case_id, cc.check_status,
                     cc.claimant_name, cc.claimant_contact, cc.claimant_address,
                     cc.claimant_income, cc.statement, cc.triggers, cc.vendor_evidence AS evidence,
                     cc.vendor_documents AS vendor_documents, cc.case_documents AS case_documents,
                     cc.admin_feedback, cc.is_reassigned, cc.questionnaire''',
        'alias': 'cc',
        'fields': ['id','case_id','check_status','claimant_name','claimant_contact',
                    'claimant_address','claimant_income','statement','triggers','evidence',
                    'vendor_documents','case_documents','admin_feedback','is_reassigned','questionnaire'],
    },
}

with connections['default'].cursor() as cursor:
    meta = _CHECK_DETAIL_COLUMNS['claimant_checks']
    alias = meta['alias']
    
    # Look for the completed check
    cursor.execute(f"""
        SELECT {meta['select']}
        FROM claimant_checks {alias}
        WHERE {alias}.check_status IN ('Completed', 'Verified')
        LIMIT 1
    """)
    check_row = cursor.fetchone()
    
    if check_row:
        for i, field in enumerate(meta['fields']):
            val = check_row[i]
            if field == 'questionnaire':
                print(f"\n=== QUESTIONNAIRE FIELD ===")
                print(f"  Index: {i}")
                print(f"  Raw type: {type(val)}")
                print(f"  Raw value: {repr(val)[:500]}")
                
                # Apply the same parsing logic as in vendor_cases.py
                if hasattr(val, 'isoformat'):
                    val = val.isoformat()
                
                if isinstance(val, str):
                    try:
                        parsed = json.loads(val)
                        print(f"  After json.loads: type={type(parsed)}, value={parsed}")
                    except json.JSONDecodeError:
                        print(f"  json.loads FAILED")
                elif isinstance(val, dict):
                    print(f"  Already a dict: {val}")
                else:
                    print(f"  Unexpected type after isoformat check: {type(val)}")
                    
        print(f"\n=== Check status: {check_row[2]} ===")
    else:
        print("No completed claimant checks found")
