# 📧 Gmail OAuth Email Intake - Complete Implementation Guide

## 🎯 Overview

Your incident management platform now has **Gmail OAuth email intake** functionality! 

When any email arrives at your configured Gmail account:
1. ✅ Email is automatically fetched via Gmail API
2. ✅ Email data extracted (subject, sender, body, etc.)
3. ✅ PDF attachments downloaded
4. ✅ Text extracted from PDFs
5. ✅ Everything stored in PostgreSQL database

---

## 📋 Prerequisites

Before you begin, ensure you have:
- ✅ Gmail account (the one you want to monitor)
- ✅ Google Cloud Console account
- ✅ PostgreSQL database running
- ✅ Python 3.7+ installed
- ✅ Project dependencies installed

---

## 🚀 Step-by-Step Setup

### Step 1: Google Cloud Console Setup (5 minutes)

#### 1.1 Create/Select Project
1. Go to: https://console.cloud.google.com/
2. Click "Select a project" → "New Project"
3. Project name: `Incident Management Email Intake`
4. Click "Create"

#### 1.2 Enable Gmail API
1. Go to: "APIs & Services" → "Library"
2. Search for: `Gmail API`
3. Click on it
4. Click "Enable"

#### 1.3 Configure OAuth Consent Screen
1. Go to: "APIs & Services" → "OAuth consent screen"
2. User Type: **External** (or Internal if using Google Workspace)
3. Click "Create"
4. Fill in required fields:
   - App name: `Incident Management Platform`
   - User support email: Your email
   - Developer contact: Your email
5. Click "Save and Continue"
6. Scopes: Click "Save and Continue" (default scopes are fine)
7. Test users: Add your Gmail address
8. Click "Save and Continue"

#### 1.4 Create OAuth Credentials
1. Go to: "APIs & Services" → "Credentials"
2. Click "Create Credentials" → "OAuth client ID"
3. Application type: **Desktop app**
4. Name: `Gmail Email Intake`
5. Click "Create"
6. **IMPORTANT:** Copy the Client ID and Client Secret

---

### Step 2: Configure Your Project (2 minutes)

#### 2.1 Update .env File

Open your `.env` file and update these lines:

```env
# Gmail OAuth Configuration
GMAIL_CLIENT_ID=1234567890-abc123def456.apps.googleusercontent.com
GMAIL_CLIENT_SECRET=GOCSPX-abc123def456ghi789
```

Replace with the **Client ID** and **Client Secret** from Step 1.4.

---

### Step 3: Install Dependencies (1 minute)

```bash
pip install -r requirements_email_intake.txt
```

This installs:
- Google Auth & Gmail API libraries
- PDF processing libraries (pdfplumber, PyPDF2)
- Email utilities

---

### Step 4: Run Database Migrations (1 minute)

```bash
python manage.py makemigrations
python manage.py migrate
```

This creates three new database tables:
- `users_emailintake` - Stores emails
- `users_emailattachment` - Stores attachments
- `users_gmailoauthtoken` - Stores OAuth tokens

---

### Step 5: Authenticate with Gmail (3 minutes)

#### Option A: Interactive Script (Recommended)

```bash
python scripts/email/setup_gmail_oauth_interactive.py
```

#### Option B: Django Management Command

```bash
python manage.py setup_gmail_oauth
```

**Both methods will:**
1. Display an authorization URL
2. Open your browser (or you copy the URL)
3. Ask you to sign in with Gmail
4. Request permissions
5. Redirect to a callback URL with a code
6. Prompt you to paste the authorization code
7. Save the OAuth tokens to database

**Important:** The authorization code expires in ~10 minutes. If it expires, just run the command again.

---

### Step 6: Test Email Polling (1 minute)

```bash
python manage.py poll_gmail_emails
```

**What this does:**
- Fetches unread emails from Gmail
- Parses email data
- Downloads attachments
- Extracts text from PDFs
- Saves everything to database
- Marks emails as read

**Expected output:**
```
Starting Gmail email polling...

Processing emails for: your.email@gmail.com
  Found 3 new emails
  ✓ Processed email: abc123...
    Subject: Test Email with PDF
    From: sender@example.com
    ✓ Saved attachment: document.pdf (245678 bytes)
      PDF text extracted: 1234 characters
  ✓ Processed email: def456...
  ✓ Processed email: ghi789...

✓ Successfully processed 3 emails
```

---

## 🔄 Automated Email Polling

To automatically check for new emails every 5 minutes:

### Windows (Task Scheduler)

1. Open **Task Scheduler**
2. Click "Create Basic Task"
3. Name: `Gmail Email Polling`
4. Trigger: **Daily**
5. Check "Repeat task every": **5 minutes**
6. Duration: **Indefinitely**
7. Action: **Start a program**
   - Program/script: `python`
   - Add arguments: `manage.py poll_gmail_emails`
   - Start in: `D:\week2_backend_frontend\incident-management-platform-week2`
8. Finish

### Linux/Mac (Cron)

```bash
crontab -e

# Add this line (runs every 5 minutes)
*/5 * * * * cd /path/to/incident-management-platform-week2 && /usr/bin/python manage.py poll_gmail_emails >> /var/log/gmail_polling.log 2>&1
```

---

## 📊 Accessing Email Data

### Method 1: Django Admin

```bash
# Create superuser if you haven't
python manage.py createsuperuser

# Run server
python manage.py runserver

# Visit: http://localhost:8000/admin
# Login and view:
# - Email intakes
# - Email attachments
```

### Method 2: Django Shell

```bash
python manage.py shell
```

```python
from users.models import EmailIntake, EmailAttachment

# Get all emails
emails = EmailIntake.objects.all()
for email in emails:
    print(f"{email.subject} from {email.sender_email}")

# Get emails with PDF attachments
emails_with_pdfs = EmailIntake.objects.filter(
    has_attachments=True,
    attachments__is_pdf=True
).distinct()

# View extracted PDF text
for email in emails_with_pdfs:
    print(f"\nEmail: {email.subject}")
    for attachment in email.attachments.filter(is_pdf=True):
        print(f"PDF: {attachment.filename}")
        print(f"Size: {attachment.file_size} bytes")
        print(f"Text: {attachment.extracted_text[:200]}...")
```

### Method 3: SQL Queries

```sql
-- View all emails
SELECT * FROM users_emailintake 
ORDER BY received_at DESC 
LIMIT 10;

-- View emails with PDF attachments
SELECT 
    ei.subject,
    ei.sender_email,
    ei.received_at,
    ea.filename,
    ea.file_size,
    LENGTH(ea.extracted_text) as text_chars
FROM users_emailintake ei
JOIN users_emailattachment ea ON ea.email_id = ei.id
WHERE ea.is_pdf = true
ORDER BY ei.received_at DESC;

-- Processing statistics
SELECT 
    processing_status,
    COUNT(*) as count
FROM users_emailintake
GROUP BY processing_status;
```

---

## 🧪 Testing the Implementation

### Test 1: Send Test Email

1. Send an email to your configured Gmail account
2. Include a PDF attachment
3. Subject: "Test Email - Incident Report"

### Test 2: Poll for Emails

```bash
python manage.py poll_gmail_emails
```

### Test 3: Verify Database

```bash
python manage.py shell
```

```python
from users.models import EmailIntake, EmailAttachment

# Check if email was received
email = EmailIntake.objects.filter(subject__icontains="Test Email").first()
print(f"Subject: {email.subject}")
print(f"From: {email.sender_email}")
print(f"Body: {email.body_text[:200]}")

# Check PDF attachment
pdf = EmailAttachment.objects.filter(email=email, is_pdf=True).first()
print(f"PDF: {pdf.filename}")
print(f"Text extracted: {len(pdf.extracted_text)} characters")
print(f"First 200 chars: {pdf.extracted_text[:200]}")
```

---

## 🗃️ Database Schema Reference

### EmailIntake Table

| Column | Type | Description |
|--------|------|-------------|
| id | BigInteger | Primary key |
| message_id | String(255) | Gmail message ID (unique) |
| thread_id | String(255) | Gmail thread ID |
| subject | String(500) | Email subject |
| sender_email | Email | Sender's email |
| sender_name | String(255) | Sender's name |
| recipient_email | Email | Recipient email |
| cc_emails | Text | CC recipients |
| bcc_emails | Text | BCC recipients |
| body_text | Text | Plain text body |
| body_html | Text | HTML body |
| received_at | DateTime | When received |
| processing_status | String(20) | Status (PENDING/PROCESSING/COMPLETED/FAILED) |
| processing_error | Text | Error message |
| has_attachments | Boolean | Has attachments flag |
| created_at | DateTime | Record created |
| processed_at | DateTime | Processing completed |

### EmailAttachment Table

| Column | Type | Description |
|--------|------|-------------|
| id | BigInteger | Primary key |
| email_id | ForeignKey | Link to EmailIntake |
| filename | String(500) | File name |
| content_type | String(100) | MIME type |
| file_size | BigInteger | Size in bytes |
| file_path | FileField | Path to file |
| is_pdf | Boolean | Is PDF file |
| extracted_text | Text | Extracted text from PDF |
| created_at | DateTime | Record created |

### GmailOAuthToken Table

| Column | Type | Description |
|--------|------|-------------|
| id | BigInteger | Primary key |
| email_address | Email | Gmail account (unique) |
| access_token | Text | OAuth access token |
| refresh_token | Text | OAuth refresh token |
| token_uri | URL | Token endpoint |
| client_id | String(500) | OAuth client ID |
| client_secret | String(500) | OAuth client secret |
| scopes | Text | API scopes |
| expires_at | DateTime | Token expiration |
| is_active | Boolean | Active status |
| last_synced_at | DateTime | Last sync time |
| created_at | DateTime | Created at |
| updated_at | DateTime | Updated at |

---

## 🛠️ Troubleshooting

### Problem: "No active Gmail OAuth tokens found"

**Solution:**
```bash
python manage.py setup_gmail_oauth
```

### Problem: "Invalid grant" error during setup

**Cause:** Authorization code expired (valid for ~10 minutes)

**Solution:** Run the setup command again and paste the code faster

### Problem: "Gmail API has not been used in project"

**Cause:** Gmail API not enabled

**Solution:** 
1. Go to Google Cloud Console
2. APIs & Services → Library
3. Search "Gmail API"
4. Click "Enable"

### Problem: PDF text extraction returns empty string

**Cause:** PDF might be image-based (scanned document)

**Note:** Image-based PDFs require OCR, which is not included. Only text-based PDFs are supported.

### Problem: "Access blocked: This app's request is invalid"

**Cause:** OAuth consent screen not configured

**Solution:**
1. Go to Google Cloud Console
2. APIs & Services → OAuth consent screen
3. Complete the configuration
4. Add your email as a test user

### Problem: Token refresh fails

**Solution:**
```bash
# Re-authenticate
python manage.py setup_gmail_oauth
```

---

## 🔒 Security Best Practices

1. **Never commit .env file** to Git
2. **Rotate OAuth tokens** periodically
3. **Limit API scopes** to only what's needed
4. **Monitor API usage** in Google Cloud Console
5. **Use environment variables** for all credentials
6. **Enable 2FA** on your Gmail account

---

## 📈 Usage Statistics

```python
from users.models import EmailIntake, EmailAttachment
from django.db.models import Count, Sum

# Email statistics
stats = {
    'total_emails': EmailIntake.objects.count(),
    'with_attachments': EmailIntake.objects.filter(has_attachments=True).count(),
    'total_attachments': EmailAttachment.objects.count(),
    'pdf_count': EmailAttachment.objects.filter(is_pdf=True).count(),
    'total_pdf_size': EmailAttachment.objects.filter(is_pdf=True).aggregate(Sum('file_size'))['file_size__sum'] or 0,
}

print(f"Total emails: {stats['total_emails']}")
print(f"Emails with attachments: {stats['with_attachments']}")
print(f"Total attachments: {stats['total_attachments']}")
print(f"PDF files: {stats['pdf_count']}")
print(f"Total PDF size: {stats['total_pdf_size'] / 1024 / 1024:.2f} MB")
```

---

## 🎯 Next Steps

Now that Gmail OAuth is working, you can:

1. **Create API Endpoints** to expose email data
2. **Build Frontend UI** to display emails
3. **Add Email Filtering** rules
4. **Implement Auto-Case Creation** from emails
5. **Add Email Templates** for responses
6. **Create Email Notifications**
7. **Add OCR Support** for image-based PDFs
8. **Implement Email Search** functionality

---

## 📚 Documentation Files

1. **GMAIL_QUICK_START.md** - Quick 5-minute setup
2. **GMAIL_OAUTH_SETUP.md** - Detailed setup with troubleshooting
3. **GMAIL_IMPLEMENTATION_SUMMARY.md** - Technical implementation details
4. **This file** - Complete user guide

---

## ✅ Feature Checklist

- ✅ Gmail OAuth 2.0 authentication
- ✅ Automatic email polling
- ✅ Email metadata extraction
- ✅ Full email body storage (text + HTML)
- ✅ Attachment download
- ✅ PDF detection
- ✅ PDF text extraction (dual engine)
- ✅ PostgreSQL storage
- ✅ Error handling
- ✅ Token auto-refresh
- ✅ Multiple account support
- ✅ Mark as read functionality
- ✅ Management commands
- ✅ Interactive setup
- ✅ Comprehensive documentation

---

## 🎉 Success!

Your Gmail OAuth email intake is now fully configured and operational!

**Test it now:**
1. Send a test email with a PDF to your Gmail
2. Run: `python manage.py poll_gmail_emails`
3. Check the database

**Questions?** Check the troubleshooting section or review the logs at `logs/django.log`

---

**Status:** ✅ IMPLEMENTATION COMPLETE
**Date:** February 3, 2026
