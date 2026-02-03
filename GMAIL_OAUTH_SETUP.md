# Gmail OAuth Email Intake - Setup Guide

## Overview

This feature enables automatic email fetching from Gmail using OAuth 2.0 authentication. When emails arrive, the system:

1. ✅ Fetches emails via Gmail API
2. ✅ Extracts email metadata (subject, sender, body, etc.)
3. ✅ Downloads PDF attachments
4. ✅ Extracts text content from PDFs
5. ✅ Stores everything in PostgreSQL database

## Prerequisites

- Gmail account
- Google Cloud Console account
- PostgreSQL database configured

## Setup Instructions

### Step 1: Install Required Packages

```bash
pip install -r requirements_email_intake.txt
```

This installs:
- `google-auth-oauthlib` - Gmail OAuth
- `google-api-python-client` - Gmail API
- `PyPDF2` and `pdfplumber` - PDF text extraction
- Email utilities

### Step 2: Configure Google Cloud Console

1. **Go to Google Cloud Console**
   - Visit: https://console.cloud.google.com/

2. **Create a Project** (or use existing)
   - Click "Select a project" → "New Project"
   - Enter project name
   - Click "Create"

3. **Enable Gmail API**
   - Go to "APIs & Services" → "Library"
   - Search for "Gmail API"
   - Click on it and press "Enable"

4. **Create OAuth 2.0 Credentials**
   - Go to "APIs & Services" → "Credentials"
   - Click "Create Credentials" → "OAuth client ID"
   - Configure consent screen if prompted:
     - User Type: External
     - App name: Incident Management Platform
     - User support email: your email
     - Developer contact: your email
   - Application type: **Desktop app**
   - Name: Gmail Email Intake
   - Click "Create"

5. **Download Credentials**
   - Click the download button (⬇) next to your credential
   - Open the JSON file
   - Copy the `client_id` and `client_secret` values

### Step 3: Update .env File

Edit your `.env` file and add:

```env
# Gmail OAuth
GMAIL_CLIENT_ID=your_client_id_here.apps.googleusercontent.com
GMAIL_CLIENT_SECRET=your_client_secret_here
```

Replace with your actual credentials from Step 2.

### Step 4: Run Database Migrations

```bash
python manage.py makemigrations
python manage.py migrate
```

This creates the following database tables:
- `EmailIntake` - Stores email metadata and content
- `EmailAttachment` - Stores attachments with extracted PDF text
- `GmailOAuthToken` - Stores OAuth tokens

### Step 5: Authenticate with Gmail

**Option A: Using Interactive Script (Recommended)**

```bash
python scripts/email/setup_gmail_oauth_interactive.py
```

**Option B: Using Django Management Command**

```bash
python manage.py setup_gmail_oauth
```

Both methods will:
1. Generate an authorization URL
2. Open your browser for Gmail authentication
3. Prompt for the authorization code
4. Save OAuth tokens to database

Follow the on-screen instructions.

### Step 6: Test Email Polling

```bash
python manage.py poll_gmail_emails
```

This will:
- Fetch unread emails
- Extract email data
- Download and process PDF attachments
- Save everything to database
- Mark emails as read

## Usage

### Manual Email Polling

Fetch emails on demand:

```bash
# Fetch up to 50 emails
python manage.py poll_gmail_emails

# Fetch specific number
python manage.py poll_gmail_emails --max-emails 100

# Poll specific Gmail account (if multiple configured)
python manage.py poll_gmail_emails --email your.email@gmail.com
```

### Automated Email Polling

Set up automated polling every 5 minutes:

**Windows (Task Scheduler)**
1. Open Task Scheduler
2. Create Basic Task
3. Trigger: Daily, repeat every 5 minutes
4. Action: Start a program
   - Program: `python`
   - Arguments: `manage.py poll_gmail_emails`
   - Start in: `D:\week2_backend_frontend\incident-management-platform-week2`

**Linux/Mac (Crontab)**
```bash
crontab -e

# Add this line (runs every 5 minutes)
*/5 * * * * cd /path/to/incident-management-platform-week2 && python manage.py poll_gmail_emails
```

## Database Schema

### EmailIntake Table

Stores incoming emails:

| Field | Type | Description |
|-------|------|-------------|
| message_id | String | Unique Gmail message ID |
| thread_id | String | Gmail thread ID |
| subject | String | Email subject |
| sender_email | Email | Sender's email address |
| sender_name | String | Sender's name |
| recipient_email | Email | Recipient email |
| cc_emails | Text | CC recipients (comma-separated) |
| bcc_emails | Text | BCC recipients (comma-separated) |
| body_text | Text | Plain text email body |
| body_html | Text | HTML email body |
| received_at | DateTime | When email was received |
| processing_status | String | PENDING/PROCESSING/COMPLETED/FAILED |
| processing_error | Text | Error message if failed |
| has_attachments | Boolean | True if email has attachments |
| created_at | DateTime | Record creation time |
| processed_at | DateTime | When processing completed |

### EmailAttachment Table

Stores email attachments:

| Field | Type | Description |
|-------|------|-------------|
| email | ForeignKey | Link to EmailIntake |
| filename | String | Original filename |
| content_type | String | MIME type |
| file_size | BigInteger | File size in bytes |
| file_path | File | Path to saved file |
| is_pdf | Boolean | True if PDF file |
| extracted_text | Text | Text extracted from PDF |
| created_at | DateTime | Record creation time |

### GmailOAuthToken Table

Stores OAuth credentials:

| Field | Type | Description |
|-------|------|-------------|
| email_address | Email | Gmail account (unique) |
| access_token | Text | OAuth access token |
| refresh_token | Text | OAuth refresh token |
| token_uri | URL | Token endpoint |
| client_id | String | OAuth client ID |
| client_secret | String | OAuth client secret |
| scopes | Text | API scopes |
| expires_at | DateTime | Token expiration time |
| is_active | Boolean | Active status |
| last_synced_at | DateTime | Last email sync time |

## Querying Email Data

### Python/Django Shell

```python
from users.models import EmailIntake, EmailAttachment

# Get all emails
emails = EmailIntake.objects.all()

# Get emails from specific sender
emails = EmailIntake.objects.filter(sender_email='sender@example.com')

# Get emails with PDF attachments
emails = EmailIntake.objects.filter(
    has_attachments=True,
    attachments__is_pdf=True
).distinct()

# Get extracted text from PDFs
for email in emails:
    for attachment in email.attachments.filter(is_pdf=True):
        print(f"PDF: {attachment.filename}")
        print(f"Text: {attachment.extracted_text[:200]}...")
```

### SQL Queries

```sql
-- Get all received emails
SELECT * FROM users_emailintake ORDER BY received_at DESC;

-- Get emails with attachments
SELECT 
    ei.subject,
    ei.sender_email,
    ea.filename,
    ea.file_size,
    LENGTH(ea.extracted_text) as text_length
FROM users_emailintake ei
JOIN users_emailattachment ea ON ea.email_id = ei.id
WHERE ea.is_pdf = true;

-- Get processing statistics
SELECT 
    processing_status,
    COUNT(*) as count
FROM users_emailintake
GROUP BY processing_status;
```

## Troubleshooting

### "No active Gmail OAuth tokens found"
- Run: `python manage.py setup_gmail_oauth`
- Or: `python scripts/email/setup_gmail_oauth_interactive.py`

### "Failed to refresh access token"
- OAuth token may have expired
- Re-authenticate: `python manage.py setup_gmail_oauth`

### "Gmail API not enabled"
- Enable Gmail API in Google Cloud Console
- Go to APIs & Services → Library → Gmail API → Enable

### "Invalid grant" error
- Authorization code expired (valid for ~10 minutes)
- Generate a new authorization URL and try again

### PDF text extraction fails
- Ensure `pdfplumber` and `PyPDF2` are installed
- Some PDFs may be image-based (requires OCR, not included)

### Emails not being fetched
- Check OAuth token is active: `GmailOAuthToken.objects.filter(is_active=True)`
- Check Gmail API quota limits
- Verify credentials in `.env` file

## Security Notes

1. **OAuth Tokens** - Stored encrypted in database
2. **Credentials** - Keep `.env` file secure, never commit to Git
3. **Scopes** - Only request necessary Gmail permissions
4. **Access** - OAuth tokens grant access to the authenticated Gmail account

## API Scopes

The application requests these Gmail API scopes:

- `https://www.googleapis.com/auth/gmail.readonly` - Read emails
- `https://www.googleapis.com/auth/gmail.modify` - Mark emails as read

## File Structure

```
users/
  models.py                        # EmailIntake, EmailAttachment, GmailOAuthToken models
  services/
    gmail_oauth.py                 # Gmail OAuth service
    email_processor.py             # Email parsing and PDF extraction
  management/
    commands/
      setup_gmail_oauth.py         # OAuth setup command
      poll_gmail_emails.py         # Email polling command

scripts/
  email/
    setup_gmail_oauth_interactive.py  # Interactive setup script

requirements_email_intake.txt      # Required packages
```

## Features

✅ **OAuth 2.0 Authentication** - Secure Gmail access
✅ **Automatic Email Fetching** - Poll for new emails
✅ **Email Metadata Extraction** - Subject, sender, body, etc.
✅ **Attachment Download** - Save all attachments
✅ **PDF Text Extraction** - Extract text from PDF files
✅ **Database Storage** - All data in PostgreSQL
✅ **Error Handling** - Robust error handling and logging
✅ **Multiple Accounts** - Support multiple Gmail accounts
✅ **Mark as Read** - Automatically mark processed emails

## Next Steps

After setup is complete:

1. Configure automated polling (cron/Task Scheduler)
2. Create API endpoints to query email data
3. Build frontend to display emails
4. Add email-to-case conversion logic
5. Implement email notifications

## Support

For issues or questions:
- Check logs: `logs/django.log`
- Review error messages in `EmailIntake.processing_error` field
- Verify Google Cloud Console configuration
