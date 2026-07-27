import os

def process_file(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    # Replacements in order (longest first to prevent partial overlaps, though here it doesn't strictly matter)
    replacements = [
        ('Lawyers', 'QCs'),
        ('lawyers', 'qcs'),
        ('LAWYERS', 'QCS'),
        ('Lawyer', 'QC'),
        ('lawyer', 'qc'),
        ('LAWYER', 'QC'),
    ]

    new_content = content
    for old, new in replacements:
        new_content = new_content.replace(old, new)

    if new_content != content:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(new_content)
        return True
    return False

def rename_file(filepath):
    dir_name = os.path.dirname(filepath)
    base_name = os.path.basename(filepath)
    
    new_base_name = base_name
    for old, new in [('Lawyers', 'QCs'), ('lawyers', 'qcs'), ('Lawyer', 'QC'), ('lawyer', 'qc')]:
        new_base_name = new_base_name.replace(old, new)
        
    if new_base_name != base_name:
        new_filepath = os.path.join(dir_name, new_base_name)
        os.rename(filepath, new_filepath)
        return new_filepath
    return None

if __name__ == '__main__':
    dirs = ['frontend/src', 'users', 'core']
    
    files_changed = 0
    files_renamed = 0
    
    for d in dirs:
        for root, _, files in os.walk(d):
            if 'node_modules' in root or '.git' in root or '__pycache__' in root or '.expo' in root:
                continue
                
            for file in files:
                if file.endswith(('.js', '.jsx', '.ts', '.tsx', '.py', '.json', '.html', '.css', '.md')):
                    filepath = os.path.join(root, file)
                    try:
                        changed = process_file(filepath)
                        if changed:
                            print(f"Updated: {filepath}")
                            files_changed += 1
                            
                        new_path = rename_file(filepath)
                        if new_path:
                            print(f"Renamed: {filepath} -> {new_path}")
                            files_renamed += 1
                    except Exception as e:
                        print(f"Error processing {filepath}: {e}")
                        
    print(f"Done. Changed {files_changed} files, renamed {files_renamed} files.")
