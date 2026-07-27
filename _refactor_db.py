import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()

from django.db import connections

with connections['default'].cursor() as c:
    # Update users with role LAWYER to QC
    c.execute("UPDATE users_customuser SET role = 'QC' WHERE role = 'LAWYER'")
    
    # Rename tables if they exist
    c.execute("""
        DO $$
        BEGIN
            IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'users_lawyer') THEN
                ALTER TABLE users_lawyer RENAME TO users_qc;
            END IF;
        END $$;
    """)
    
    # Rename sequences if any
    c.execute("""
        DO $$
        BEGIN
            IF EXISTS (SELECT 1 FROM pg_class WHERE relkind = 'S' AND relname = 'users_lawyer_id_seq') THEN
                ALTER SEQUENCE users_lawyer_id_seq RENAME TO users_qc_id_seq;
            END IF;
        END $$;
    """)
    
    # Check foreign keys pointing to assigned_lawyer in reports
    c.execute("""
        DO $$
        BEGIN
            IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users_report' AND column_name = 'assigned_lawyer_id') THEN
                ALTER TABLE users_report RENAME COLUMN assigned_lawyer_id TO assigned_qc_id;
            END IF;
        END $$;
    """)
    
    # Rename indices pointing to assigned_lawyer
    c.execute("""
        DO $$
        BEGIN
            IF EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'reports_assigne_9bcb07_idx') THEN
                ALTER INDEX reports_assigne_9bcb07_idx RENAME TO reports_assigne_9bcb07_qc_idx;
            END IF;
        END $$;
    """)

print("Database updated for Lawyer -> QC.")
