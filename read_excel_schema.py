import pandas as pd
import sys

excel_file = r'd:\week2_backend_frontend\incident-management-platform-week2\traditional_DB\Insurance Management Information System.xlsx'

try:
    xls = pd.ExcelFile(excel_file)
    print('Sheet Names:', xls.sheet_names)
    print('\n' + '='*80)
    
    for sheet in xls.sheet_names:
        df = pd.read_excel(excel_file, sheet_name=sheet, nrows=5)
        print(f'\n\nSheet: {sheet}')
        print('='*80)
        print(f'Columns ({len(df.columns)}):', list(df.columns))
        print(f'\nSample data (first 3 rows):')
        print(df.head(3).to_string())
        print('\n')
        
except Exception as e:
    print(f"Error: {e}")
    import traceback
    traceback.print_exc()
