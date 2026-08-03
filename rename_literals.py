import os

def replace_in_file(filepath, old, new):
    if not os.path.exists(filepath):
        return
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    
    if old in content:
        content = content.replace(old, new)
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)
        print(f"Updated {filepath}")

files = [
    'Vendor_Portal/src/screens/CaseDetails.tsx',
    'users/services/ai_brief_service.py',
    'frontend/src/pages/case_manager/NewCasePage.jsx',
    'frontend/src/pages/case_manager/CasesPage.jsx'
]

for f in files:
    replace_in_file(f, 'Scope of Work', 'Special Instructions')
    replace_in_file(f, 'scope of work', 'special instructions')
