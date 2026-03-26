#!/bin/bash

# Process a TypeScript/JavaScript file to remove console statements
process_file() {
    local file="$1"
    echo "Processing: $file"
    
    # Create backup
    cp "$file" "$file.bak"
    
    # First pass: remove simple console.log() statements
    sed -i '/^\s*console\.\(log\|error\|warn\|debug\|info\)([^)]*);\s*$/d' "$file"
    
    # Second pass: remove console statements that might have trailing code
    # This handles cases like: console.log('msg'); // comment
    sed -i 's/console\.\(log\|error\|warn\|debug\|info\)([^)]*);//g' "$file"
    
    # Third pass: handle multi-line console statements
    # This is a simple approach - might not handle all cases
    sed -i '/^\s*console\.\(log\|error\|warn\|debug\|info\)([^)]*$/,/^\s*);\s*$/d' "$file"
    
    echo "  Done"
}

# Process all files with console statements
cd /home/skulz/dev/event-calender/frontend

# List of files to process (from earlier analysis)
files=(
    "src/store/eventsStore.ts"
    "src/Day_view/TimeView.tsx"
    "src/components/TimeUpdater.tsx"
    "src/SideBar/components/DateTimeEditor.tsx"
    "src/SideBar/components/EventEditor.tsx"
    "src/SideBar/components/RepeatReminderPanel.tsx"
    "src/SideBar/components/GoalSetter.tsx"
    "src/SideBar/components/RepeatRow.tsx"
    "src/SideBar/SideBar.tsx"
)

for file in "${files[@]}"; do
    if [ -f "$file" ]; then
        process_file "$file"
    else
        echo "Warning: File not found: $file"
    fi
done

echo "All files processed. Checking for remaining console statements..."

# Check for any remaining console statements
find src -type f \( -name "*.ts" -o -name "*.tsx" \) -exec grep -l "console\." {} \; | while read f; do
    echo "  Still has console statements: $f"
    grep -n "console\." "$f" | head -3
done