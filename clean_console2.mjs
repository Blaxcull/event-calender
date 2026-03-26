import fs from 'fs';
import path from 'path';

function removeConsoleStatements(content) {
    let lines = content.split('\n');
    let result = [];
    let i = 0;
    
    while (i < lines.length) {
        let line = lines[i];
        
        // Check if this line contains console
        if (!line.includes('console.')) {
            result.push(line);
            i++;
            continue;
        }
        
        // Check for complete console statement on single line
        const singleLineMatch = line.match(/^\s*console\.(log|error|warn|debug|info)\([^;]*\);?\s*$/);
        if (singleLineMatch) {
            i++;
            continue;
        }
        
        // Check for console statement at start of line
        if (line.match(/^\s*console\.(log|error|warn|debug|info)\s*\(/)) {
            // Find matching closing paren
            let parenDepth = 0;
            let j = line.indexOf('console.');
            while (j < line.length) {
                if (line[j] === '(') parenDepth++;
                else if (line[j] === ')') {
                    parenDepth--;
                    if (parenDepth === 0) break;
                }
                j++;
            }
            
            // Remove the console part, keep rest of line
            let before = line.substring(0, line.indexOf('console.'));
            let after = line.substring(j + 1);
            // Remove leading semicolon
            after = after.replace(/^;\s*/, '');
            
            if (before.trim() || after.trim()) {
                result.push((before + after).trim());
            }
            i++;
            continue;
        }
        
        // Check for if (x) console.log pattern
        const ifConsoleMatch = line.match(/if\s*\([^)]+\)\s*console\.(log|error|warn|debug|info)\s*\(/);
        if (ifConsoleMatch) {
            // This is an if with console, need to handle else too
            // Check if there's an else on next line
            let hasElse = false;
            let nextLineIdx = i + 1;
            while (nextLineIdx < lines.length && !lines[nextLineIdx].trim()) {
                nextLineIdx++;
            }
            
            if (nextLineIdx < lines.length && lines[nextLineIdx].includes('else')) {
                hasElse = true;
            }
            
            if (hasElse) {
                // Remove both if and else lines
                i = nextLineIdx + 1;
                continue;
            } else {
                // Just remove the console part from if line
                line = line.replace(/if\s*\([^)]+\)\s*console\.(log|error|warn|debug|info)\s*\([^;]*\);?\s*/, '');
                if (line.trim()) {
                    result.push(line);
                }
                i++;
                continue;
            }
        }
        
        // Otherwise keep the line as is (might have console in string or comment)
        result.push(line);
        i++;
    }
    
    return result.join('\n');
}

const files = [
    'src/store/eventsStore.ts',
    'src/Day_view/TimeView.tsx',
    'src/components/TimeUpdater.tsx',
    'src/SideBar/components/DateTimeEditor.tsx',
    'src/SideBar/components/EventEditor.tsx',
    'src/SideBar/components/RepeatReminderPanel.tsx',
    'src/SideBar/components/GoalSetter.tsx',
    'src/SideBar/components/RepeatRow.tsx',
    'src/SideBar/SideBar.tsx'
];

const baseDir = '/home/skulz/dev/event-calender/frontend';

files.forEach(file => {
    const fullPath = path.join(baseDir, file);
    if (fs.existsSync(fullPath)) {
        console.log(`Processing: ${file}`);
        const content = fs.readFileSync(fullPath, 'utf8');
        const newContent = removeConsoleStatements(content);
        
        // Clean up multiple blank lines
        const cleaned = newContent.replace(/\n\s*\n\s*\n/g, '\n\n');
        
        fs.writeFileSync(fullPath, cleaned, 'utf8');
    }
});

console.log('Done!');
