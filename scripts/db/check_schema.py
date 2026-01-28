import psycopg2

conn = psycopg2.connect('dbname=user user=postgres password=Reset@123 host=localhost')
cur = conn.cursor()

cur.execute("""
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name='users_customuser' 
    ORDER BY ordinal_position
""")

print("Columns in users_customuser table:")
for row in cur.fetchall():
    print(f"  {row[0]:<30} {row[1]}")

conn.close()
