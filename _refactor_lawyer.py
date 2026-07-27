import os
import re

def process_file(filepath):
    # Read the file
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    # Define replacements
    # 1. Exact matches
    replacements = [
        # Full caps
        (r'\bLAWYER\b', 'QC'),
        (r'\bLAWYERS\b', 'QCS'),
        
        # Capitalized
        (r'\bLawyer\b', 'QC'),
        (r'\bLawyers\b', 'QCs'),
        
        # Lowercase
        (r'\blawyer\b', 'qc'),
        (r'\blawyers\b', 'qcs'),
    ]

    new_content = content
    for pattern, repl in replacements:
        new_content = re.sub(pattern, repl, new_content)

    # Write back if changed
    if new_content != content:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(new_content)
        return True
    return False

def rename_file(filepath):
    # Only rename the base name, keeping directory intact
    dir_name = os.path.dirname(filepath)
    base_name = os.path.basename(filepath)
    
    new_base_name = base_name
    
    # Capitalized variations
    new_base_name = new_base_name.replace('Lawyer', 'QC')
    new_base_name = new_base_name.replace('lawyer', 'qc')
    
    if new_base_name != base_name:
        new_filepath = os.path.join(dir_name, new_base_name)
        os.rename(filepath, new_filepath)
        return new_filepath
    return None

if __name__ == '__main__':
    # Directories to scan
    dirs = ['frontend', 'users', 'Vendor_Portal', 'core']
    
    files_changed = 0
    files_renamed = 0
    
    for d in dirs:
        for root, _, files in os.walk(d):
            # Skip node_modules, .git, etc.
            if 'node_modules' in root or '.git' in root or '__pycache__' in root or '.expo' in root:
                continue
                
            for file in files:
                # Only process text files
                if file.endswith(('.js', '.jsx', '.ts', '.tsx', '.py', '.json', '.html', '.css', '.md')):
                    filepath = os.path.join(root, file)
                    
                    try:
                        changed = process_file(filepath)
                        if changed:
                            print(f"Updated content in: {filepath}")
                            files_changed += 1
                            
                        # Rename file if needed
                        new_path = rename_file(filepath)
                        if new_path:
                            print(f"Renamed: {filepath} -> {new_path}")
                            files_renamed += 1
                    except Exception as e:
                        print(f"Error processing {filepath}: {e}")
                        
    print(f"Done. Changed {files_changed} files, renamed {files_renamed} files.")
