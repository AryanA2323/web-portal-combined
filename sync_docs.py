import os
import django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()

from users.models import CaseVerification, VerificationDocument
from django.db import connection
import json

cursor = connection.cursor()
cursor.execute('SELECT id, case_id, case_documents FROM rto_checks')
rows = cursor.fetchall()
for row in rows:
    rto_check_id = row[0]
    case_id = row[1]
    existing = json.loads(row[2]) if row[2] else []
    cursor.execute('SELECT case_number FROM cases WHERE id = %s', [case_id])
    cn = cursor.fetchone()[0]
    verif = CaseVerification.objects.filter(case__case_number=cn, verification_type='RTO_CHECK').first()
    if verif:
        docs = VerificationDocument.objects.filter(verification=verif)
        print(f'Found {docs.count()} docs for case {case_id}')
        for d in docs:
            if any(e.get('filename') == d.file_name for e in existing): continue
            existing.append({
                'filename': d.file_name,
                'url': f'/media/{d.file_path}',
                'size': d.file_size,
                'mime_type': d.mime_type,
                'uploaded_at': d.uploaded_at.isoformat()
            })
        cursor.execute('UPDATE rto_checks SET case_documents = %s WHERE id = %s', [json.dumps(existing), rto_check_id])
        connection.commit()
print('Synced!')
