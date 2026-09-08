import logging
from datetime import timedelta
from typing import Dict, Any
from django.db import connection, transaction
from django.utils import timezone

logger = logging.getLogger(__name__)


def archive_logs_older_than(days: int = 90, dry_run: bool = False, batch_size: int = 5000) -> Dict[str, Any]:
    """
    Safely moves log records older than `days` (default 90) from active log tables
    (case_activity_logs, users_activitylog) into their respective archive tables
    (case_activity_logs_archive, users_activitylog_archive).

    Executed in atomic, batched CTE transactions to ensure zero data loss and prevent
    table lock contention in high-volume production environments.
    
    If dry_run is True, returns counts without executing INSERT or DELETE.
    """
    if not isinstance(days, int) or days < 1:
        days = 90

    cutoff_date = timezone.now() - timedelta(days=days)
    cal_total_archived = 0
    ual_total_archived = 0

    try:
        with connection.cursor() as cursor:
            # 1. Count eligible case_activity_logs
            cursor.execute(
                "SELECT COUNT(*) FROM case_activity_logs WHERE created_at < %s",
                [cutoff_date],
            )
            cal_row = cursor.fetchone()
            cal_eligible = cal_row[0] if cal_row else 0

            # 2. Count eligible users_activitylog
            cursor.execute(
                "SELECT COUNT(*) FROM users_activitylog WHERE created_at < %s",
                [cutoff_date],
            )
            ual_row = cursor.fetchone()
            ual_eligible = ual_row[0] if ual_row else 0

        if dry_run:
            return {
                "success": True,
                "dry_run": True,
                "case_activity_logs_archived": cal_eligible,
                "users_activitylog_archived": ual_eligible,
                "total_archived": cal_eligible + ual_eligible,
                "cutoff_date": cutoff_date.isoformat(),
                "retention_days": days,
            }

        # Batch archive case_activity_logs using atomic CTE moves
        while cal_total_archived < cal_eligible:
            with transaction.atomic():
                with connection.cursor() as cursor:
                    cursor.execute(
                        """
                        WITH moved AS (
                            DELETE FROM case_activity_logs
                            WHERE id IN (
                                SELECT id FROM case_activity_logs
                                WHERE created_at < %s
                                LIMIT %s
                            )
                            RETURNING case_id, case_number, event_type, check_type, field_name,
                                      old_value, new_value, description, actor_id, actor_name,
                                      actor_role, source, created_at
                        )
                        INSERT INTO case_activity_logs_archive (
                            case_id, case_number, event_type, check_type, field_name,
                            old_value, new_value, description, actor_id, actor_name,
                            actor_role, source, created_at, archived_at
                        )
                        SELECT case_id, case_number, event_type, check_type, field_name,
                               old_value, new_value, description, actor_id, actor_name,
                               actor_role, source, created_at, NOW()
                        FROM moved
                        RETURNING id;
                        """,
                        [cutoff_date, batch_size],
                    )
                    moved_rows = cursor.fetchall()
                    batch_count = len(moved_rows)
                    cal_total_archived += batch_count
                    if batch_count == 0:
                        break

        # Batch archive users_activitylog using atomic CTE moves
        while ual_total_archived < ual_eligible:
            with transaction.atomic():
                with connection.cursor() as cursor:
                    cursor.execute(
                        """
                        WITH moved AS (
                            DELETE FROM users_activitylog
                            WHERE id IN (
                                SELECT id FROM users_activitylog
                                WHERE created_at < %s
                                LIMIT %s
                            )
                            RETURNING user_id, action, details, ip_address, created_at
                        )
                        INSERT INTO users_activitylog_archive (
                            user_id, action, details, ip_address, created_at, archived_at
                        )
                        SELECT user_id, action, details, ip_address, created_at, NOW()
                        FROM moved
                        RETURNING id;
                        """,
                        [cutoff_date, batch_size],
                    )
                    moved_rows = cursor.fetchall()
                    batch_count = len(moved_rows)
                    ual_total_archived += batch_count
                    if batch_count == 0:
                        break

        logger.info(
            f"[log_archive] Archived {cal_total_archived} case_activity_logs and "
            f"{ual_total_archived} users_activitylog older than {days} days."
        )

        return {
            "success": True,
            "dry_run": False,
            "case_activity_logs_archived": cal_total_archived,
            "users_activitylog_archived": ual_total_archived,
            "total_archived": cal_total_archived + ual_total_archived,
            "cutoff_date": cutoff_date.isoformat(),
            "retention_days": days,
        }

    except Exception as exc:
        logger.error(f"[log_archive] Failed to archive logs: {exc}")
        raise


def get_archive_stats(cutoff_days: int = 90) -> Dict[str, Any]:
    """Return counts of active vs archived logs and logs eligible for archiving."""
    if not isinstance(cutoff_days, int) or cutoff_days < 1:
        cutoff_days = 90

    cutoff_date = timezone.now() - timedelta(days=cutoff_days)
    stats = {
        "active_case_activity_logs": 0,
        "archived_case_activity_logs": 0,
        "eligible_case_activity_logs": 0,
        "active_users_activitylog": 0,
        "archived_users_activitylog": 0,
        "eligible_users_activitylog": 0,
        "retention_days": cutoff_days,
        "cutoff_date": cutoff_date.isoformat(),
    }
    try:
        with connection.cursor() as cursor:
            cursor.execute("SELECT COUNT(*) FROM case_activity_logs")
            stats["active_case_activity_logs"] = cursor.fetchone()[0]

            cursor.execute("SELECT COUNT(*) FROM case_activity_logs WHERE created_at < %s", [cutoff_date])
            stats["eligible_case_activity_logs"] = cursor.fetchone()[0]

            cursor.execute("SELECT COUNT(*) FROM case_activity_logs_archive")
            stats["archived_case_activity_logs"] = cursor.fetchone()[0]

            cursor.execute("SELECT COUNT(*) FROM users_activitylog")
            stats["active_users_activitylog"] = cursor.fetchone()[0]

            cursor.execute("SELECT COUNT(*) FROM users_activitylog WHERE created_at < %s", [cutoff_date])
            stats["eligible_users_activitylog"] = cursor.fetchone()[0]

            cursor.execute("SELECT COUNT(*) FROM users_activitylog_archive")
            stats["archived_users_activitylog"] = cursor.fetchone()[0]
    except Exception as e:
        logger.warning(f"Failed to fetch archive stats: {e}")

    return stats
