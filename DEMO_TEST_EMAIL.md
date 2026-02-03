# 🎯 Quick Demo: Test PDF Email Extraction

## Send a Test Email

**To test the complete feature including PDF extraction:**

### Step 1: Send Email

Send an email to: **shoveltechsolutions0@gmail.com**

**Email Content:**
```
Subject: Test Incident Report - Water Damage

Body:
Hello,

This is a test incident report for water damage at 123 Main Street.

Incident Details:
- Type: Water Damage
- Location: 123 Main St, City
- Date: February 3, 2026
- Severity: High

Please see attached PDF for inspection photos and details.

Thank you,
Test User
```

**Attachment:** Attach any PDF file (invoice, report, document, etc.)

### Step 2: Fetch the Email

Run the polling command:
```bash
python manage.py poll_gmail_emails
```

### Step 3: Verify Data

Check the database:
```bash
python manage.py shell
```

```python
from users.models import EmailIntake, EmailAttachment

# Get the latest email
email = EmailIntake.objects.latest('received_at')
print(f"Subject: {email.subject}")
print(f"From: {email.sender_email}")
print(f"Body: {email.body_text[:200]}...")
print(f"Has Attachments: {email.has_attachments}")

# Check attachments
if email.has_attachments:
    for attachment in email.attachments.all():
        print(f"\nAttachment: {attachment.filename}")
        print(f"Type: {attachment.content_type}")
        print(f"Size: {attachment.file_size} bytes")
        print(f"Is PDF: {attachment.is_pdf}")
        
        if attachment.is_pdf and attachment.extracted_text:
            print(f"\nExtracted Text ({len(attachment.extracted_text)} chars):")
            print(attachment.extracted_text[:500])
```

## Expected Output

```
Subject: Test Incident Report - Water Damage
From: yourname@gmail.com
Body: Hello,

This is a test incident report for water damage...
Has Attachments: True

Attachment: incident_report.pdf
Type: application/pdf
Size: 45678 bytes
Is PDF: True

Extracted Text (2345 chars):
[PDF text content will be displayed here...]
```

---

## What Gets Extracted

### Email Data
- ✅ Message ID
- ✅ Subject
- ✅ Sender email and name
- ✅ Recipient email
- ✅ CC/BCC emails
- ✅ Body (both text and HTML)
- ✅ Received timestamp

### Attachment Data
- ✅ Filename
- ✅ Content type (MIME type)
- ✅ File size
- ✅ File saved to disk
- ✅ PDF detection
- ✅ **Text extracted from PDF** (if it's a text-based PDF)

### Database Storage
All data is stored in PostgreSQL and can be queried via:
- Django ORM
- SQL queries
- Django Admin panel
- API endpoints (when you create them)

---

## Try It Now!

1. Send the test email with a PDF
2. Run: `python manage.py poll_gmail_emails`
3. Check the results in the database
4. See your PDF text extracted automatically!

🎉 Your Gmail OAuth email intake with PDF extraction is **fully operational**!
