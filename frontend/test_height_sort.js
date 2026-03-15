// Test to verify height sorting is removed
const events = [
  { id: 'eventA', slot: 100, height: 50, title: 'Event A (short, late)' },
  { id: 'eventB', slot: 0, height: 200, title: 'Event B (tall, early)' },
  { id: 'eventC', slot: 50, height: 100, title: 'Event C (medium, middle)' }
];

// Old sorting (by height first):
// 1. eventB (height 200)
// 2. eventC (height 100) 
// 3. eventA (height 50)

// New sorting (by slot only):
// 1. eventB (slot 0)
// 2. eventC (slot 50)
// 3. eventA (slot 100)

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



  JSON.stringify(oldSortThreeEvents(events).map(e => e.id)) !== 
  JSON.stringify(newSortThreeEvents(events).map(e => e.id)));
