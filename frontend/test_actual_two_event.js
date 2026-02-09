// Test to see actual 2-event output
// We need to check what the ORIGINAL code produces, not my fixed version

console.log('Based on original code in eventUtils.ts lines 231-241:');
console.log('For same-start events:');
console.log('  First event: width = "calc(89% - 4.8rem)"');
console.log('  Second event: left = "calc( 50%)"  <-- BUG: missing 4.75rem!');
console.log('  Second event: width = "calc(49% )" <-- BUG: no rem subtraction!');
console.log('');
console.log('For different-start events:');
console.log('  First event: width = "calc(99% - 4.8rem)"');
console.log('  Second event: left = "calc(4.75rem + 10%)"');
console.log('  Second event: width = "calc(89% - 4.8rem)"');
console.log('');
console.log('So for 3 events:');
console.log('If all same-start, third event should match buggy: "calc(49% )"');
console.log('If all different-start, third event should match: "calc(89% - 4.8rem)"');