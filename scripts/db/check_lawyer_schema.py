#!/usr/bin/env python
import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()

from django.db import connection

cursor = connection.cursor()
cursor.execute("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'users_lawyer' ORDER BY ordinal_position")
columns = cursor.fetchall()
print('users_lawyer table columns:')
for col in columns:
    print(f'  - {col[0]}: {col[1]}')
