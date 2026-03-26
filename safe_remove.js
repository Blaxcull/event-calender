const fs = require('fs');
const path = require('path');

function removeConsoleStatements(content) {
    // Pattern 1: Simple console.log() on its own line
    let result = content.replace(/^\s*console\.(log|error|warn|debug|info)\([^;]*\);?\s*$/gm, '');
    
    // Pattern 2: console.log() with trailing semicolon and possibly whitespace
    result = result.replace(/\s*console\.(log|error|warn|debug|info)\([^)]*\);?\s*/g, '');
    
    // Pattern 3: Handle if (error) console.error() pattern - keep if structure
    result = result.replace(/if\s*\(([^)]+)\)\s*console\.(error|warn|log)\([^)]*\);?\s*else\s*console\.(log|error|warn)\([^)]*\);?/g, 'if ($1) {} else {}');
    
    // Pattern 4: Handle just if (condition) console.log()
    result = result.replace(/if\s*\(([^)]+)\)\s*console\.(log|error|warn)\([^)]*\);?/g, 'if ($1) {}');
    
    // Pattern 5: Remove empty else {}
    result = result.replace(/\s*else\s*\{\s*\}/g, '');
    
    // Pattern 6: Remove empty if () {}
    result = result.replace(/if\s*\([^)]*\)\s*\{\s*\}(?!\s*else)/g, '');
    
    // Remove double blank lines
    result = result.replace(/\n\s*\n\s*\n/g, '\n\n');
    
    return result;
}

// Process files
const files = [
    '../frontend/src/store/eventsStore.ts',
    '../frontend/src/Day_view/TimeView.tsx',
    '../frontend/src/components/TimeUpdater.tsx',
    '../frontend/src/SideBar/components/DateTimeEditor.tsx',
    '../frontend/src/SideBar/components/EventEditor.tsx',
    '../frontend/src/SideBar/components/RepeatReminderPanel.tsx',
    '../frontend/src/SideBar/components/GoalSetter.tsx',
    '../frontend/src/SideBar/components/RepeatRow.tsx',
    '../frontend/src/SideBar/SideBar.tsx'
];

files.forEach(file => {
    const fullPath = path.join(__dirname, file);
    if (fs.existsSync(fullPath)) {
        console.log(`Processing: ${file}`);
        const content = fs.readFileSync(fullPath, 'utf8');
        const newContent = removeConsoleStatements(content);
        fs.writeFileSync(fullPath, newContent, 'utf8');
    } else {
        console.log(`File not found: ${file}`);
    }
});

console.log('\nDone!');