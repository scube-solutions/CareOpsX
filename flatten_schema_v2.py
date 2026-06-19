import re

def parse_sql(file_path):
    with open(file_path, 'r') as f:
        content = f.read()

    # Remove all comments
    content = re.sub(r'--.*$', '', content, flags=re.MULTILINE)
    
    # Remove grants
    content = re.sub(r'GRANT\s+.*?;', '', content, flags=re.IGNORECASE | re.DOTALL)
    
    # Extract statements
    statements = []
    buf = ""
    in_string = False
    for char in content:
        if char == "'":
            in_string = not in_string
        buf += char
        if char == ';' and not in_string:
            stmt = buf.strip()
            if stmt:
                statements.append(stmt)
            buf = ""
            
    tables = {}
    table_order = []
    other_stmts = []
    
    for stmt in statements:
        # Check if CREATE TABLE
        create_match = re.match(r'CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?([a-zA-Z0-9_\.]+)\s*\((.*)\)', stmt, flags=re.IGNORECASE | re.DOTALL)
        if create_match:
            table_name = create_match.group(1).lower()
            inner_content = create_match.group(2)
            
            if table_name not in tables:
                tables[table_name] = []
                table_order.append(table_name)
                
            # Parse columns
            cols = []
            cbuf = ""
            open_parens = 0
            for char in inner_content:
                if char == '(': open_parens += 1
                elif char == ')': open_parens -= 1
                
                if char == ',' and open_parens == 0:
                    if cbuf.strip():
                        cols.append(cbuf.strip())
                    cbuf = ""
                else:
                    cbuf += char
            if cbuf.strip():
                cols.append(cbuf.strip())
                
            for c in cols:
                # Get column name to deduplicate
                # The first word is the column name (or constraint like UNIQUE, PRIMARY KEY)
                c_clean = c.strip()
                if not c_clean: continue
                # Deduplicate by full string or by column name if it's a column definition
                # We'll just check if a column with the same name exists
                col_name = c_clean.split()[0].lower()
                if col_name not in ['unique', 'primary', 'foreign', 'check', 'constraint']:
                    # It's a column
                    exists = any(ex.split()[0].lower() == col_name for ex in tables[table_name] if ex.split()[0].lower() not in ['unique', 'primary', 'foreign', 'check', 'constraint'])
                    if not exists:
                        tables[table_name].append(c_clean)
                else:
                    if c_clean not in tables[table_name]:
                        tables[table_name].append(c_clean)
            continue
            
        # Check if ALTER TABLE ADD COLUMN
        alter_match = re.match(r'ALTER\s+TABLE\s+(?:IF\s+EXISTS\s+)?([a-zA-Z0-9_\.]+)\s+(.*)', stmt, flags=re.IGNORECASE | re.DOTALL)
        if alter_match:
            table_name = alter_match.group(1).lower()
            alter_body = alter_match.group(2)
            
            # Split ADD COLUMN
            add_cols = []
            abuf = ""
            open_parens = 0
            for char in alter_body:
                if char == '(': open_parens += 1
                elif char == ')': open_parens -= 1
                
                if char == ',' and open_parens == 0:
                    if abuf.strip():
                        add_cols.append(abuf.strip())
                    abuf = ""
                else:
                    abuf += char
            if abuf.strip():
                add_cols.append(abuf.strip())
                
            for col_def in add_cols:
                # Format: ADD COLUMN [IF NOT EXISTS] col_name type ...
                col_def = re.sub(r'^ADD\s+COLUMN\s+(?:IF\s+NOT\s+EXISTS\s+)?', '', col_def, flags=re.IGNORECASE).strip()
                if col_def and table_name in tables:
                    col_name = col_def.split()[0].lower()
                    exists = any(ex.split()[0].lower() == col_name for ex in tables[table_name] if ex.split()[0].lower() not in ['unique', 'primary', 'foreign', 'check', 'constraint'])
                    if not exists:
                        tables[table_name].append(col_def)
            continue
            
        # Keep other statements
        if re.match(r'^(CREATE|INSERT|UPDATE|SELECT|ALTER)', stmt, flags=re.IGNORECASE):
            # Skip empty or weird statements
            if 'GRANT' in stmt.upper(): continue
            # Avoid re-adding ALTER TABLES that are already handled (ADD COLUMN)
            # If it's another kind of ALTER, we keep it.
            if stmt.upper().startswith('ALTER TABLE') and 'ADD COLUMN' in stmt.upper():
                continue
            other_stmts.append(stmt)

    with open('CAREOPSX_BAREMETAL_SCHEMA.sql', 'w') as f:
        f.write("-- ============================================================\n")
        f.write("-- CareOpsX — Bare-Metal PostgreSQL 18 Compatible Schema\n")
        f.write("-- Flattened and Optimized (No ALTER statements for columns)\n")
        f.write("-- Supabase-specific dependencies removed.\n")
        f.write("-- ============================================================\n\n")
        
        # Schemas & Extensions
        for stmt in other_stmts:
            if stmt.upper().startswith('CREATE SCHEMA') or stmt.upper().startswith('CREATE EXTENSION'):
                f.write(stmt + ";\n\n")
                
        # Tables
        for table in table_order:
            f.write(f"CREATE TABLE IF NOT EXISTS {table} (\n")
            cols = tables[table]
            for idx, col in enumerate(cols):
                comma = "," if idx < len(cols) - 1 else ""
                f.write(f"  {col}{comma}\n")
            f.write(");\n\n")
            
        # Other definitions
        for stmt in other_stmts:
            if not (stmt.upper().startswith('CREATE SCHEMA') or stmt.upper().startswith('CREATE EXTENSION')):
                f.write(stmt + ";\n\n")
                
    print(f"Total tables: {len(table_order)}")

if __name__ == "__main__":
    parse_sql('COMPLETE_SCHEMA.sql')
