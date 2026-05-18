import os
import re
import sys

components = [
    "button", "input", "badge", "checkbox", "card", "alert", 
    "dialog", "dropdown-menu", "select", "tabs", "textarea"
]

# Pattern for multi-line imports
# Handles: import { ... } from "..."
pattern_str = r'import\s+\{(?P<imports>[^}]*)\}\s+from\s+"(?P<path>(?:@/components/ui/|\.\./(?:.*/)?ui/)(?P<comp>%s))";?' % "|".join(components)
pattern = re.compile(pattern_str, re.MULTILINE | re.DOTALL)

def migrate_file(filepath):
    with open(filepath, 'r') as f:
        content = f.read()

    new_imports = []
    
    def replace_match(match):
        imports_text = match.group("imports")
        # Split by comma and clean up
        imports = [i.strip() for i in re.split(r'[,\n]', imports_text)]
        new_imports.extend([i for i in imports if i])
        return ""

    new_content = pattern.sub(replace_match, content)

    if new_imports:
        # Deduplicate and sort
        new_imports = sorted(list(set(new_imports)))
        
        # Check if @rosegriffon/ui is already imported
        rg_ui_pattern = re.compile(r'import\s+\{(?P<imports>[^}]*)\}\s+from\s+"@rosegriffon/ui";?', re.MULTILINE | re.DOTALL)
        rg_ui_match = rg_ui_pattern.search(new_content)
        
        if rg_ui_match:
            existing_imports_text = rg_ui_match.group("imports")
            existing_imports = [i.strip() for i in re.split(r'[,\n]', existing_imports_text)]
            new_imports.extend([i for i in existing_imports if i])
            new_imports = sorted(list(set(new_imports)))
            
            import_line = 'import { %s } from "@rosegriffon/ui";' % ", ".join(new_imports)
            new_content = rg_ui_pattern.sub(import_line, new_content)
        else:
            import_line = 'import { %s } from "@rosegriffon/ui";\n' % ", ".join(new_imports)
            lines = new_content.splitlines()
            inserted = False
            for i, line in enumerate(lines):
                if line.startswith("import "):
                    lines.insert(i, import_line.strip())
                    inserted = True
                    break
            if not inserted:
                lines.insert(0, import_line.strip())
            new_content = "\n".join(lines)
        
        # Clean up double newlines and semicolons if any
        new_content = re.sub(r'\n\n\n+', '\n\n', new_content)

    if content != new_content:
        with open(filepath, 'w') as f:
            f.write(new_content)
        return True
    return False

if __name__ == "__main__":
    files = sys.stdin.read().splitlines()
    for f in files:
        if os.path.isfile(f):
            try:
                if migrate_file(f):
                    print(f"Migrated {f}")
            except Exception as e:
                print(f"Error migrating {f}: {e}")
