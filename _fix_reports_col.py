import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()

from django.db import connections

with connections['default'].cursor() as c:
    # Rename assigned_lawyer_id to assigned_qc_id in reports table
    c.execute("""
        DO $$
        BEGIN
            IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'reports' AND column_name = 'assigned_lawyer_id') THEN
                ALTER TABLE reports RENAME COLUMN assigned_lawyer_id TO assigned_qc_id;
            END IF;
        END $$;
    """)
    print("reports column assigned_lawyer_id renamed to assigned_qc_id")
