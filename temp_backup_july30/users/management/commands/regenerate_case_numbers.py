"""
Management command to regenerate case numbers for all existing cases
using the format: <client-code>-<serial>-SS-<year>
"""

import re
from django.core.management.base import BaseCommand
from django.db import connections


class Command(BaseCommand):
    help = 'Regenerate case numbers for all existing cases'

    def handle(self, *args, **options):
        cur = connections['default'].cursor()

        # Fetch all cases ordered by id
        cur.execute("SELECT id, client_name, case_receive_date, created_at FROM cases ORDER BY id")
        cases = cur.fetchall()

        if not cases:
            self.stdout.write('No cases found.')
            return

        # Track serial numbers per client_code+year
        serial_counters = {}
        updated = 0

        for case_id, client_name, receive_date, created_at in cases:
            # Extract client_code from client_name ("Name – Code" or "Name - Code")
            client_code = ''
            if client_name:
                match = re.search(r'[\u2013\-]\s*([A-Za-z0-9]+)\s*$', client_name)
                if match:
                    client_code = match.group(1).upper()

            # Determine year
            if receive_date:
                year = receive_date.year
            elif created_at:
                year = created_at.year
            else:
                from datetime import datetime
                year = datetime.now().year

            prefix = client_code if client_code else 'GEN'
            key = f"{prefix}-{year}"
            serial_counters[key] = serial_counters.get(key, 0) + 1
            serial = serial_counters[key]

            case_number = f"{prefix}-{serial:04d}-SS-{year}"

            # Update raw cases table
            cur.execute(
                "UPDATE cases SET case_number = %s WHERE id = %s",
                [case_number, case_id],
            )

            # Also update ORM insurance_case table if matching claim_number exists
            cur.execute(
                "SELECT claim_number FROM cases WHERE id = %s", [case_id]
            )
            claim_row = cur.fetchone()
            if claim_row and claim_row[0]:
                cur.execute(
                    "UPDATE insurance_case SET case_number = %s WHERE claim_number = %s",
                    [case_number, claim_row[0]],
                )

            updated += 1
            self.stdout.write(f"  {case_number} (case id={case_id}, client={client_name or 'N/A'})")

        self.stdout.write(self.style.SUCCESS(f"\nDone. Updated {updated} cases."))
