"""
Migration 0032: Add statement_entries JSONB column to check tables.

This stores up to 3 structured statement records per check while keeping
existing statement/observations columns intact for backward compatibility.
"""

from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ('users', '0031_create_reports_table'),
    ]

    operations = [
        migrations.RunSQL(
            sql="""
            ALTER TABLE claimant_checks
                ADD COLUMN IF NOT EXISTS statement_entries JSONB NOT NULL DEFAULT '[]'::jsonb;
            ALTER TABLE insured_checks
                ADD COLUMN IF NOT EXISTS statement_entries JSONB NOT NULL DEFAULT '[]'::jsonb;
            ALTER TABLE driver_checks
                ADD COLUMN IF NOT EXISTS statement_entries JSONB NOT NULL DEFAULT '[]'::jsonb;
            ALTER TABLE spot_checks
                ADD COLUMN IF NOT EXISTS statement_entries JSONB NOT NULL DEFAULT '[]'::jsonb;
            ALTER TABLE chargesheets
                ADD COLUMN IF NOT EXISTS statement_entries JSONB NOT NULL DEFAULT '[]'::jsonb;

            DO $$
            BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM pg_constraint
                    WHERE conname = 'chk_claimant_checks_statement_entries_max3'
                ) THEN
                    ALTER TABLE claimant_checks
                        ADD CONSTRAINT chk_claimant_checks_statement_entries_max3
                        CHECK (
                            jsonb_typeof(statement_entries) = 'array'
                            AND jsonb_array_length(statement_entries) <= 3
                        );
                END IF;
            END $$;

            DO $$
            BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM pg_constraint
                    WHERE conname = 'chk_insured_checks_statement_entries_max3'
                ) THEN
                    ALTER TABLE insured_checks
                        ADD CONSTRAINT chk_insured_checks_statement_entries_max3
                        CHECK (
                            jsonb_typeof(statement_entries) = 'array'
                            AND jsonb_array_length(statement_entries) <= 3
                        );
                END IF;
            END $$;

            DO $$
            BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM pg_constraint
                    WHERE conname = 'chk_driver_checks_statement_entries_max3'
                ) THEN
                    ALTER TABLE driver_checks
                        ADD CONSTRAINT chk_driver_checks_statement_entries_max3
                        CHECK (
                            jsonb_typeof(statement_entries) = 'array'
                            AND jsonb_array_length(statement_entries) <= 3
                        );
                END IF;
            END $$;

            DO $$
            BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM pg_constraint
                    WHERE conname = 'chk_spot_checks_statement_entries_max3'
                ) THEN
                    ALTER TABLE spot_checks
                        ADD CONSTRAINT chk_spot_checks_statement_entries_max3
                        CHECK (
                            jsonb_typeof(statement_entries) = 'array'
                            AND jsonb_array_length(statement_entries) <= 3
                        );
                END IF;
            END $$;

            DO $$
            BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM pg_constraint
                    WHERE conname = 'chk_chargesheets_statement_entries_max3'
                ) THEN
                    ALTER TABLE chargesheets
                        ADD CONSTRAINT chk_chargesheets_statement_entries_max3
                        CHECK (
                            jsonb_typeof(statement_entries) = 'array'
                            AND jsonb_array_length(statement_entries) <= 3
                        );
                END IF;
            END $$;
            """,
            reverse_sql="""
            ALTER TABLE claimant_checks
                DROP CONSTRAINT IF EXISTS chk_claimant_checks_statement_entries_max3;
            ALTER TABLE insured_checks
                DROP CONSTRAINT IF EXISTS chk_insured_checks_statement_entries_max3;
            ALTER TABLE driver_checks
                DROP CONSTRAINT IF EXISTS chk_driver_checks_statement_entries_max3;
            ALTER TABLE spot_checks
                DROP CONSTRAINT IF EXISTS chk_spot_checks_statement_entries_max3;
            ALTER TABLE chargesheets
                DROP CONSTRAINT IF EXISTS chk_chargesheets_statement_entries_max3;

            ALTER TABLE claimant_checks
                DROP COLUMN IF EXISTS statement_entries;
            ALTER TABLE insured_checks
                DROP COLUMN IF EXISTS statement_entries;
            ALTER TABLE driver_checks
                DROP COLUMN IF EXISTS statement_entries;
            ALTER TABLE spot_checks
                DROP COLUMN IF EXISTS statement_entries;
            ALTER TABLE chargesheets
                DROP COLUMN IF EXISTS statement_entries;
            """,
        ),
    ]

