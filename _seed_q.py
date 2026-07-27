import requests
import json
import os, django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()
from django.db import connections

# 1. Direct DB insertion of a properly formatted dict
with connections['default'].cursor() as c:
    c.execute("""
        UPDATE claimant_checks 
        SET questionnaire = %s::jsonb 
        WHERE id = 15
    """, [json.dumps({
        "relation": "Spouse",
        "claim_type": "Injury",
        "deceased_injury_name": "Test Person",
        "description_of_accident": "Test accident"
    })])

print("Updated check 15 with full questionnaire data")
