import os

def replace_in_file(filepath, old, new):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    
    if old in content or old.replace('_', ' ').title() in content:
        content = content.replace(old, new)
        # Also handle "Scope of Work" -> "Special Instructions"
        old_title = old.replace('_', ' ').title()
        new_title = new.replace('_', ' ').title()
        content = content.replace(old_title, new_title)
        
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)
        print(f"Updated {filepath}")

backend_files = [
    'users/incident_case_db.py',
    'users/models.py',
    'users/models_insurance.py',
    'users/api/cases.py',
    'users/api/vendor_cases.py',
    'users/api/verifications.py',
    'users/services/email_to_case_mapper.py',
    'users/services/email_to_case_mapper_enhanced.py',
    'users/services/ai_brief_service.py',
    'users/migrations/0020_add_common_case_fields.py',
    'users/migrations/0022_create_raw_case_tables.py'
]

for f in backend_files:
    if os.path.exists(f):
        replace_in_file(f, 'scope_of_work', 'special_instructions')
