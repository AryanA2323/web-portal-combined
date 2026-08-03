"""
Migration 0029: Add statement transcript columns to check tables
for storing Marathi speech-to-text transcripts and English translations.

New columns per check table:
- statement_audio_path: path to uploaded audio file
- statement_transcript_mr: original Marathi transcript
- statement_transcript_en: English translation
- statement_transcript_provider: provider used (e.g., 'groq')
- statement_transcript_confidence: confidence score (0.0 - 1.0)
- statement_transcript_updated_at: timestamp of last transcript update
"""

from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ('users', '0028_add_vendor_evidence_columns'),
    ]

    operations = [
        migrations.RunSQL(
            sql="""
            -- Add statement transcript columns to claimant_checks
            ALTER TABLE claimant_checks
                ADD COLUMN IF NOT EXISTS statement_audio_path TEXT,
                ADD COLUMN IF NOT EXISTS statement_transcript_mr TEXT,
                ADD COLUMN IF NOT EXISTS statement_transcript_en TEXT,
                ADD COLUMN IF NOT EXISTS statement_transcript_provider VARCHAR(50),
                ADD COLUMN IF NOT EXISTS statement_transcript_confidence NUMERIC(4,3),
                ADD COLUMN IF NOT EXISTS statement_transcript_updated_at TIMESTAMP WITH TIME ZONE;

            -- Add statement transcript columns to insured_checks
            ALTER TABLE insured_checks
                ADD COLUMN IF NOT EXISTS statement_audio_path TEXT,
                ADD COLUMN IF NOT EXISTS statement_transcript_mr TEXT,
                ADD COLUMN IF NOT EXISTS statement_transcript_en TEXT,
                ADD COLUMN IF NOT EXISTS statement_transcript_provider VARCHAR(50),
                ADD COLUMN IF NOT EXISTS statement_transcript_confidence NUMERIC(4,3),
                ADD COLUMN IF NOT EXISTS statement_transcript_updated_at TIMESTAMP WITH TIME ZONE;

            -- Add statement transcript columns to driver_checks
            ALTER TABLE driver_checks
                ADD COLUMN IF NOT EXISTS statement_audio_path TEXT,
                ADD COLUMN IF NOT EXISTS statement_transcript_mr TEXT,
                ADD COLUMN IF NOT EXISTS statement_transcript_en TEXT,
                ADD COLUMN IF NOT EXISTS statement_transcript_provider VARCHAR(50),
                ADD COLUMN IF NOT EXISTS statement_transcript_confidence NUMERIC(4,3),
                ADD COLUMN IF NOT EXISTS statement_transcript_updated_at TIMESTAMP WITH TIME ZONE;

            -- Add statement transcript columns to chargesheets
            ALTER TABLE chargesheets
                ADD COLUMN IF NOT EXISTS statement_audio_path TEXT,
                ADD COLUMN IF NOT EXISTS statement_transcript_mr TEXT,
                ADD COLUMN IF NOT EXISTS statement_transcript_en TEXT,
                ADD COLUMN IF NOT EXISTS statement_transcript_provider VARCHAR(50),
                ADD COLUMN IF NOT EXISTS statement_transcript_confidence NUMERIC(4,3),
                ADD COLUMN IF NOT EXISTS statement_transcript_updated_at TIMESTAMP WITH TIME ZONE;

            -- Add statement transcript columns to spot_checks (note: uses observations instead of statement)
            ALTER TABLE spot_checks
                ADD COLUMN IF NOT EXISTS statement_audio_path TEXT,
                ADD COLUMN IF NOT EXISTS statement_transcript_mr TEXT,
                ADD COLUMN IF NOT EXISTS statement_transcript_en TEXT,
                ADD COLUMN IF NOT EXISTS statement_transcript_provider VARCHAR(50),
                ADD COLUMN IF NOT EXISTS statement_transcript_confidence NUMERIC(4,3),
                ADD COLUMN IF NOT EXISTS statement_transcript_updated_at TIMESTAMP WITH TIME ZONE;

            -- Create indexes for transcript queries
            CREATE INDEX IF NOT EXISTS idx_claimant_checks_transcript_updated ON claimant_checks(statement_transcript_updated_at);
            CREATE INDEX IF NOT EXISTS idx_insured_checks_transcript_updated ON insured_checks(statement_transcript_updated_at);
            CREATE INDEX IF NOT EXISTS idx_driver_checks_transcript_updated ON driver_checks(statement_transcript_updated_at);
            CREATE INDEX IF NOT EXISTS idx_chargesheets_transcript_updated ON chargesheets(statement_transcript_updated_at);
            CREATE INDEX IF NOT EXISTS idx_spot_checks_transcript_updated ON spot_checks(statement_transcript_updated_at);
            """,
            reverse_sql="""
            -- Drop indexes
            DROP INDEX IF EXISTS idx_claimant_checks_transcript_updated;
            DROP INDEX IF EXISTS idx_insured_checks_transcript_updated;
            DROP INDEX IF EXISTS idx_driver_checks_transcript_updated;
            DROP INDEX IF EXISTS idx_chargesheets_transcript_updated;
            DROP INDEX IF EXISTS idx_spot_checks_transcript_updated;

            -- Remove columns from claimant_checks
            ALTER TABLE claimant_checks
                DROP COLUMN IF EXISTS statement_audio_path,
                DROP COLUMN IF EXISTS statement_transcript_mr,
                DROP COLUMN IF EXISTS statement_transcript_en,
                DROP COLUMN IF EXISTS statement_transcript_provider,
                DROP COLUMN IF EXISTS statement_transcript_confidence,
                DROP COLUMN IF EXISTS statement_transcript_updated_at;

            -- Remove columns from insured_checks
            ALTER TABLE insured_checks
                DROP COLUMN IF EXISTS statement_audio_path,
                DROP COLUMN IF EXISTS statement_transcript_mr,
                DROP COLUMN IF EXISTS statement_transcript_en,
                DROP COLUMN IF EXISTS statement_transcript_provider,
                DROP COLUMN IF EXISTS statement_transcript_confidence,
                DROP COLUMN IF EXISTS statement_transcript_updated_at;

            -- Remove columns from driver_checks
            ALTER TABLE driver_checks
                DROP COLUMN IF EXISTS statement_audio_path,
                DROP COLUMN IF EXISTS statement_transcript_mr,
                DROP COLUMN IF EXISTS statement_transcript_en,
                DROP COLUMN IF EXISTS statement_transcript_provider,
                DROP COLUMN IF EXISTS statement_transcript_confidence,
                DROP COLUMN IF EXISTS statement_transcript_updated_at;

            -- Remove columns from chargesheets
            ALTER TABLE chargesheets
                DROP COLUMN IF EXISTS statement_audio_path,
                DROP COLUMN IF EXISTS statement_transcript_mr,
                DROP COLUMN IF EXISTS statement_transcript_en,
                DROP COLUMN IF EXISTS statement_transcript_provider,
                DROP COLUMN IF EXISTS statement_transcript_confidence,
                DROP COLUMN IF EXISTS statement_transcript_updated_at;

            -- Remove columns from spot_checks
            ALTER TABLE spot_checks
                DROP COLUMN IF EXISTS statement_audio_path,
                DROP COLUMN IF EXISTS statement_transcript_mr,
                DROP COLUMN IF EXISTS statement_transcript_en,
                DROP COLUMN IF EXISTS statement_transcript_provider,
                DROP COLUMN IF EXISTS statement_transcript_confidence,
                DROP COLUMN IF EXISTS statement_transcript_updated_at;
            """,
        ),
    ]
