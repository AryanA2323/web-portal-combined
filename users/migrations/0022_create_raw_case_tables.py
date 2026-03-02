# Migration to create the raw SQL tables used by incident_case_db.py
# Tables: cases, claimant_checks, insured_checks, driver_checks, spot_checks,
#         chargesheets, court_details, address_coordinates

from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ('users', '0021_remove_caseverification_description_and_more'),
    ]

    operations = [
        # =====================================================================
        # MASTER CASES TABLE
        # =====================================================================
        migrations.RunSQL(
            sql="""
            CREATE TABLE IF NOT EXISTS cases (
                id              SERIAL PRIMARY KEY,
                claim_number    VARCHAR(100) NOT NULL UNIQUE,
                client_name     VARCHAR(500) NOT NULL DEFAULT '',
                category        VARCHAR(20)  NOT NULL DEFAULT 'MACT',

                -- Dates & Timing
                case_receipt_date   DATE,
                receipt_month       VARCHAR(20)  NOT NULL DEFAULT '',
                completion_date     TIMESTAMP,
                completion_month    VARCHAR(20)  NOT NULL DEFAULT '',
                case_due_date       DATE,
                tat_days            INTEGER,
                sla                 VARCHAR(5)
                    CHECK (sla IN ('AT','WT')),

                -- Case classification
                case_type           VARCHAR(50) NOT NULL DEFAULT 'Full Case'
                    CHECK (case_type IN ('Full Case','Partial Case','Reassessment','Connected Case')),
                investigation_report_status VARCHAR(20) NOT NULL DEFAULT 'Open'
                    CHECK (investigation_report_status IN ('Open','Approval','Stop','QC','Dispatch')),
                full_case_status    VARCHAR(30) NOT NULL DEFAULT 'WIP'
                    CHECK (full_case_status IN (
                        'WIP','Pending CS','Completed','IR-Writing','NI','Withdraw',
                        'QC-1','Pending Additional Docs','Connected Pending',
                        'RCU Pending','Portal Upload'
                    )),
                scope_of_work       TEXT NOT NULL DEFAULT '',

                -- Metadata
                created_at  TIMESTAMP NOT NULL DEFAULT NOW(),
                updated_at  TIMESTAMP NOT NULL DEFAULT NOW()
            );

            CREATE INDEX IF NOT EXISTS idx_cases_claim_number ON cases (claim_number);
            CREATE INDEX IF NOT EXISTS idx_cases_full_case_status ON cases (full_case_status);
            CREATE INDEX IF NOT EXISTS idx_cases_case_type ON cases (case_type);
            CREATE INDEX IF NOT EXISTS idx_cases_receipt_date ON cases (case_receipt_date);
            """,
            reverse_sql="DROP TABLE IF EXISTS cases CASCADE;",
        ),

        # =====================================================================
        # CLAIMANT CHECKS
        # =====================================================================
        migrations.RunSQL(
            sql="""
            CREATE TABLE IF NOT EXISTS claimant_checks (
                id                SERIAL PRIMARY KEY,
                case_id           INTEGER NOT NULL REFERENCES cases(id) ON DELETE CASCADE,

                claimant_name     VARCHAR(500) NOT NULL DEFAULT '',
                claimant_contact  VARCHAR(20)  NOT NULL DEFAULT '',
                claimant_address  TEXT         NOT NULL DEFAULT '',
                claimant_income   NUMERIC(15,2),

                -- Coordinates (filled async by geocoder)
                claimant_lat      DOUBLE PRECISION,
                claimant_lng      DOUBLE PRECISION,

                -- Dependants & documents stored as JSONB arrays
                dependants        JSONB NOT NULL DEFAULT '[]'::jsonb,
                documents         JSONB NOT NULL DEFAULT '[]'::jsonb,

                check_status      VARCHAR(20) NOT NULL DEFAULT 'WIP'
                    CHECK (check_status IN ('Not Initiated','WIP','Completed','Stop')),
                statement         TEXT NOT NULL DEFAULT '',
                observation       TEXT NOT NULL DEFAULT '',

                -- Vendor assignment
                assigned_vendor_id INTEGER,

                created_at  TIMESTAMP NOT NULL DEFAULT NOW(),
                updated_at  TIMESTAMP NOT NULL DEFAULT NOW(),

                UNIQUE(case_id)
            );

            CREATE INDEX IF NOT EXISTS idx_claimant_checks_case ON claimant_checks (case_id);
            CREATE INDEX IF NOT EXISTS idx_claimant_checks_status ON claimant_checks (check_status);
            """,
            reverse_sql="DROP TABLE IF EXISTS claimant_checks CASCADE;",
        ),

        # =====================================================================
        # INSURED CHECKS
        # =====================================================================
        migrations.RunSQL(
            sql="""
            CREATE TABLE IF NOT EXISTS insured_checks (
                id                SERIAL PRIMARY KEY,
                case_id           INTEGER NOT NULL REFERENCES cases(id) ON DELETE CASCADE,

                insured_name      VARCHAR(500) NOT NULL DEFAULT '',
                insured_contact   VARCHAR(20)  NOT NULL DEFAULT '',
                insured_address   TEXT         NOT NULL DEFAULT '',
                policy_number     VARCHAR(100) NOT NULL DEFAULT '',
                policy_period     VARCHAR(200) NOT NULL DEFAULT '',
                rc                VARCHAR(100) NOT NULL DEFAULT '',
                permit            VARCHAR(200) NOT NULL DEFAULT '',

                -- Coordinates
                insured_lat       DOUBLE PRECISION,
                insured_lng       DOUBLE PRECISION,

                -- Documents JSONB
                documents         JSONB NOT NULL DEFAULT '[]'::jsonb,

                check_status      VARCHAR(20) NOT NULL DEFAULT 'WIP'
                    CHECK (check_status IN ('Not Initiated','WIP','Completed','Stop')),
                statement         TEXT NOT NULL DEFAULT '',
                observation       TEXT NOT NULL DEFAULT '',

                -- Vendor assignment
                assigned_vendor_id INTEGER,

                created_at  TIMESTAMP NOT NULL DEFAULT NOW(),
                updated_at  TIMESTAMP NOT NULL DEFAULT NOW(),

                UNIQUE(case_id)
            );

            CREATE INDEX IF NOT EXISTS idx_insured_checks_case ON insured_checks (case_id);
            CREATE INDEX IF NOT EXISTS idx_insured_checks_status ON insured_checks (check_status);
            """,
            reverse_sql="DROP TABLE IF EXISTS insured_checks CASCADE;",
        ),

        # =====================================================================
        # DRIVER CHECKS
        # =====================================================================
        migrations.RunSQL(
            sql="""
            CREATE TABLE IF NOT EXISTS driver_checks (
                id                SERIAL PRIMARY KEY,
                case_id           INTEGER NOT NULL REFERENCES cases(id) ON DELETE CASCADE,

                driver_name       VARCHAR(500) NOT NULL DEFAULT '',
                driver_contact    VARCHAR(20)  NOT NULL DEFAULT '',
                driver_address    TEXT         NOT NULL DEFAULT '',
                dl                VARCHAR(100) NOT NULL DEFAULT '',
                permit            VARCHAR(200) NOT NULL DEFAULT '',
                occupation        VARCHAR(200) NOT NULL DEFAULT '',
                driver_and_insured_same BOOLEAN NOT NULL DEFAULT FALSE,

                -- Coordinates
                driver_lat        DOUBLE PRECISION,
                driver_lng        DOUBLE PRECISION,

                -- Documents JSONB
                documents         JSONB NOT NULL DEFAULT '[]'::jsonb,

                check_status      VARCHAR(20) NOT NULL DEFAULT 'WIP'
                    CHECK (check_status IN ('Not Initiated','WIP','Completed','Stop')),
                statement         TEXT NOT NULL DEFAULT '',
                observation       TEXT NOT NULL DEFAULT '',

                -- Vendor assignment
                assigned_vendor_id INTEGER,

                created_at  TIMESTAMP NOT NULL DEFAULT NOW(),
                updated_at  TIMESTAMP NOT NULL DEFAULT NOW(),

                UNIQUE(case_id)
            );

            CREATE INDEX IF NOT EXISTS idx_driver_checks_case ON driver_checks (case_id);
            CREATE INDEX IF NOT EXISTS idx_driver_checks_status ON driver_checks (check_status);
            """,
            reverse_sql="DROP TABLE IF EXISTS driver_checks CASCADE;",
        ),

        # =====================================================================
        # SPOT CHECKS
        # =====================================================================
        migrations.RunSQL(
            sql="""
            CREATE TABLE IF NOT EXISTS spot_checks (
                id                SERIAL PRIMARY KEY,
                case_id           INTEGER NOT NULL REFERENCES cases(id) ON DELETE CASCADE,

                time_of_accident  VARCHAR(100) NOT NULL DEFAULT '',
                place_of_accident VARCHAR(500) NOT NULL DEFAULT '',
                district          VARCHAR(200) NOT NULL DEFAULT '',
                fir_number        VARCHAR(100) NOT NULL DEFAULT '',
                city              VARCHAR(200) NOT NULL DEFAULT '',
                police_station    VARCHAR(200) NOT NULL DEFAULT '',
                accident_brief    TEXT         NOT NULL DEFAULT '',

                -- Coordinates
                spot_lat          DOUBLE PRECISION,
                spot_lng          DOUBLE PRECISION,

                -- Documents JSONB
                documents         JSONB NOT NULL DEFAULT '[]'::jsonb,

                check_status      VARCHAR(20) NOT NULL DEFAULT 'WIP'
                    CHECK (check_status IN ('Not Initiated','WIP','Completed','Stop')),
                observations      TEXT NOT NULL DEFAULT '',

                -- Vendor assignment
                assigned_vendor_id INTEGER,

                created_at  TIMESTAMP NOT NULL DEFAULT NOW(),
                updated_at  TIMESTAMP NOT NULL DEFAULT NOW(),

                UNIQUE(case_id)
            );

            CREATE INDEX IF NOT EXISTS idx_spot_checks_case ON spot_checks (case_id);
            CREATE INDEX IF NOT EXISTS idx_spot_checks_status ON spot_checks (check_status);
            """,
            reverse_sql="DROP TABLE IF EXISTS spot_checks CASCADE;",
        ),

        # =====================================================================
        # CHARGESHEETS
        # =====================================================================
        migrations.RunSQL(
            sql="""
            CREATE TABLE IF NOT EXISTS chargesheets (
                id                SERIAL PRIMARY KEY,
                case_id           INTEGER NOT NULL REFERENCES cases(id) ON DELETE CASCADE,

                fir_number        VARCHAR(100) NOT NULL DEFAULT '',
                city              VARCHAR(200) NOT NULL DEFAULT '',
                court_name        VARCHAR(500) NOT NULL DEFAULT '',
                mv_act            VARCHAR(500) NOT NULL DEFAULT '',
                fir_delay_days    INTEGER,
                bsn_section       VARCHAR(500) NOT NULL DEFAULT '',
                ipc               VARCHAR(500) NOT NULL DEFAULT '',

                -- Documents JSONB
                documents         JSONB NOT NULL DEFAULT '[]'::jsonb,

                check_status      VARCHAR(20) NOT NULL DEFAULT 'WIP'
                    CHECK (check_status IN ('Not Initiated','WIP','Completed','Stop')),
                statement         TEXT NOT NULL DEFAULT '',
                observations      TEXT NOT NULL DEFAULT '',

                -- Vendor assignment
                assigned_vendor_id INTEGER,

                created_at  TIMESTAMP NOT NULL DEFAULT NOW(),
                updated_at  TIMESTAMP NOT NULL DEFAULT NOW(),

                UNIQUE(case_id)
            );

            CREATE INDEX IF NOT EXISTS idx_chargesheets_case ON chargesheets (case_id);
            CREATE INDEX IF NOT EXISTS idx_chargesheets_status ON chargesheets (check_status);
            """,
            reverse_sql="DROP TABLE IF EXISTS chargesheets CASCADE;",
        ),

        # =====================================================================
        # ADDRESS COORDINATES (stores lat/lng for any address field)
        # =====================================================================
        migrations.RunSQL(
            sql="""
            CREATE TABLE IF NOT EXISTS address_coordinates (
                id              SERIAL PRIMARY KEY,
                case_id         INTEGER NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
                source_table    VARCHAR(50)  NOT NULL,
                source_field    VARCHAR(100) NOT NULL,
                address         TEXT         NOT NULL DEFAULT '',
                latitude        DOUBLE PRECISION,
                longitude       DOUBLE PRECISION,
                geocode_status  VARCHAR(20)  NOT NULL DEFAULT 'PENDING'
                    CHECK (geocode_status IN ('PENDING','SUCCESS','FAILED')),
                created_at      TIMESTAMP NOT NULL DEFAULT NOW(),
                updated_at      TIMESTAMP NOT NULL DEFAULT NOW()
            );

            CREATE INDEX IF NOT EXISTS idx_addr_coords_case ON address_coordinates (case_id);
            CREATE INDEX IF NOT EXISTS idx_addr_coords_source ON address_coordinates (source_table, source_field);
            """,
            reverse_sql="DROP TABLE IF EXISTS address_coordinates CASCADE;",
        ),

        # =====================================================================
        # COURT DETAILS (lookup table for cities, police stations, courts)
        # =====================================================================
        migrations.RunSQL(
            sql="""
            CREATE TABLE IF NOT EXISTS court_details (
                id                              SERIAL PRIMARY KEY,
                sr_no                           INTEGER,
                city                            VARCHAR(200),
                taluka_court                    VARCHAR(500),
                jurisdiction_police_station     VARCHAR(500),
                police_station_contact          VARCHAR(200),
                police_station_email            VARCHAR(300),
                court_complex_location          VARCHAR(500),
                record_date                     DATE,
                sanad_no                        VARCHAR(100),
                advocate_name                   VARCHAR(300),
                advocate_contact                VARCHAR(100),
                advocate_email                  VARCHAR(300)
            );

            CREATE INDEX IF NOT EXISTS idx_court_details_city ON court_details (city);
            CREATE INDEX IF NOT EXISTS idx_court_details_court ON court_details (taluka_court);
            CREATE INDEX IF NOT EXISTS idx_court_details_ps ON court_details (jurisdiction_police_station);
            """,
            reverse_sql="DROP TABLE IF EXISTS court_details CASCADE;",
        ),
    ]
