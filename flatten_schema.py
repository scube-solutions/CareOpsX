import re
import sys

def parse_and_flatten(input_file, output_file):
    with open(input_file, 'r') as f:
        lines = f.readlines()

    tables = {}
    table_order = []
    current_table = None
    
    other_statements = []
    
    # We will pass through the file and extract CREATE TABLE and ALTER TABLE ADD COLUMN
    i = 0
    while i < len(lines):
        line = lines[i]
        
        # Strip comments
        if line.strip().startswith('--'):
            i += 1
            continue
            
        # Match CREATE TABLE
        create_match = re.search(r'CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?([a-zA-Z0-9_\.]+)', line, re.IGNORECASE)
        if create_match:
            table_name = create_match.group(1).lower()
            if table_name not in tables:
                tables[table_name] = []
                table_order.append(table_name)
            
            # Read until ';'
            table_def = line
            while ';' not in table_def and i < len(lines) - 1:
                i += 1
                table_def += lines[i]
                
            # Extract inner content
            inner_match = re.search(r'\((.*)\)', table_def, re.DOTALL)
            if inner_match:
                inner_content = inner_match.group(1)
                columns = [c.strip() for c in inner_content.split(',\n') if c.strip()]
                # Further split by commas if not inside parentheses (like DECIMAL(10,2))
                # Simple hack: just split by comma and re-join if parens don't match
                real_cols = []
                buf = ""
                open_parens = 0
                for char in inner_content:
                    if char == '(': open_parens += 1
                    elif char == ')': open_parens -= 1
                    
                    if char == ',' and open_parens == 0:
                        if buf.strip():
                            real_cols.append(buf.strip())
                        buf = ""
                    else:
                        buf += char
                if buf.strip():
                    real_cols.append(buf.strip())
                
                tables[table_name].extend(real_cols)
            i += 1
            continue

        # Match ALTER TABLE ... ADD COLUMN
        alter_match = re.search(r'ALTER\s+TABLE\s+(?:IF\s+EXISTS\s+)?([a-zA-Z0-9_\.]+)', line, re.IGNORECASE)
        if alter_match:
            table_name = alter_match.group(1).lower()
            alter_def = line
            while ';' not in alter_def and i < len(lines) - 1:
                i += 1
                alter_def += lines[i]
            
            # Extract added columns
            add_statements = re.findall(r'ADD\s+COLUMN\s+(?:IF\s+NOT\s+EXISTS\s+)?(.*?)(?:,|$|;)', alter_def, re.IGNORECASE | re.DOTALL)
            for stmt in add_statements:
                stmt = stmt.strip()
                if stmt:
                    # Clean up trailing semicolons or whitespace
                    stmt = re.sub(r';$', '', stmt).strip()
                    if table_name in tables:
                        # Prevent duplicate columns
                        col_name = stmt.split()[0].lower()
                        if not any(c.lower().startswith(col_name) for c in tables[table_name]):
                            tables[table_name].append(stmt)
                    else:
                        print(f"Warning: ALTER TABLE for unknown table {table_name}")
            i += 1
            continue
            
        # Match CREATE OR REPLACE VIEW, CREATE SCHEMA, CREATE INDEX, INSERT INTO, UPDATE
        if re.search(r'^(CREATE\s+EXTENSION|CREATE\s+SCHEMA|CREATE\s+(?:OR\s+REPLACE\s+)?VIEW|CREATE\s+INDEX|INSERT\s+INTO|UPDATE|SELECT\s+setval)', line.strip(), re.IGNORECASE):
            stmt = line
            while ';' not in stmt and i < len(lines) - 1:
                i += 1
                stmt += lines[i]
            other_statements.append(stmt.strip())
            i += 1
            continue
            
        # Drop GRANTs
        if re.search(r'^GRANT', line.strip(), re.IGNORECASE):
            stmt = line
            while ';' not in stmt and i < len(lines) - 1:
                i += 1
                stmt += lines[i]
            i += 1
            continue

        i += 1

    # Now reconstruct the SQL
    with open(output_file, 'w') as f:
        f.write("-- ============================================================\n")
        f.write("-- CareOpsX — Bare-Metal PostgreSQL 18 Compatible Schema\n")
        f.write("-- Flattened and Optimized (No ALTER statements)\n")
        f.write("-- ============================================================\n\n")
        
        # Write schemas and extensions
        for stmt in other_statements:
            if stmt.upper().startswith('CREATE SCHEMA') or stmt.upper().startswith('CREATE EXTENSION'):
                f.write(stmt + "\n\n")
        
        # Write tables
        for table in table_order:
            f.write(f"CREATE TABLE IF NOT EXISTS {table} (\n")
            cols = tables[table]
            for idx, col in enumerate(cols):
                comma = "," if idx < len(cols) - 1 else ""
                f.write(f"  {col}{comma}\n")
            f.write(");\n\n")
            
        # Write indexes and views
        f.write("-- ============================================================\n")
        f.write("-- Indexes, Views & Sequences\n")
        f.write("-- ============================================================\n\n")
        for stmt in other_statements:
            if stmt.upper().startswith('CREATE INDEX') or stmt.upper().startswith('CREATE OR REPLACE VIEW') or stmt.upper().startswith('SELECT SETVAL'):
                f.write(stmt + "\n\n")
                
        # Write seeds (INSERT/UPDATE)
        f.write("-- ============================================================\n")
        f.write("-- Data Seeding\n")
        f.write("-- ============================================================\n\n")
        for stmt in other_statements:
            if stmt.upper().startswith('INSERT') or stmt.upper().startswith('UPDATE'):
                f.write(stmt + "\n\n")
                
    print(f"Successfully processed {len(table_order)} tables.")
    print("Extensions required: pgcrypto")

if __name__ == "__main__":
    parse_and_flatten('COMPLETE_SCHEMA.sql', 'CAREOPSX_BAREMETAL_SCHEMA.sql')
