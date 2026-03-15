import fs from 'fs';
import path from 'path';

function removeConsoleStatements(content) {
    let result = '';
    let i = 0;
    
    while (i < content.length) {
        // Check if we're at a console statement
        const consoleMatch = content.slice(i).match(/console\.(log|error|warn|debug|info)\s*\(/);
        
        if (!consoleMatch) {
            result += content[i];
            i++;
            continue;
        }
        
        // Found a console statement, find its start
        const consoleStart = i + content.slice(i).indexOf(consoleMatch[0]);
        
        // Add everything before the console
        result += content.slice(i, consoleStart);
        
        // Now find the matching closing parenthesis
        let parenDepth = 0;
        let j = consoleStart + consoleMatch[0].length - 1; // start after the opening (
        
        // Find the opening (
        while (j < content.length && content[j] !== '(') j++;
        if (j >= content.length) {
            result += content[i];
            i++;
            continue;
        }
        
        parenDepth = 1;
        j++;
        
        // Find matching closing )
        while (j < content.length && parenDepth > 0) {
            if (content[j] === '(') parenDepth++;
            else if (content[j] === ')') parenDepth--;
            j++;
        }
        
        // Skip the semicolon if present
        while (j < content.length && (content[j] === ';' || content[j] === ' ' || content[j] === '\n' || content[j] === '\r')) j++;
        
        // Move i to after the console statement
        i = j;
    }
    
    return result;
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
