# Gmail OAuth Email Intake - Quick Start

## 🚀 Quick Setup (5 Minutes)

### 1. Get Google Cloud Credentials

1. Go to: https://console.cloud.google.com/
2. Create a new project: "Incident Management Email Intake"
3. Enable Gmail API: APIs & Services → Library → Gmail API → Enable
4. Create credentials: APIs & Services → Credentials → Create Credentials → OAuth client ID
5. Application type: **Desktop app**
6. Download JSON credentials

### 2. Update .env File

Open `.env` and update:

```env
GMAIL_CLIENT_ID=your_client_id.apps.googleusercontent.com
GMAIL_CLIENT_SECRET=your_client_secret
```

### 3. Install Packages

```bash
pip install -r requirements_email_intake.txt
```

### 4. Run Migrations

```bash
python manage.py makemigrations
python manage.py migrate
```

### 5. Authenticate with Gmail

```bash
python scripts/email/setup_gmail_oauth_interactive.py
```

Follow the prompts:
- Visit the authorization URL
- Sign in with Gmail
- Copy the authorization code
- Paste it back into the terminal

### 6. Test Email Polling

```bash
python manage.py poll_gmail_emails
```

## ✅ Done!

Your Gmail account is now connected. New emails will be:
- ✅ Fetched automatically
- ✅ Stored in PostgreSQL database
- ✅ PDF attachments downloaded
- ✅ Text extracted from PDFs

## 📊 View Email Data

### Django Admin
1. Create superuser: `python manage.py createsuperuser`
2. Run server: `python manage.py runserver`
3. Go to: http://localhost:8000/admin
4. View: Email Intakes, Email Attachments

### Python Shell
```python
python manage.py shell

from users.models import EmailIntake, EmailAttachment

# View all emails
emails = EmailIntake.objects.all()
for email in emails:
    print(f"{email.subject} - {email.sender_email}")

# View PDF attachments with extracted text
pdfs = EmailAttachment.objects.filter(is_pdf=True)
for pdf in pdfs:
    print(f"{pdf.filename}: {len(pdf.extracted_text)} characters")
```

## 🔄 Automated Polling

### Windows Task Scheduler
1. Open Task Scheduler
2. Create Task
3. Trigger: Repeat every 5 minutes
4. Action: `python manage.py poll_gmail_emails`

### Linux/Mac Cron
```bash
*/5 * * * * cd /path/to/project && python manage.py poll_gmail_emails
```

## 📚 Full Documentation

See [GMAIL_OAUTH_SETUP.md](GMAIL_OAUTH_SETUP.md) for complete guide.

## ❓ Troubleshooting

**"No OAuth tokens found"**
→ Run: `python manage.py setup_gmail_oauth`

**"Invalid grant"**
→ Authorization code expired, get a new one

**"Gmail API not enabled"**
→ Enable in Google Cloud Console

## 📞 Support

Check `logs/django.log` for detailed error messages.
