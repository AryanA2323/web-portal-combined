# Incident Management Platform - Complete Project Description

## Project Overview
This repository is a full-stack incident management system with three major application surfaces:
- Backend API and business logic (Django + PostgreSQL)
- Web frontend dashboard (React + Vite)
- Mobile vendor portal (React Native + Expo)

The platform supports user and role management, case handling, verification workflows, media/document uploads, geolocation-related data, and email/OAuth integrations.

## Repository Modules
- `core/`: Django project configuration (settings, URLs, ASGI/WSGI)
- `users/`: Main Django app for auth, APIs, case/verification domain logic, services, migrations
- `frontend/`: React web application (admin/dashboards/auth/workflow pages)
- `Vendor_Portal/`: Expo React Native mobile app for vendor-side operations
- `media/`: Uploaded assets (email attachments, evidence photos, verification documents)
- `logs/`: Backend log output (Django logging)
- `DB_SCHEMA.sql`: PostgreSQL schema dump for database structure/state

## Detailed Folder Structure
```text
incident-management-platform-week2/
|-- .env
|-- .env.example
|-- .git/
|-- .gitignore
|-- .venv/
|-- manage.py
|-- requirements.txt
|-- DB_SCHEMA.sql
|-- PROJECT_DESCRIPTION.md
|-- Court Details with Taluka_06_Jan_2026(1) (2).xlsx
|
|-- core/
|   |-- __init__.py
|   |-- api.py
|   |-- asgi.py
|   |-- permissions.py
|   |-- settings.py
|   |-- urls.py
|   |-- wsgi.py
|   |-- __pycache__/
|
|-- users/
|   |-- __init__.py
|   |-- admin.py
|   |-- apps.py
|   |-- auth.py
|   |-- backends.py
|   |-- incident_case_db.py
|   |-- models.py
|   |-- models_insurance.py
|   |-- models_verification.py
|   |-- schemas.py
|   |-- tests.py
|   |-- views.py
|   |-- __pycache__/
|   |
|   |-- api/
|   |   |-- __init__.py
|   |   |-- auth.py
|   |   |-- cases.py
|   |   |-- super_admin.py
|   |   |-- users.py
|   |   |-- vendor_cases.py
|   |   |-- vendors.py
|   |   |-- verifications.py
|   |   |-- __pycache__/
|   |
|   |-- management/
|   |   |-- commands/
|   |       |-- import_court_details.py
|   |       |-- poll_gmail_emails.py
|   |       |-- regenerate_case_numbers.py
|   |       |-- seed_clients.py
|   |       |-- setup_gmail_oauth.py
|   |       |-- __pycache__/
|   |
|   |-- migrations/
|   |   |-- __init__.py
|   |   |-- 0001_initial.py
|   |   |-- 0002_vendor_alter_customuser_options_and_more.py
|   |   |-- 0003_authtoken.py
|   |   |-- 0004_emailverificationcode_passwordresettoken.py
|   |   |-- 0005_customuser_sub_role.py
|   |   |-- 0006_customuser_permissions.py
|   |   |-- 0007_alter_customuser_role.py
|   |   |-- 0008_admin_lawyer.py
|   |   |-- 0009_alter_lawyer_options_and_more.py
|   |   |-- 0010_update_role_structure.py
|   |   |-- 0011_case_casephoto_incidentreport_notification_and_more.py
|   |   |-- 0012_remove_case_users_case_case_nu_fa6c22_idx_and_more.py
|   |   |-- 0013_emailmessage_emailattachment_outlookintegration_and_more.py
|   |   |-- 0014_alter_outlookintegration_options_and_more.py
|   |   |-- 0015_emailintake_gmailoauthtoken_and_more.py
|   |   |-- 0016_add_insurance_case_model.py
|   |   |-- 0017_add_case_verification_tables.py
|   |   |-- 0018_add_verification_specific_fields.py
|   |   |-- 0019_remove_old_verification_columns.py
|   |   |-- 0020_add_common_case_fields.py
|   |   |-- 0021_remove_caseverification_description_and_more.py
|   |   |-- 0022_create_raw_case_tables.py
|   |   |-- 0023_add_vendor_documents_and_chargesheet_coords.py
|   |   |-- 0024_create_rti_rto_check_tables.py
|   |   |-- 0025_add_rti_rto_verification_types.py
|   |   |-- 0026_rename_receipt_to_receive_date.py
|   |   |-- 0027_add_case_number_to_cases_table.py
|   |   |-- 0028_add_vendor_evidence_columns.py
|   |   |-- __pycache__/
|   |
|   |-- services/
|
|-- frontend/
|   |-- index.html
|   |-- package.json
|   |-- package-lock.json
|   |-- postcss.config.js
|   |-- tailwind.config.js
|   |-- vite.config.js
|   |-- node_modules/
|   |-- public/
|   |-- src/
|       |-- App.jsx
|       |-- index.css
|       |-- main.jsx
|       |-- assets/
|       |-- components/
|       |   |-- admin/
|       |   |-- auth/
|       |   |-- common/
|       |   |-- index.js
|       |-- context/
|       |-- pages/
|       |   |-- admin/
|       |   |-- auth/
|       |   |-- dashboards/
|       |   |-- lawyer/
|       |   |-- index.js
|       |-- services/
|       |-- utils/
|
|-- Vendor_Portal/
|   |-- .expo/
|   |-- .gitignore
|   |-- app.json
|   |-- babel.config.js
|   |-- eslint.config.js
|   |-- expo-env.d.ts
|   |-- package.json
|   |-- package-lock.json
|   |-- tsconfig.json
|   |-- node_modules/
|   |-- assets/
|   |-- app/
|   |   |-- _layout.tsx
|   |   |-- index.tsx
|   |   |-- login.tsx
|   |   |-- case-details.tsx
|   |   |-- upload-evidence.tsx
|   |   |-- (tabs)/
|   |       |-- _layout.tsx
|   |       |-- index.tsx
|   |       |-- explore.tsx
|   |       |-- profile.tsx
|   |-- src/
|       |-- components/
|       |-- config/
|       |-- screens/
|       |-- services/
|       |   |-- api.ts
|       |-- store/
|       |   |-- authSlice.ts
|       |   |-- casesSlice.ts
|       |   |-- index.ts
|       |-- types/
|
|-- media/
|   |-- email_attachments/
|   |   |-- 2026/
|   |-- evidence_photos/
|   |   |-- 2026/
|   |   |-- case_7/
|   |   |-- case_12/
|   |   |-- case_24/
|   |   |-- case_25/
|   |-- verification_documents/
|       |-- CASE-1BDCC328/
|       |-- CASE-2C15E049/
|       |-- CASE-503E7430/
|       |-- CASE-5BB669EF/
|       |-- CASE-6730C1F1/
|       |-- CASE-875A7097/
|       |-- CASE-8DFEC0BE/
|       |-- CASE-ACEF798F/
|       |-- CASE-C4B2EADC/
|       |-- CASE-E169FD24/
|       |-- CASE-E608E34A/
|       |-- R001-1-SS-2026/
|
|-- logs/
```

## Core Languages and Platforms
- Python (backend)
- JavaScript and JSX (web frontend)
- TypeScript and TSX (mobile app)
- SQL (PostgreSQL schema)
- Node.js/NPM ecosystem (frontend/mobile tooling)

## Backend Stack (Django API)
### Framework and Runtime
- Django `6.0.1`
- Django REST Framework `3.16.1`
- django-ninja `1.5.3`
- ASGI/WSGI support via Django core

### Backend Libraries (from requirements.txt)
- annotated-types `0.7.0`
- APScheduler `3.11.2`
- asgiref `3.11.0`
- certifi `2026.1.4`
- cffi `2.0.0`
- charset-normalizer `3.4.4`
- cryptography `46.0.4`
- Django `6.0.1`
- django-apscheduler `0.7.0`
- django-cors-headers `4.9.0`
- django-ninja `1.5.3`
- djangorestframework `3.16.1`
- dnspython `2.8.0`
- email-validator `2.3.0`
- geographiclib `2.1`
- geopy `2.4.1`
- google-api-core `2.29.0`
- google-api-python-client `2.188.0`
- google-auth `2.48.0`
- google-auth-httplib2 `0.3.0`
- google-auth-oauthlib `1.2.4`
- googleapis-common-protos `1.72.0`
- httplib2 `0.31.2`
- idna `3.11`
- oauthlib `3.3.1`
- packaging `26.0`
- pillow `12.1.0`
- proto-plus `1.27.0`
- protobuf `6.33.5`
- psycopg2-binary `2.9.11`
- pyasn1 `0.6.2`
- pyasn1_modules `0.4.2`
- pycparser `3.0`
- pydantic `2.12.5`
- pydantic_core `2.41.5`
- pyparsing `3.3.2`
- PyPDF2 `3.0.1`
- pytesseract `0.3.13`
- python-decouple `3.8`
- python-dotenv `1.2.1`
- requests `2.32.5`
- requests-oauthlib `2.0.0`
- rsa `4.9.1`
- sqlparse `0.5.5`
- typing-inspection `0.4.2`
- typing_extensions `4.15.0`
- tzdata `2025.3`
- tzlocal `5.3.1`
- uritemplate `4.2.0`
- urllib3 `2.6.3`

### Backend Configuration and Features
- Database engine: PostgreSQL (`django.db.backends.postgresql`)
- Auth model: Custom user model (`users.CustomUser`)
- Auth backends: custom email/username backend + Django default backend
- API auth: Token authentication + session authentication
- CORS: `django-cors-headers`
- Environment variable loading: `.env` via `python-dotenv`
- Logging: file + console handlers (`logs/django.log`)
- Email providers/config:
  - SMTP settings
  - Gmail OAuth credentials
  - Outlook OAuth credentials
- Geocoding integrations/config:
  - Google Maps API key
  - Azure Maps API key
  - Geopy/geographiclib based geolocation utilities
- Scheduled/background jobs support: APScheduler + django-apscheduler

## Database Stack
- Primary database: PostgreSQL
- Driver: `psycopg2-binary`
- Schema artifact: `DB_SCHEMA.sql` (generated by `pg_dump` 18.3)
- SQL objects include:
  - Django auth and token tables
  - Case, verification, document, and geolocation-related tables
  - Sequences/identity columns and constraints/checks

## Web Frontend Stack (frontend/)
### Framework and Build System
- React `18.2.0`
- React DOM `18.2.0`
- Vite `5.0.0`
- `@vitejs/plugin-react` `4.2.0`

### Web Frontend Libraries
- @emotion/react `11.14.0`
- @emotion/styled `11.14.1`
- @hookform/resolvers `5.2.2`
- @mui/icons-material `7.3.7`
- @mui/material `7.3.7`
- axios `1.6.0`
- chart.js `4.5.1`
- react-chartjs-2 `5.3.1`
- react-dropzone `14.3.8`
- react-hook-form `7.71.1`
- react-router-dom `6.20.0`
- yup `1.7.1`

### Web Frontend Dev Dependencies and Tooling
- @tailwindcss/postcss `4.2.1`
- @types/react `18.2.0`
- @types/react-dom `18.2.0`
- autoprefixer `10.4.24`
- eslint `8.55.0`
- eslint-plugin-react `7.33.0`
- eslint-plugin-react-hooks `4.6.0`
- eslint-plugin-react-refresh `0.4.5`
- postcss `8.5.6`
- tailwindcss `4.2.1`

### Web App Tooling Details
- Vite dev server configured on port `3000`
- API proxy configured: `/api` -> `http://localhost:8000`
- Tailwind configured with preflight disabled to avoid conflicts with MUI base styles
- NPM scripts:
  - `dev`
  - `build`
  - `preview`
  - `lint`

## Mobile Vendor Portal Stack (Vendor_Portal/)
### Framework and Runtime
- Expo `~54.0.32`
- React `19.1.0`
- React Native `0.81.5`
- React DOM `19.1.0` (for Expo web target)
- TypeScript `~5.9.2` (strict mode enabled)

### Mobile Libraries
- @expo/vector-icons `15.0.3`
- @hookform/resolvers `5.2.2`
- @react-native-community/datetimepicker `8.4.4`
- @react-navigation/bottom-tabs `7.4.0`
- @react-navigation/elements `2.6.3`
- @react-navigation/native `7.1.28`
- @react-navigation/stack `7.6.16`
- @reduxjs/toolkit `2.11.2`
- @types/react-native `0.72.8`
- axios `1.13.4`
- expo-async-storage `0.0.0`
- expo-constants `~18.0.13`
- expo-font `~14.0.11`
- expo-haptics `~15.0.8`
- expo-image `~3.0.11`
- expo-image-picker `~17.0.10`
- expo-linear-gradient `~15.0.8`
- expo-linking `~8.0.11`
- expo-router `~6.0.22`
- expo-secure-store `15.0.8`
- expo-splash-screen `~31.0.13`
- expo-status-bar `~3.0.9`
- expo-symbols `~1.0.8`
- expo-system-ui `~6.0.9`
- expo-web-browser `~15.0.10`
- react-hook-form `7.71.1`
- react-native-gesture-handler `~2.28.0`
- react-native-paper `5.14.5`
- react-native-reanimated `~4.1.1`
- react-native-safe-area-context `~5.6.0`
- react-native-screens `~4.16.0`
- react-native-vector-icons `10.3.0`
- react-native-web `~0.21.0`
- react-native-worklets `0.5.1`
- react-redux `9.2.0`
- redux `5.0.1`
- zod `4.3.6`
- zustand `5.0.10`

### Mobile Dev Tooling
- eslint `9.25.0`
- eslint-config-expo `~10.0.0`
- @types/react `~19.1.0`
- babel-preset-expo (via Babel config)
- react-native-reanimated Babel plugin

### Mobile App Configuration Highlights
- Routing: Expo Router entrypoint
- Typed routes enabled (`expo.experiments.typedRoutes`)
- React Compiler experiment enabled
- New architecture enabled (`newArchEnabled: true`)
- Android adaptive icon and edge-to-edge settings configured
- Splash screen plugin configuration present
- Supported scripts:
  - `start`
  - `android`
  - `ios`
  - `web`
  - `lint`

## Security, Auth, and Integration Stack
- Token-based auth (`rest_framework.authtoken`)
- Custom auth backend (email/username login)
- Email verification and password reset token workflow
- OAuth integrations:
  - Google/Gmail OAuth
  - Microsoft Outlook OAuth
- HTTP/API communication:
  - `requests` / `requests-oauthlib` (backend)
  - `axios` (web + mobile)

## File and Media Handling Stack
- Image/document processing libraries:
  - Pillow
  - PyPDF2
  - pytesseract (OCR)
- Media storage directories under `media/` for:
  - email attachments
  - evidence photos
  - verification documents

## Development and Operational Tooling
- Git repository (`.git/`)
- Python virtual environment support (`.venv/`)
- Environment template file (`.env.example`)
- Node package lockfiles for deterministic JS dependency versions:
  - `frontend/package-lock.json`
  - `Vendor_Portal/package-lock.json`
- Django management entrypoint: `manage.py`
- Linting:
  - ESLint for web frontend
  - Expo ESLint config for mobile frontend

## Runtime Ports and Local Services
- Django backend: `localhost:8000` (proxied target from frontend Vite config)
- React web frontend (Vite): `localhost:3000`
- Expo mobile dev server: via `expo start` (platform-dependent local ports)

## Notes on Scope
This document lists all direct dependencies and major project tooling/configuration currently declared in:
- `requirements.txt`
- `frontend/package.json`
- `Vendor_Portal/package.json`
- key config files (`core/settings.py`, Vite/Tailwind/PostCSS, Expo/Babel/ESLint/TypeScript configs)

For fully expanded transitive dependency trees, refer to lockfiles:
- `frontend/package-lock.json`
- `Vendor_Portal/package-lock.json`
