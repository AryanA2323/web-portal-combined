import os

def replace_in_file(filepath, old, new):
    if not os.path.exists(filepath):
        return
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

frontend_files = [
    'frontend/src/pages/case_manager/NewCasePage.jsx',
    'frontend/src/pages/case_manager/CasesPage.jsx',
    'frontend/src/pages/case_manager/CheckDetailPage.jsx',
    'Vendor_Portal/src/screens/CaseDetails.tsx'
]

for f in frontend_files:
    replace_in_file(f, 'scope_of_work', 'special_instructions')
