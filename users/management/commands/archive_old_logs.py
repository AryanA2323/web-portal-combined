from django.core.management.base import BaseCommand
from users.services.log_archive_service import archive_logs_older_than, get_archive_stats


class Command(BaseCommand):
    help = "Archives log entries older than 90 days into database archive tables."

    def add_arguments(self, parser):
        parser.add_argument(
            "--days",
            type=int,
            default=90,
            help="Retention threshold in days (default: 90). Older logs will be moved to archive tables.",
        )
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Show what would be archived without actually moving records.",
        )

    def handle(self, *args, **options):
        days = options["days"]
        dry_run = options["dry_run"]

        self.stdout.write(self.style.NOTICE(f"=== Log Archiving (Retention: {days} days) ==="))
        
        stats_before = get_archive_stats()
        self.stdout.write(f"Current active case activity logs: {stats_before['active_case_activity_logs']}")
        self.stdout.write(f"Current active user activity logs: {stats_before['active_users_activitylog']}")

        if dry_run:
            self.stdout.write(self.style.WARNING("Dry-run mode enabled: No database modifications made."))
            return

        result = archive_logs_older_than(days=days)

        self.stdout.write(self.style.SUCCESS(
            f"Successfully archived {result['total_archived']} log records "
            f"({result['case_activity_logs_archived']} case logs, {result['users_activitylog_archived']} user activity logs) "
            f"older than {result['cutoff_date']}."
        ))

        stats_after = get_archive_stats()
        self.stdout.write(f"Active case logs remaining: {stats_after['active_case_activity_logs']} (Archived: {stats_after['archived_case_activity_logs']})")
        self.stdout.write(f"Active user logs remaining: {stats_after['active_users_activitylog']} (Archived: {stats_after['archived_users_activitylog']})")
