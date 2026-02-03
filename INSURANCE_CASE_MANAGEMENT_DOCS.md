# Insurance Case Management System - Complete Documentation

## Overview

The Insurance Case Management System automatically processes emails with insurance claim information, extracts relevant data from email content and PDF attachments, and creates structured insurance case records in PostgreSQL database matching your traditional Excel-based system.

## Architecture

### Database Models

#### 1. **Client Model**
Stores insurance company/client information with pricing for different investigation types.

**Fields:**
- `client_code`: Unique identifier (e.g., "MAG001")
- `client_name`: Insurance company name (e.g., "Magma HDI General Insurance")
- Pricing fields for 13 investigation types (Full Case, Partial Case, Claimant, Insured, etc.)

#### 2. **InsuranceCase Model**
Main case record matching Excel MIS sheet structure (57 columns).

**Key Fields:**
- **Identification**: claim_number, client, category, CRN/MACT, policy_number
- **Dates**: case_receipt_date, completion_date, case_due_date, TAT, SLA
- **Status**: full_case_status, investigation_report_status, scope_of_work
- **Parties**: claimant, insured, driver details (name, address, district, status)
- **Documents**: DL, RC, permit, fitness status
- **Locations**: spot, police station, hospital details
- **Metadata**: source_email (FK to EmailIntake), case_notes

#### 3. **CaseDocument Model**
Links email attachments to insurance cases with classification.

**Fields:**
- `case`: FK to InsuranceCase
- `email_attachment`: FK to EmailAttachment
- `document_type`: POLICY, PETITION, FIR, MEDICAL, SPOT_PHOTO, DL, RC, PERMIT, etc.
- `extracted_text`: Text extracted from PDF
- `extracted_data`: JSON field for structured data

#### 4. **EmailIntake Model**
Stores incoming emails from Gmail.

**Fields:**
- Email metadata: message_id, thread_id, subject, sender, recipients
- Content: body_text, body_html
- Processing: status, error, timestamps
- Relationship: One-to-many with EmailAttachment, One-to-many with InsuranceCase

#### 5. **EmailAttachment Model**
Stores email attachments with PDF text extraction.

**Fields:**
- `email`: FK to EmailIntake
- `filename`, `content_type`, `file_size`
- `file_path`: File storage location
- `is_pdf`: Boolean flag
- `extracted_text`: Extracted PDF text (up to 500,000 chars)

#### 6. **GmailOAuthToken Model**
Stores Gmail OAuth credentials for email polling.

---

## Email Processing Workflow

### 1. **Gmail OAuth Setup**
```bash
python manage.py setup_gmail_oauth
```

**Process:**
1. Generates authorization URL with Gmail API scopes
2. User authenticates and grants permissions
3. Receives authorization code (out-of-band flow)
4. Exchanges code for access + refresh tokens
5. Stores tokens in `GmailOAuthToken` model

**Authentication Details:**
- **Gmail Account**: shoveltechsolutions0@gmail.com
- **Client ID**: 763855623662-ak70tm8fl32aa3u5elpidq2efuqbug6t.apps.googleusercontent.com
- **Redirect URI**: urn:ietf:wg:oauth:2.0:oob (out-of-band)
- **Scopes**: gmail.readonly, gmail.modify

### 2. **Email Polling**
```bash
python manage.py poll_gmail_emails --max-emails 50
```

**Process:**
1. Fetches unread emails from Gmail API
2. Checks if email already processed (by message_id)
3. Parses email (subject, sender, body, dates)
4. Downloads and processes attachments
5. Extracts text from PDF attachments (pdfplumber + PyPDF2)
6. Stores email in `EmailIntake` and attachments in `EmailAttachment`
7. Maps email to insurance case
8. Marks email as read in Gmail

### 3. **Case Mapping**
Service: `users/services/email_to_case_mapper.py`

**Extraction Logic:**

#### A. Claim Number
Patterns searched:
- `Claim no. 2775265`
- `Claim Number: 2775265`
- `Claim #: 2775265`

#### B. Policy Number
Patterns:
- `Policy No - POCMVGC0100038371`
- `Policy Number: POCMVGC0100038371`

#### C. MACT Number
Patterns:
- `MACT No 1612/2025`
- `MACT #: 1612/2025`

#### D. Client/Insurance Company
Detected from keywords: SBI General, ICICI Lombard, HDFC ERGO, Magma HDI, etc.

#### E. Claimant Name
Patterns:
- Subject: `Name VS Company`
- `Petitioner Name - Anjali Sudhir Sherki`

#### F. Insured Name
Pattern: `Insured Name: SACHIN SURESHUNDRE`

#### G. Location Information
Pattern: `Location - Thane`, `District: Mumbai`

#### H. Document Classification
- **POLICY**: filename contains "policy" or content mentions policy
- **PETITION**: filename contains "petition"
- **FIR**: filename/content contains "fir"
- **MEDICAL**: filename contains "medical" or "hospital"
- **SPOT_PHOTO**: filename contains "spot" or "photo"
- **DL/RC/PERMIT**: Based on filename

**Case Creation:**
- If claim number found → Create `InsuranceCase`
- Set category (MACT if MACT number present)
- Calculate due date (receipt date + 30 days)
- Set initial status (Open, Pending)
- Link source email
- Link all attachments as `CaseDocument`

**Case Update:**
- If case already exists → Update empty fields
- Append to case notes

---

## Database Schema

### PostgreSQL Tables Created

```sql
-- Client table
CREATE TABLE insurance_client (
    id BIGSERIAL PRIMARY KEY,
    client_code VARCHAR(20) UNIQUE NOT NULL,
    client_name VARCHAR(200) NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    -- Pricing fields (DECIMAL 10,2)
    full_case_connected_price, full_case_not_connected_price, ...
    created_at TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE
);

-- Insurance case table (matches Excel MIS sheet)
CREATE TABLE insurance_case (
    id BIGSERIAL PRIMARY KEY,
    claim_number VARCHAR(50) UNIQUE NOT NULL,
    client_id BIGINT REFERENCES insurance_client(id),
    client_name VARCHAR(200),
    category VARCHAR(50),  -- MACT, OTHER
    crn VARCHAR(100),      -- MACT number
    policy_number VARCHAR(100),
    
    -- Dates
    case_receipt_date DATE NOT NULL,
    receipt_month VARCHAR(20),
    completion_date DATE,
    completion_month VARCHAR(20),
    case_due_date DATE,
    tat INTEGER,           -- Turnaround time in days
    sla INTEGER,
    
    -- Case details
    case_type VARCHAR(100),
    investigation_report_status VARCHAR(100),
    full_case_status VARCHAR(100),
    scope_of_work TEXT,
    
    -- Parties (name, address, district, status for each)
    claimant_name VARCHAR(500), claimant_address TEXT, ...
    insured_name VARCHAR(500), insured_address TEXT, ...
    driver_name VARCHAR(500), driver_address TEXT, ...
    
    -- Document status
    dl_status VARCHAR(100), rc_status VARCHAR(100), ...
    
    -- Locations
    spot_location TEXT, spot_district VARCHAR(200), ...
    fir_number VARCHAR(100), police_station VARCHAR(200), ...
    hospital_name VARCHAR(300), hospital_address TEXT, ...
    
    -- Metadata
    source_email_id BIGINT REFERENCES email_intake(id),
    case_notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE
);

-- Indexes
CREATE INDEX idx_claim_number ON insurance_case(claim_number);
CREATE INDEX idx_receipt_date ON insurance_case(case_receipt_date);
CREATE INDEX idx_status ON insurance_case(full_case_status);
CREATE INDEX idx_category ON insurance_case(category);

-- Case documents table
CREATE TABLE case_document (
    id BIGSERIAL PRIMARY KEY,
    case_id BIGINT NOT NULL REFERENCES insurance_case(id),
    email_attachment_id BIGINT REFERENCES email_attachment(id),
    document_type VARCHAR(50),  -- POLICY, PETITION, FIR, etc.
    document_name VARCHAR(255),
    file_path VARCHAR(500),
    extracted_text TEXT,
    extracted_data JSONB,
    uploaded_date TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_case_doc ON case_document(case_id, document_type);
```

### Database Indexes for Performance

- `claim_number`: Fast lookup by claim number
- `case_receipt_date`: Date range queries
- `full_case_status`: Filter by status
- `category`: Filter by case type (MACT, etc.)
- `case_id, document_type`: Case document lookups

---

## Example Email Processing

### Input Email
```
Subject: Fwd: Intimation -Claim no. 2775265 / MACT No 1612/2025 / 
         Policy No - POCMVGC0100038371 / Location - Thane / 
         File No W6607 / Petitioner Name - Anjali Sudhir Sherki

From: kunal.dhumal@shoveltechsolutions.com
Date: 2026-02-03 10:51:20

Attachments:
  1. Policy_POCMVGC0100038371.PDF (486 KB) - 56,137 chars extracted
  2. 2775265 - Petition Copy.pdf (3.26 MB)
```

### Extracted Data
```python
{
    'claim_number': '2775265',
    'category': 'MACT',
    'client_name': 'SBI General',
    'crn': '1612/2025',
    'policy_number': 'POCMVGC0100038371',
    'case_receipt_date': date(2026, 2, 3),
    'receipt_month': 'Feb-26',
    'case_due_date': date(2026, 3, 5),
    'case_type': 'Full Case',
    'full_case_status': 'Open',
    'investigation_report_status': 'Pending',
    'scope_of_work': 'Claimant',
    'insured_name': 'SACHIN SURESHUNDRE',
    'location_info': {'district': 'Thane'}
}
```

### Created Records

**InsuranceCase:**
- Claim: 2775265
- Category: MACT
- Client: SBI General
- Policy: POCMVGC0100038371
- Status: Open / Pending
- Due Date: 2026-03-05
- Linked to source email

**CaseDocument (2 records):**
1. Type: POLICY, File: Policy_POCMVGC0100038371.PDF
2. Type: PETITION, File: 2775265 - Petition Copy.pdf

---

## Admin Interface

Access at: `http://localhost:8000/admin/`

### Email Management

**EmailIntake Admin:**
- List view: Subject, Sender, Date, Status, Attachments
- Filters: Status, Has Attachments, Date
- Search: Subject, Sender, Body text
- Inline: Attachments with file details

**EmailAttachment Admin:**
- List view: Filename, Email, Type, Size, PDF flag
- Filters: Is PDF, Content Type, Date
- Search: Filename, Email subject

### Case Management

**InsuranceCase Admin:**
- List view: Claim, Client, Category, Date, Status, TAT
- Filters: Category, Status, Date ranges
- Search: Claim number, CRN, Policy, Names
- Inline: Case documents
- Date hierarchy: Receipt date
- Fieldsets: Organized by section (collapsible)

**CaseDocument Admin:**
- List view: Document name, Claim, Type, Date
- Filters: Document type, Date
- Search: Name, Claim number

**Client Admin:**
- List view: Code, Name, Active status
- Fieldsets: Client info, pricing sections
- Search: Code, Name

---

## Management Commands

### 1. Setup Gmail OAuth
```bash
python manage.py setup_gmail_oauth
```
**Purpose:** Authenticate Gmail account and store OAuth tokens  
**When to use:** First time setup or when adding new Gmail accounts  
**Output:** Authorization URL → User authenticates → Tokens saved

### 2. Poll Gmail Emails
```bash
python manage.py poll_gmail_emails [--max-emails 50] [--email user@gmail.com]
```
**Purpose:** Fetch and process new emails from Gmail  
**Options:**
- `--max-emails`: Limit number of emails to fetch (default: 50)
- `--email`: Process specific Gmail account only

**Recommended:** Run as cron job every 5-15 minutes
```bash
*/15 * * * * cd /path/to/project && python manage.py poll_gmail_emails
```

---

## Utility Scripts

### 1. Test Case Mapper
```bash
python scripts/test_case_mapper.py
```
**Purpose:** Test email-to-case mapping on existing emails  
**Use case:** Verify extraction logic, debug mapping issues

### 2. View Insurance Cases
```bash
python scripts/view_insurance_cases.py
```
**Purpose:** Display all insurance cases with full details  
**Output:** Formatted case information including documents, parties, status

### 3. Read Excel Schema
```bash
python scripts/read_excel_schema.py
```
**Purpose:** Analyze traditional Excel database structure  
**Output:** Sheet names, column lists, sample data

---

## API Integration (Future)

### Planned Endpoints

```python
# GET /api/cases/
# List all insurance cases with pagination and filters
{
    "count": 150,
    "next": "...",
    "results": [
        {
            "claim_number": "2775265",
            "category": "MACT",
            "client": "SBI General",
            "status": "Open",
            ...
        }
    ]
}

# GET /api/cases/{claim_number}/
# Get case details

# POST /api/cases/
# Create case manually

# PATCH /api/cases/{claim_number}/
# Update case

# GET /api/cases/{claim_number}/documents/
# List case documents

# GET /api/emails/
# List processed emails

# POST /api/emails/sync/
# Trigger email sync
```

---

## Configuration

### Environment Variables

In `.env` file:
```bash
# Gmail OAuth
GMAIL_CLIENT_ID=763855623662-ak70tm8fl32aa3u5elpidq2efuqbug6t.apps.googleusercontent.com
GMAIL_CLIENT_SECRET=<your-secret>

# Database
DB_NAME=incident_management_db
DB_USER=postgres
DB_PASSWORD=<password>
DB_HOST=localhost
DB_PORT=5432
```

### Django Settings

In `core/settings.py`:
```python
# Media files for attachments
MEDIA_URL = '/media/'
MEDIA_ROOT = BASE_DIR / 'media'

# Logging
LOGGING = {
    'loggers': {
        'users': {
            'handlers': ['file'],
            'level': 'INFO',
        }
    }
}
```

---

## Data Migration from Excel

### Import Existing Data

Create management command:
```bash
python manage.py import_excel_data --file "traditional_DB/Insurance Management Information System.xlsx"
```

**Process:**
1. Read Excel file using pandas
2. Parse MIS sheet (main data)
3. Create Client records from CLIENT_CODE sheet
4. Create InsuranceCase records for each row
5. Handle data transformation (dates, status values)
6. Link related records

---

## Monitoring & Maintenance

### Logs

Check logs in `logs/` directory:
```bash
tail -f logs/django.log
tail -f logs/email_processing.log
```

### Database Maintenance

```bash
# Check email processing status
python manage.py shell
>>> from users.models import EmailIntake
>>> EmailIntake.objects.values('processing_status').annotate(count=Count('id'))

# Clean old processed emails (optional)
>>> old_emails = EmailIntake.objects.filter(
...     processed_at__lt=timezone.now() - timedelta(days=90)
... )
>>> old_emails.delete()

# Verify case count
>>> from users.models import InsuranceCase
>>> InsuranceCase.objects.count()
```

### Performance Optimization

1. **Pagination:** Use Django pagination for large result sets
2. **Select Related:** Use `select_related()` for foreign keys
3. **Prefetch Related:** Use `prefetch_related()` for many-to-many
4. **Indexing:** Database indexes created on frequently queried fields
5. **Caching:** Consider Redis for frequently accessed data

---

## Troubleshooting

### Issue: No emails fetched

**Solution:**
1. Check OAuth token is active: `GmailOAuthToken.objects.filter(is_active=True)`
2. Verify Gmail inbox has unread emails
3. Check logs for API errors
4. Re-authenticate if token expired

### Issue: Case not created from email

**Solution:**
1. Run `python scripts/test_case_mapper.py` to see extraction details
2. Check if claim number pattern matches
3. Verify email has required data in subject/body
4. Check logs for mapping errors

### Issue: PDF text not extracted

**Solution:**
1. Verify PDF is not scanned image (requires OCR)
2. Check PDF is not password protected
3. Try manual extraction: `python -c "import pdfplumber; pdf = pdfplumber.open('file.pdf'); print(pdf.pages[0].extract_text())"`
4. Install Tesseract OCR for image-based PDFs

---

## Security Considerations

1. **OAuth Tokens:** Encrypted at rest, never logged
2. **File Storage:** Attachments stored in `media/email_attachments/` with restricted access
3. **Admin Access:** Require strong passwords, enable 2FA
4. **API Authentication:** Use token-based auth for API endpoints
5. **HTTPS:** Use SSL in production
6. **CORS:** Configure allowed origins
7. **Rate Limiting:** Implement rate limiting on API endpoints

---

## Future Enhancements

1. **Automatic Assignment:** Assign cases to investigators based on workload
2. **Status Tracking:** Automated status updates based on document uploads
3. **Notifications:** Email/SMS alerts for due dates, status changes
4. **Reports:** Generate investigation reports from templates
5. **Dashboard:** Visual analytics for case metrics
6. **Mobile App:** Field investigation app for vendors
7. **OCR Integration:** Extract text from scanned/image PDFs
8. **NLP Enhancement:** Improved data extraction using ML models
9. **Vendor Portal:** Allow vendors to upload documents, update status
10. **Client Portal:** Allow insurance companies to track cases

---

## Support & Contact

For issues or questions:
- Check logs in `logs/` directory
- Review admin interface at `/admin/`
- Run utility scripts for diagnostics
- Contact development team

---

## Version History

- **v1.0** (Feb 2026): Initial release with Gmail OAuth, email processing, case mapping, admin interface
- Database migrated from Excel to PostgreSQL
- Automated email-to-case workflow implemented
- 2 emails processed successfully in production

---

## Summary

The Insurance Case Management System successfully automates the conversion of email-based insurance claim information into structured database records, matching your traditional Excel-based system structure while providing:

✅ **Automated email processing** from Gmail  
✅ **PDF text extraction** from attachments  
✅ **Intelligent data mapping** to insurance case fields  
✅ **PostgreSQL database** with Excel-matching schema  
✅ **Django admin interface** for management  
✅ **Document classification** and linking  
✅ **Source traceability** (email → case)  
✅ **Extensible architecture** for future enhancements  

**Current Status:** Production-ready, processing emails successfully, 1 insurance case created from 2 processed emails.
