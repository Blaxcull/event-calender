// Test where height would change order
const events = [
  { id: 'eventA', slot: 50, height: 200, title: 'Event A (tall, middle)' },
  { id: 'eventB', slot: 0, height: 100, title: 'Event B (medium, early)' },
  { id: 'eventC', slot: 100, height: 50, title: 'Event C (short, late)' }
];

// Old sorting (by height first):
// 1. eventA (height 200) - even though slot is 50
// 2. eventB (height 100) - even though slot is 0
// 3. eventC (height 50)

// New sorting (by slot only):
// 1. eventB (slot 0)
// 2. eventA (slot 50)
// 3. eventC (slot 100)

function oldSortThreeEvents(events) {
  return [...events].sort((a, b) => {
    if (b.height !== a.height) return b.height - a.height;
    if (a.slot !== b.slot) return a.slot - b.slot;
    return events.indexOf(a) - events.indexOf(b);
  });
}

function newSortThreeEvents(events) {
  return [...events].sort((a, b) => {
    if (a.slot !== b.slot) return a.slot - b.slot;
    return events.indexOf(a) - events.indexOf(b);
  });
}

console.log('Old sort (by height first):');
oldSortThreeEvents(events).forEach(e => console.log(`  ${e.id}: slot=${e.slot}, height=${e.height}`));

console.log('\nNew sort (by slot only):');
newSortThreeEvents(events).forEach(e => console.log(`  ${e.id}: slot=${e.slot}, height=${e.height}`));

console.log('\nAre they different?', 
  JSON.stringify(oldSortThreeEvents(events).map(e => e.id)) !== 
  JSON.stringify(newSortThreeEvents(events).map(e => e.id)));
