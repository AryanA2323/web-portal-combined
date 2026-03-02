"""
Management command to import court details from Excel file into court_details table.
"""

import os
from django.core.management.base import BaseCommand
from django.db import connections


class Command(BaseCommand):
    help = 'Import court details from Excel file into court_details table'

    def add_arguments(self, parser):
        parser.add_argument(
            '--file',
            type=str,
            default='Court Details with Taluka_06_Jan_2026(1) (2).xlsx',
            help='Path to the Excel file',
        )

    def handle(self, *args, **options):
        import openpyxl

        filepath = options['file']
        if not os.path.exists(filepath):
            self.stderr.write(self.style.ERROR(f'File not found: {filepath}'))
            return

        wb = openpyxl.load_workbook(filepath, read_only=True)
        ws = wb.active

        rows_to_insert = []
        current_city = None
        current_court = None
        current_court_location = None
        current_sr_no = None

        for i, row in enumerate(ws.iter_rows(min_row=2, values_only=True)):
            # Row: Sr.No, City, Taluka Court, Jurisdiction PS, PS Contact, PS Email,
            #       Court Complex Location, Date, Sanad No., Advocate Name, Cont No., EMAIL ID
            sr_no = row[0]
            city = row[1]
            taluka_court = row[2]
            jurisdiction_ps = row[3]
            ps_contact = row[4]
            ps_email = row[5]
            court_location = row[6]
            record_date = row[7]
            sanad_no = row[8]
            advocate_name = row[9]
            advocate_contact = row[10]
            advocate_email = row[11]

            # Forward-fill: city, taluka_court, court_location carry from previous row
            if sr_no is not None:
                current_sr_no = int(sr_no) if sr_no else None
            if city and str(city).strip():
                current_city = str(city).strip()
            if taluka_court and str(taluka_court).strip():
                current_court = str(taluka_court).strip()
            if court_location and str(court_location).strip():
                current_court_location = str(court_location).strip()

            # Skip rows with no useful data
            if not jurisdiction_ps and not advocate_name:
                continue

            # Clean up contact number
            contact_str = ''
            if advocate_contact:
                contact_str = str(advocate_contact).strip()
                # Remove .0 from float-parsed numbers
                if contact_str.endswith('.0'):
                    contact_str = contact_str[:-2]

            # Clean advocate name (remove non-breaking spaces)
            adv_name = ''
            if advocate_name:
                adv_name = str(advocate_name).replace('\xa0', ' ').strip()

            rows_to_insert.append((
                current_sr_no,
                current_city or '',
                current_court or '',
                str(jurisdiction_ps).strip() if jurisdiction_ps else '',
                str(ps_contact).strip() if ps_contact else '',
                str(ps_email).strip() if ps_email else '',
                current_court_location or '',
                record_date if record_date else None,
                str(sanad_no).strip() if sanad_no else '',
                adv_name,
                contact_str,
                str(advocate_email).strip() if advocate_email else '',
            ))

        wb.close()

        # Bulk insert
        with connections['default'].cursor() as cursor:
            # Clear existing data
            cursor.execute("DELETE FROM court_details")

            insert_sql = """
                INSERT INTO court_details
                    (sr_no, city, taluka_court, jurisdiction_police_station,
                     police_station_contact, police_station_email,
                     court_complex_location, record_date, sanad_no,
                     advocate_name, advocate_contact, advocate_email)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            """
            for row_data in rows_to_insert:
                cursor.execute(insert_sql, row_data)

        self.stdout.write(
            self.style.SUCCESS(f'Successfully imported {len(rows_to_insert)} court detail records')
        )
