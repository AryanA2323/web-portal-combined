"""
Migration 0030: Create statement_audio_audit table for tracking
vendor statement recordings and transcription history.
"""

from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ('users', '0029_add_statement_transcript_columns'),
    ]

    operations = [
        migrations.RunSQL(
            sql="""
            -- Create statement_audio_audit table
            CREATE TABLE IF NOT EXISTS statement_audio_audit (
                id SERIAL PRIMARY KEY,

                -- Foreign keys and references
                vendor_id INTEGER NOT NULL REFERENCES users_vendor(id) ON DELETE CASCADE,
                case_id INTEGER NOT NULL,
                check_type VARCHAR(20) NOT NULL,

                -- Audio file information
                audio_file VARCHAR(500) NOT NULL,
                audio_mime_type VARCHAR(100) NOT NULL,
                audio_size_bytes INTEGER NOT NULL,
                audio_duration_seconds NUMERIC(8,2),

                -- Transcription results
                transcript_mr TEXT NOT NULL,
                translation_en TEXT NOT NULL,
                detected_language VARCHAR(20) DEFAULT 'mr',

                -- Provider information
                stt_provider VARCHAR(50) NOT NULL DEFAULT 'groq',
                stt_model VARCHAR(100),
                translation_model VARCHAR(100),
                confidence NUMERIC(4,3),
                raw_provider_response JSONB,

                -- Application tracking
                is_applied_to_check BOOLEAN NOT NULL DEFAULT FALSE,
                applied_at TIMESTAMP WITH TIME ZONE,
                source VARCHAR(50) NOT NULL DEFAULT 'audio',

                -- Timestamps
                created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
                updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),

                -- Constraints
                CONSTRAINT check_type_valid CHECK (
                    check_type IN ('claimant', 'insured', 'driver', 'chargesheet', 'spot')
                ),
                CONSTRAINT source_valid CHECK (
                    source IN ('audio', 'manual_edit', 'audio_preview')
                )
            );

            -- Create indexes for efficient queries
            CREATE INDEX IF NOT EXISTS idx_statement_audio_audit_vendor
                ON statement_audio_audit(vendor_id);
            CREATE INDEX IF NOT EXISTS idx_statement_audio_audit_case
                ON statement_audio_audit(case_id);
            CREATE INDEX IF NOT EXISTS idx_statement_audio_audit_check_type
                ON statement_audio_audit(check_type);
            CREATE INDEX IF NOT EXISTS idx_statement_audio_audit_created_at
                ON statement_audio_audit(created_at DESC);
            CREATE INDEX IF NOT EXISTS idx_statement_audio_audit_case_check
                ON statement_audio_audit(case_id, check_type);
            CREATE INDEX IF NOT EXISTS idx_statement_audio_audit_applied
                ON statement_audio_audit(is_applied_to_check, applied_at);

            -- Create trigger for updated_at
            CREATE OR REPLACE FUNCTION update_statement_audio_audit_updated_at()
            RETURNS TRIGGER AS $$
            BEGIN
                NEW.updated_at = NOW();
                RETURN NEW;
            END;
            $$ LANGUAGE plpgsql;

            DROP TRIGGER IF EXISTS trg_statement_audio_audit_updated_at
                ON statement_audio_audit;
            CREATE TRIGGER trg_statement_audio_audit_updated_at
                BEFORE UPDATE ON statement_audio_audit
                FOR EACH ROW EXECUTE FUNCTION update_statement_audio_audit_updated_at();
            """,
            reverse_sql="""
            -- Drop trigger and function
            DROP TRIGGER IF EXISTS trg_statement_audio_audit_updated_at
                ON statement_audio_audit;
            DROP FUNCTION IF EXISTS update_statement_audio_audit_updated_at();

            -- Drop indexes
            DROP INDEX IF EXISTS idx_statement_audio_audit_vendor;
            DROP INDEX IF EXISTS idx_statement_audio_audit_case;
            DROP INDEX IF EXISTS idx_statement_audio_audit_check_type;
            DROP INDEX IF EXISTS idx_statement_audio_audit_created_at;
            DROP INDEX IF EXISTS idx_statement_audio_audit_case_check;
            DROP INDEX IF EXISTS idx_statement_audio_audit_applied;

            -- Drop table
            DROP TABLE IF EXISTS statement_audio_audit;
            """,
        ),
    ]
