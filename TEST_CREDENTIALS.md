# Test Credentials

This file documents test accounts available for development and testing purposes.

⚠️ **IMPORTANT**: These credentials are for development/testing only. Never use these in production environments.

## Test Vendor Accounts

### How to Set Up Test Vendors

Run the seed command to create test vendor accounts:

```bash
python manage.py seed_test_vendors
```

To clear and reset test vendors:

```bash
python manage.py seed_test_vendors --clear
```

---

## Available Test Vendors

### 1. Alpha Investigations
- **Username**: `alpha_investigations`
- **Email**: `contact@alphainvestigations.com`
- **Password**: `Alpha@123456`
- **Company**: Alpha Investigations
- **Contact**: John Smith
- **Contact Email**: john@alphainvestigations.com
- **Location**: Mumbai, Maharashtra

### 2. Beta Agency
- **Username**: `beta_agency`
- **Email**: `contact@betaagency.com`
- **Password**: `Beta@123456`
- **Company**: Beta Agency
- **Contact**: Jane Doe
- **Contact Email**: jane@betaagency.com
- **Location**: Bangalore, Karnataka

### 3. Gamma Services
- **Username**: `gamma_services`
- **Email**: `contact@gammaservices.com`
- **Password**: `Gamma@123456`
- **Company**: Gamma Services
- **Contact**: Robert Johnson
- **Contact Email**: robert@gammaservices.com
- **Location**: Delhi, Delhi

---

## Test Client/Admin Accounts

To create additional test accounts programmatically, use the registration API:

```bash
POST /api/auth/register
Content-Type: application/json

{
  "username": "testuser",
  "email": "test@example.com",
  "password": "TestPassword@123",
  "role": "VENDOR"
}
```

---

## Important Notes

1. **Passwords are hashed** in the database (never stored in plain text)
2. These accounts will have all test data pre-populated
3. Use these accounts only for local development and testing
4. Do NOT commit actual credentials to version control
5. Always use environment variables for sensitive data in production

## Accessing Accounts

### Frontend Login
Navigate to the login page and use:
- Username/Email: See credentials above
- Password: See credentials above

### API Access
Generate an auth token:

```bash
POST /api/auth/login
Content-Type: application/json

{
  "username": "alpha_investigations",
  "password": "Alpha@123456"
}
```

Response will include an auth token for subsequent API requests.

---

## Database Direct Access

If you need to verify or modify test accounts directly:

```sql
-- View all vendor users
SELECT u.id, u.username, u.email, v.company_name, u.is_active
FROM users_customuser u
JOIN users_vendor v ON u.id = v.user_id
WHERE u.role = 'VENDOR'
ORDER BY u.created_at DESC;

-- Update a vendor's password
UPDATE users_customuser SET password = '<hashed>' WHERE username = 'alpha_investigations';
```

---

## Troubleshooting

- **Seed command fails**: Ensure migrations are applied (`python manage.py migrate`)
- **Login fails**: Verify the user exists in the database
- **Can't find vendor in UI**: Check that the vendor's `is_active` flag is `True`

---

## Production Checklist

- ✅ Never use these test credentials in production
- ✅ Always use strong, unique passwords in production
- ✅ Store credentials in environment variables or secure vaults
- ✅ Never commit passwords to version control
- ✅ Use HTTPS for all authentication endpoints
- ✅ Implement rate limiting on login endpoints
