"""
Management command to seed initial client data into the database.
"""

from django.core.management.base import BaseCommand
from users.models import Client


INITIAL_CLIENTS = [
    {
        'client_code': 'R001',
        'client_name': 'IndusInd Insurance Co Ltd',
    },
    {
        'client_code': 'M002',
        'client_name': 'Generali Central Insurance Company Limited',
    },
    {
        'client_code': 'F001',
        'client_name': 'Generali Central Insurance Company Limited',
    },
    {
        'client_code': 'S002',
        'client_name': 'SBI General Insurance Company Ltd',
    },
    {
        'client_code': 'B002',
        'client_name': 'Bajaj Allianz General Insurance Company Ltd',
    },
]


class Command(BaseCommand):
    help = 'Seed initial clients into the database'

    def handle(self, *args, **options):
        created_count = 0
        skipped_count = 0

        for client_data in INITIAL_CLIENTS:
            _, created = Client.objects.get_or_create(
                client_code=client_data['client_code'],
                defaults={'client_name': client_data['client_name']},
            )
            if created:
                created_count += 1
                self.stdout.write(
                    self.style.SUCCESS(f"  Created: {client_data['client_code']} – {client_data['client_name']}")
                )
            else:
                skipped_count += 1
                self.stdout.write(
                    f"  Skipped (exists): {client_data['client_code']} – {client_data['client_name']}"
                )

        self.stdout.write(
            self.style.SUCCESS(f"\nDone. Created: {created_count}, Skipped: {skipped_count}")
        )
