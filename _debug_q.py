import os, django, json
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()
from django.db import connections

with connections['default'].cursor() as c:
    # Find all completed claimant checks with questionnaire data
    c.execute("SELECT id, case_id, check_status, questionnaire FROM claimant_checks WHERE check_status = 'Completed' OR questionnaire IS NOT NULL ORDER BY id")
    rows = c.fetchall()
    for row in rows:
        check_id, case_id, status, q = row
        print(f"\n--- Check ID={check_id}, Case ID={case_id}, Status={status} ---")
        print(f"  questionnaire type: {type(q)}")
        print(f"  questionnaire raw: {repr(q)[:300]}")
        if isinstance(q, str):
            try:
                parsed = json.loads(q)
                print(f"  parsed type: {type(parsed)}, keys: {list(parsed.keys()) if isinstance(parsed, dict) else 'N/A'}")
                print(f"  parsed value: {parsed}")
            except Exception as e:
                print(f"  parse error: {e}")
        elif isinstance(q, dict):
            print(f"  already dict, keys: {list(q.keys())}")
            print(f"  values: {q}")
        else:
            print(f"  value: {q}")
