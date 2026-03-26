#!/usr/bin/env python3
import re
import sys
import os

def clean_file(filepath):
    """Remove all console statements from a file."""
    with open(filepath, 'r') as f:
        lines = f.readlines()
    
    new_lines = []
    i = 0
    while i < len(lines):
        line = lines[i]
        
        # Check if this line contains console
        if 'console.' in line:
            # Find the start of console statement
            console_pos = line.find('console.')
            before = line[:console_pos]
            
            # Count parentheses to find the end
            paren_count = 0
            found_start = False
            end_pos = -1
            
            for j, ch in enumerate(line[console_pos:]):
                if ch == '(':
                    paren_count += 1
                    found_start = True
                elif ch == ')':
                    paren_count -= 1
                    if found_start and paren_count == 0:
                        end_pos = console_pos + j + 1
                        break
            
            if end_pos >= 0:
                # Found complete statement on this line
                after = line[end_pos:].strip()
                if after and after[0] == ';':
                    after = after[1:].strip()
                
                new_line = before.rstrip()
                if after:
                    new_line += ' ' + after
                
                if new_line.strip():
                    new_lines.append(new_line)
                else:
                    # Line is empty after removal
                    pass
                i += 1
            else:
                # Multi-line console statement
                # Skip this line and continue until we find the closing )
                i += 1
                while i < len(lines):
                    line2 = lines[i]
                    paren_count = 0
                    for ch in line2:
                        if ch == '(':
                            paren_count += 1
                        elif ch == ')':
                            paren_count -= 1
                            if paren_count <= 0:
                                # Found end
                                # Skip to next line
                                i += 1
                                break
                    if paren_count <= 0:
                        break
                    i += 1
        else:
            # No console in this line
            new_lines.append(line.rstrip('\n'))
            i += 1
    
    # Write back
    with open(filepath, 'w') as f:
        f.write('\n'.join(new_lines))
    
    print(f"Cleaned: {filepath}")

def main():
    # List of files to clean
    base_dir = "/home/skulz/dev/event-calender/frontend"
    files = [
        "src/store/eventsStore.ts",
        "src/Day_view/TimeView.tsx",
        "src/components/TimeUpdater.tsx",
        "src/SideBar/components/DateTimeEditor.tsx",
        "src/SideBar/components/EventEditor.tsx",
        "src/SideBar/components/RepeatReminderPanel.tsx",
        "src/SideBar/components/GoalSetter.tsx",
        "src/SideBar/components/RepeatRow.tsx",
        "src/SideBar/SideBar.tsx"
    ]
    
    for file in files:
        full_path = os.path.join(base_dir, file)
        if os.path.exists(full_path):
            clean_file(full_path)
        else:
            print(f"File not found: {full_path}")
    
    print("\nChecking for remaining console statements...")
    for root, dirs, filenames in os.walk(os.path.join(base_dir, "src")):
        for filename in filenames:
            if filename.endswith(('.ts', '.tsx')):
                filepath = os.path.join(root, filename)
                with open(filepath, 'r') as f:
                    content = f.read()
                    if 'console.' in content:
                        print(f"  Still has console: {filepath}")

if __name__ == "__main__":
    main()