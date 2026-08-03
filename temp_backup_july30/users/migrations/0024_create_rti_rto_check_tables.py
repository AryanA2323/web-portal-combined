"""
Migration 0024: Create rti_checks and rto_checks tables in incident_case_db.

RTI Checks (Right to Information):
  - Checklist: chargesheet (bool) + fir_number, dl (bool) + dl_number,
    permit (bool) + permit_number, rc (bool) + rc_number
  - Remarks text field
  - Standard: case_documents, vendor_documents, check_status, assigned_vendor_id

RTO Checks (Regional Transport Office):
  - rto_name, rto_address
  - Checklist: dl (bool) + dl_number, permit (bool) + permit_number,
    rc (bool) + rc_number
  - Remarks text field
  - Standard: case_documents, vendor_documents, check_status, assigned_vendor_id
"""

from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ("users", "0023_add_vendor_documents_and_chargesheet_coords"),
    ]

    operations = [
        migrations.RunSQL(
            sql="""
            -- =============================================================
            -- RTI CHECKS
            -- =============================================================
            CREATE TABLE IF NOT EXISTS rti_checks (
                id              SERIAL PRIMARY KEY,
                case_id         INTEGER NOT NULL REFERENCES cases(id) ON DELETE CASCADE,

                -- Checklist toggles + associated numbers
                chargesheet_checked  BOOLEAN NOT NULL DEFAULT FALSE,
                fir_number           VARCHAR(100) NOT NULL DEFAULT '',

                dl_checked           BOOLEAN NOT NULL DEFAULT FALSE,
                dl_number            VARCHAR(100) NOT NULL DEFAULT '',

                permit_checked       BOOLEAN NOT NULL DEFAULT FALSE,
                permit_number        VARCHAR(100) NOT NULL DEFAULT '',

                rc_checked           BOOLEAN NOT NULL DEFAULT FALSE,
                rc_number            VARCHAR(100) NOT NULL DEFAULT '',

                remarks              TEXT NOT NULL DEFAULT '',

                -- Standard fields (same pattern as other check tables)
                case_documents       JSONB NOT NULL DEFAULT '[]'::jsonb,
                vendor_documents     JSONB NOT NULL DEFAULT '[]'::jsonb,
                check_status         VARCHAR(20) NOT NULL DEFAULT 'PENDING'
                                     CHECK (check_status IN ('PENDING','WIP','COMPLETED','REJECTED')),
                assigned_vendor_id   INTEGER REFERENCES users_vendor(id) ON DELETE SET NULL,

                created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
            );

            CREATE INDEX IF NOT EXISTS idx_rti_checks_case_id ON rti_checks(case_id);

            -- =============================================================
            -- RTO CHECKS
            -- =============================================================
            CREATE TABLE IF NOT EXISTS rto_checks (
                id              SERIAL PRIMARY KEY,
                case_id         INTEGER NOT NULL REFERENCES cases(id) ON DELETE CASCADE,

                -- RTO office info
                rto_name             VARCHAR(255) NOT NULL DEFAULT '',
                rto_address          TEXT NOT NULL DEFAULT '',

                -- Checklist toggles + associated numbers
                dl_checked           BOOLEAN NOT NULL DEFAULT FALSE,
                dl_number            VARCHAR(100) NOT NULL DEFAULT '',

                permit_checked       BOOLEAN NOT NULL DEFAULT FALSE,
                permit_number        VARCHAR(100) NOT NULL DEFAULT '',

                rc_checked           BOOLEAN NOT NULL DEFAULT FALSE,
                rc_number            VARCHAR(100) NOT NULL DEFAULT '',

                remarks              TEXT NOT NULL DEFAULT '',

                -- Standard fields
                case_documents       JSONB NOT NULL DEFAULT '[]'::jsonb,
                vendor_documents     JSONB NOT NULL DEFAULT '[]'::jsonb,
                check_status         VARCHAR(20) NOT NULL DEFAULT 'PENDING'
                                     CHECK (check_status IN ('PENDING','WIP','COMPLETED','REJECTED')),
                assigned_vendor_id   INTEGER REFERENCES users_vendor(id) ON DELETE SET NULL,

                -- Geocoded RTO office location
                rto_lat              DOUBLE PRECISION,
                rto_lng              DOUBLE PRECISION,

                created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
            );

            CREATE INDEX IF NOT EXISTS idx_rto_checks_case_id ON rto_checks(case_id);
            """,
            reverse_sql="""
            DROP TABLE IF EXISTS rto_checks;
            DROP TABLE IF EXISTS rti_checks;
            """,
        ),
    ]
