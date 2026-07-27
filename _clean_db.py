import os, django, json
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()
from django.db import connections

with connections['default'].cursor() as c:
    c.execute("SELECT id, questionnaire FROM claimant_checks WHERE questionnaire IS NOT NULL")
    rows = c.fetchall()
    
    for row in rows:
        check_id = row[0]
        q = row[1]
        
        if isinstance(q, str):
            try:
                parsed = json.loads(q)
                print(f"Check {check_id} parsed keys: {list(parsed.keys())[:5]}")
                if "0" in parsed and "1" in parsed:
                    clean = {k: v for k, v in parsed.items() if not k.isdigit()}
                    print(f"Cleaning Check {check_id} -> {clean}")
                    c.execute("UPDATE claimant_checks SET questionnaire = %s WHERE id = %s", [json.dumps(clean), check_id])
            except Exception as e:
                print(f"Check {check_id} error parsing: {e}")
        else:
            print(f"Check {check_id} type is {type(q)}")
