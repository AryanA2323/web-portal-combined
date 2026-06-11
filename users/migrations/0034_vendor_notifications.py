"""
Migration 0034: Create vendor_notifications table.

This table stores in-app notifications for vendors when check assignments
change (CHECK_ASSIGNED / CHECK_REMOVED events). It uses the same raw-SQL
pattern as 0022_create_raw_case_tables.py and 0024_create_rti_rto_check_tables.py
rather than a Django ORM model, keeping it consistent with the check-table approach.
"""

from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ("users", "0033_notification"),
    ]

    operations = [
        migrations.RunSQL(
            sql="""
            CREATE TABLE IF NOT EXISTS vendor_notifications (
                id                  BIGSERIAL PRIMARY KEY,
                vendor_id           INTEGER NOT NULL
                                        REFERENCES users_vendor(id) ON DELETE CASCADE,
                notification_type   VARCHAR(20) NOT NULL
                                        CHECK (notification_type IN ('CHECK_ASSIGNED', 'CHECK_REMOVED')),
                check_type          VARCHAR(20) NOT NULL
                                        CHECK (check_type IN (
                                            'claimant', 'insured', 'driver', 'spot',
                                            'chargesheet', 'rti', 'rto'
                                        )),
                case_id             INTEGER NOT NULL,
                case_number         VARCHAR(100) NOT NULL DEFAULT '',
                message             TEXT NOT NULL DEFAULT '',
                is_read             BOOLEAN NOT NULL DEFAULT FALSE,
                created_at          TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT NOW()
            );

            CREATE INDEX IF NOT EXISTS vendor_notifications_vendor_id_idx
                ON vendor_notifications(vendor_id);

            CREATE INDEX IF NOT EXISTS vendor_notifications_vendor_unread_idx
                ON vendor_notifications(vendor_id, is_read)
                WHERE is_read = FALSE;

            CREATE INDEX IF NOT EXISTS vendor_notifications_created_at_idx
                ON vendor_notifications(created_at DESC);
            """,
            reverse_sql="""
            DROP TABLE IF EXISTS vendor_notifications;
            """,
        ),
    ]
