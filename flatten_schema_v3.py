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
                c_clean = c.strip()
                if not c_clean: continue
                col_name = c_clean.split()[0].lower()
                if col_name not in ['unique', 'primary', 'foreign', 'check', 'constraint']:
                    exists = any(ex.split()[0].lower() == col_name for ex in tables[table_name] if ex.split()[0].lower() not in ['unique', 'primary', 'foreign', 'check', 'constraint'])
                    if not exists:
                        tables[table_name].append(c_clean.replace(';', ''))
                else:
                    if c_clean.replace(';', '') not in tables[table_name]:
                        tables[table_name].append(c_clean.replace(';', ''))
            continue
            
        # Check if ALTER TABLE
        alter_match = re.match(r'ALTER\s+TABLE\s+(?:IF\s+EXISTS\s+)?([a-zA-Z0-9_\.]+)\s+(.*)', stmt, flags=re.IGNORECASE | re.DOTALL)
        if alter_match:
            table_name = alter_match.group(1).lower()
            alter_body = alter_match.group(2)
            
            # Split operations
            ops = []
            abuf = ""
            open_parens = 0
            for char in alter_body:
                if char == '(': open_parens += 1
                elif char == ')': open_parens -= 1
                
                if char == ',' and open_parens == 0:
                    if abuf.strip():
                        ops.append(abuf.strip())
                    abuf = ""
                else:
                    abuf += char
            if abuf.strip():
                ops.append(abuf.strip())
                
            for op in ops:
                op = op.strip().replace(';', '')
                if re.match(r'^ADD\s+COLUMN', op, re.IGNORECASE):
                    col_def = re.sub(r'^ADD\s+COLUMN\s+(?:IF\s+NOT\s+EXISTS\s+)?', '', op, flags=re.IGNORECASE).strip()
                    if col_def and table_name in tables:
                        col_name = col_def.split()[0].lower()
                        exists = any(ex.split()[0].lower() == col_name for ex in tables[table_name] if ex.split()[0].lower() not in ['unique', 'primary', 'foreign', 'check', 'constraint'])
                        if not exists:
                            tables[table_name].append(col_def)
                else:
                    # Keep other ALTERs like ALTER COLUMN
                    other_stmts.append(f"ALTER TABLE {table_name} {op}")
            continue
            
        # Keep other statements
        if re.match(r'^(CREATE|INSERT|UPDATE|SELECT|ALTER)', stmt, flags=re.IGNORECASE):
            if 'GRANT' in stmt.upper(): continue
            other_stmts.append(stmt)

    with open('CAREOPSX_BAREMETAL_SCHEMA.sql', 'w') as f:
        f.write("-- ============================================================\n")
        f.write("-- CareOpsX — Bare-Metal PostgreSQL 18 Compatible Schema\n")
        f.write("-- Flattened and Optimized\n")
        f.write("-- Supabase-specific dependencies removed.\n")
        f.write("-- ============================================================\n\n")
        
        # Schemas & Extensions
        for stmt in other_stmts:
            if stmt.upper().startswith('CREATE SCHEMA') or stmt.upper().startswith('CREATE EXTENSION'):
                f.write(stmt + ";\n\n")
                
        # Tables
        for table in table_order:
            # Check for duplicate 'id' columns or multiple primary keys
            final_cols = []
            seen_id = False
            for c in tables[table]:
                if c.lower().startswith('id ') or c.lower().startswith('id\t'):
                    if not seen_id:
                        final_cols.append(c)
                        seen_id = True
                else:
                    final_cols.append(c)
                    
            f.write(f"CREATE TABLE IF NOT EXISTS {table} (\n")
            for idx, col in enumerate(final_cols):
                comma = "," if idx < len(final_cols) - 1 else ""
                # Replace weird trailing semicolons just in case
                col = col.replace(';', '')
                f.write(f"  {col}{comma}\n")
            f.write(");\n\n")
            
        # Other definitions
        for stmt in other_stmts:
            if not (stmt.upper().startswith('CREATE SCHEMA') or stmt.upper().startswith('CREATE EXTENSION')):
                f.write(stmt.replace(';;', ';') + ";\n\n")
                
    print(f"Total tables: {len(table_order)}")

if __name__ == "__main__":
    parse_sql('COMPLETE_SCHEMA.sql')
