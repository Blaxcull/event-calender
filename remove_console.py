#!/usr/bin/env python3
import re
import sys

def remove_console_statements(content):
    """
    Remove console.log, console.error, console.warn, console.debug, console.info statements
    while preserving code structure.
    """
    # Pattern to match console statements
    patterns = [
        # Single line console.log('message');
        r'\s*console\.(?:log|error|warn|debug|info)\([^;]*\);?\s*',
        # Multi-line console statements
        r'\s*console\.(?:log|error|warn|debug|info)\([^)]*$',
    ]
    
    lines = content.split('\n')
    in_console_statement = False
    result_lines = []
    i = 0
    
    while i < len(lines):
        line = lines[i]
        
        # Check if we're already in a multi-line console statement
        if in_console_statement:
            # Check if this line ends the console statement
            if ')' in line:
                # Find where the console statement ends
                end_idx = line.find(')')
                # Keep everything after the closing paren
                remaining = line[end_idx + 1:].strip()
                if remaining:
                    # If there's code after the console statement, add it
                    result_lines.append(' ' * (len(line) - len(line.lstrip())) + remaining)
                in_console_statement = False
            # If the line doesn't end the statement, skip it
            i += 1
            continue
        
        # Check for console statements
        if 'console.' in line:
            # Check if it's a complete console statement on one line
            if re.search(r'console\.(?:log|error|warn|debug|info)\([^)]*\);?\s*$', line.strip()):
                # Skip this line entirely
                i += 1
                continue
            elif re.search(r'console\.(?:log|error|warn|debug|info)\(', line):
                # It's a multi-line console statement
                # Check if it ends on this line
                if ')' in line:
                    # Remove the console part
                    # Find the console statement start
                    console_start = line.find('console.')
                    if console_start >= 0:
                        # Keep everything before console
                        before = line[:console_start]
                        # Find where it ends
                        paren_end = line.find(')', console_start)
                        if paren_end >= 0:
                            after = line[paren_end + 1:].strip()
                            new_line = before.rstrip() + (' ' + after if after else '')
                            if new_line.strip():
                                result_lines.append(new_line)
                        else:
                            # Shouldn't happen since we checked for ')'
                            result_lines.append(before.rstrip())
                else:
                    # It's a multi-line statement that continues
                    in_console_statement = True
                i += 1
                continue
        
        # Not a console statement line, keep it
        result_lines.append(line)
        i += 1
    
    return '\n'.join(result_lines)

def process_file(filepath):
    with open(filepath, 'r') as f:
        content = f.read()
    
    new_content = remove_console_statements(content)
    
    with open(filepath, 'w') as f:
        f.write(new_content)
    
    print(f"Processed: {filepath}")

if __name__ == '__main__':
    if len(sys.argv) > 1:
        for filepath in sys.argv[1:]:
            process_file(filepath)
    else:
        print("Usage: python remove_console.py <file1> <file2> ...")