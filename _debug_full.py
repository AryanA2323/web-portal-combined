import os, django, json, requests
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()

# First, let's see what the check data in DB looks like
from django.db import connections
with connections['default'].cursor() as c:
    # Find the vendor user and their checks
    c.execute("""
        SELECT cc.id, cc.case_id, cc.check_status, cc.assigned_vendor_id, cc.questionnaire,
               pg_typeof(cc.questionnaire) as col_type
        FROM claimant_checks cc
        WHERE cc.check_status IN ('Completed', 'Verified')
    """)
    for row in c.fetchall():
        print(f"Check id={row[0]}, case_id={row[1]}, status={row[2]}, vendor_id={row[3]}")
        print(f"  questionnaire pg_typeof: {row[5]}")
        print(f"  questionnaire python type: {type(row[4])}")
        print(f"  questionnaire value: {repr(row[4])[:300]}")
        print()

# Now simulate the exact backend code path that the API uses
print("=== Simulating API response ===")
with connections['default'].cursor() as cursor:
    meta_select = '''cc.id, cc.case_id, cc.check_status,
                     cc.claimant_name, cc.claimant_contact, cc.claimant_address,
                     cc.claimant_income, cc.statement, cc.triggers, cc.vendor_evidence AS evidence,
                     cc.vendor_documents AS vendor_documents, cc.case_documents AS case_documents,
                     cc.admin_feedback, cc.is_reassigned, cc.questionnaire'''
    meta_fields = ['id','case_id','check_status','claimant_name','claimant_contact',
                'claimant_address','claimant_income','statement','triggers','evidence',
                'vendor_documents','case_documents','admin_feedback','is_reassigned','questionnaire']
    
    cursor.execute(f"""
        SELECT {meta_select}
        FROM claimant_checks cc
        WHERE cc.check_status IN ('Completed', 'Verified')
        LIMIT 1
    """)
    check_row = cursor.fetchone()
    
    if check_row:
        check_detail = {}
        for i, field in enumerate(meta_fields):
            val = check_row[i]
            if hasattr(val, 'isoformat'):
                val = val.isoformat()
            
            # Parse questionnaire if it's a string (my new code)
            if field == 'questionnaire' and isinstance(val, str):
                try:
                    val = json.loads(val)
                except json.JSONDecodeError:
                    pass
            
            check_detail[field] = val
        
        print(f"check_detail['questionnaire'] type: {type(check_detail['questionnaire'])}")
        print(f"check_detail['questionnaire'] value: {check_detail['questionnaire']}")
        
        # What Django Ninja would serialize this as:
        response_json = json.dumps({"check": check_detail}, default=str)
        parsed_response = json.loads(response_json)
        print(f"\nFinal JSON response check.questionnaire type: {type(parsed_response['check']['questionnaire'])}")
        print(f"Final JSON response check.questionnaire value: {parsed_response['check']['questionnaire']}")
