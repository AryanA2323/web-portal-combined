from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ('users', '0071_add_not_initiated_to_full_case_status'),
    ]

    operations = [
        migrations.RunSQL(
            sql="""
            CREATE TABLE IF NOT EXISTS case_activity_logs_archive (
                id SERIAL PRIMARY KEY,
                case_id INTEGER NOT NULL,
                case_number VARCHAR(100),
                event_type VARCHAR(100) NOT NULL,
                check_type VARCHAR(100),
                field_name VARCHAR(100),
                old_value TEXT,
                new_value TEXT,
                description TEXT,
                actor_id INTEGER,
                actor_name VARCHAR(255),
                actor_role VARCHAR(50),
                source VARCHAR(50),
                created_at TIMESTAMP WITH TIME ZONE,
                archived_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
            );

            CREATE INDEX IF NOT EXISTS idx_cal_archive_case_id ON case_activity_logs_archive(case_id);
            CREATE INDEX IF NOT EXISTS idx_cal_archive_case_number ON case_activity_logs_archive(case_number);
            CREATE INDEX IF NOT EXISTS idx_cal_archive_created_at ON case_activity_logs_archive(created_at);
            CREATE INDEX IF NOT EXISTS idx_cal_archive_actor_id ON case_activity_logs_archive(actor_id);
            CREATE INDEX IF NOT EXISTS idx_cal_archive_event_type ON case_activity_logs_archive(event_type);

            CREATE TABLE IF NOT EXISTS users_activitylog_archive (
                id BIGSERIAL PRIMARY KEY,
                user_id INTEGER,
                action VARCHAR(100) NOT NULL,
                details TEXT,
                ip_address VARCHAR(100),
                created_at TIMESTAMP WITH TIME ZONE NOT NULL,
                archived_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
            );

            CREATE INDEX IF NOT EXISTS idx_ual_archive_user_id ON users_activitylog_archive(user_id);
            CREATE INDEX IF NOT EXISTS idx_ual_archive_action ON users_activitylog_archive(action);
            CREATE INDEX IF NOT EXISTS idx_ual_archive_created_at ON users_activitylog_archive(created_at);
            """,
            reverse_sql="""
            DROP TABLE IF EXISTS case_activity_logs_archive CASCADE;
            DROP TABLE IF EXISTS users_activitylog_archive CASCADE;
            """
        ),
    ]
