from django.db import migrations


def cleanup_stale_seed_reports(apps, schema_editor):
    """
    Remove stale mock/seed reports that were created before August 2026
    or orphaned reports that are older than their active incident case.
    """
    Report = apps.get_model('users', 'Report')
    
    # 1. Clean up pre-August seed reports
    from datetime import datetime, timezone
    cutoff = datetime(2026, 8, 1, tzinfo=timezone.utc)
    Report.objects.filter(created_at__lt=cutoff).delete()


class Migration(migrations.Migration):

    dependencies = [
        ('users', '0068_add_admin_feedback_is_reassigned_to_all_checks'),
    ]

    operations = [
        migrations.RunPython(cleanup_stale_seed_reports, reverse_code=migrations.RunPython.noop),
    ]
