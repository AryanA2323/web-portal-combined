"""Delete all insurance cases and emails to reprocess"""
import os
import sys
import django

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()

from users.models import InsuranceCase, EmailIntake, CaseDocument, EmailAttachment

# Delete in order (respecting foreign keys)
case_doc_count = CaseDocument.objects.all().delete()[0]
case_count = InsuranceCase.objects.all().delete()[0]
attachment_count = EmailAttachment.objects.all().delete()[0]
email_count = EmailIntake.objects.all().delete()[0]

print(f"✅ Deleted:")
print(f"   - {case_count} insurance cases")
print(f"   - {case_doc_count} case documents")
print(f"   - {email_count} email records")
print(f"   - {attachment_count} attachments")
print(f"\n✅ Ready to reprocess emails!")
