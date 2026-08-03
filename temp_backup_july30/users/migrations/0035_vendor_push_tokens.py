"""
Migration 0035: Store Expo push tokens for vendor devices.
"""

from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ("users", "0034_vendor_notifications"),
    ]

    operations = [
        migrations.RunSQL(
            sql="""
            CREATE TABLE IF NOT EXISTS vendor_push_tokens (
                id              BIGSERIAL PRIMARY KEY,
                vendor_id       INTEGER NOT NULL
                                    REFERENCES users_vendor(id) ON DELETE CASCADE,
                expo_push_token TEXT NOT NULL UNIQUE,
                platform        VARCHAR(20) NOT NULL DEFAULT '',
                device_name     VARCHAR(255) NOT NULL DEFAULT '',
                is_active       BOOLEAN NOT NULL DEFAULT TRUE,
                created_at      TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT NOW(),
                updated_at      TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT NOW()
            );

            CREATE INDEX IF NOT EXISTS vendor_push_tokens_vendor_id_idx
                ON vendor_push_tokens(vendor_id);

            CREATE INDEX IF NOT EXISTS vendor_push_tokens_active_idx
                ON vendor_push_tokens(vendor_id, is_active)
                WHERE is_active = TRUE;
            """,
            reverse_sql="""
            DROP TABLE IF EXISTS vendor_push_tokens;
            """,
        ),
    ]
