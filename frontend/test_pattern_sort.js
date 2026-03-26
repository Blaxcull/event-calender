// Test pattern-aware sorting
const STEP_HEIGHT = 21.5;

function analyzeThreeEventPattern(eventA, eventB, eventC) {
  const abSame = Math.abs(eventA.slot - eventB.slot) < STEP_HEIGHT;
  const bcSame = Math.abs(eventB.slot - eventC.slot) < STEP_HEIGHT;
  const acSame = Math.abs(eventA.slot - eventC.slot) < STEP_HEIGHT;
  
  const sameCount = (abSame ? 1 : 0) + (bcSame ? 1 : 0) + (acSame ? 1 : 0);
  
  if (sameCount === 3) return "ALL_SAME_START";
  else if (sameCount === 2) return "CHAIN_SAME_START";
  else if (sameCount === 1) return "PAIR_SAME_START";
  else return "ALL_DIFFERENT_START";
}

function sortThreeEvents(events) {
  return [...events].sort((a, b) => {
    if (a.slot !== b.slot) return a.slot - b.slot;
    return events.indexOf(a) - events.indexOf(b);
  });
}

function sortThreeEventsByPattern(events, pattern) {
  if (pattern === "ALL_SAME_START") {
    return [...events].sort((a, b) => {
      if (b.height !== a.height) return b.height - a.height;
      return events.indexOf(a) - events.indexOf(b);
    });
  } else {
    return sortThreeEvents(events);
  }
}

// Test 1: ALL_SAME_START
const events1 = [
  { id: 'A', slot: 0, height: 100 },
  { id: 'B', slot: 5, height: 200 }, // within STEP_HEIGHT of 0
  { id: 'C', slot: 10, height: 50 }  // within STEP_HEIGHT of 5
];
const pattern1 = analyzeThreeEventPattern(...events1);
// Should be B, A, C (by height: 200, 100, 50)

// Test 2: ALL_DIFFERENT_START  
const events2 = [
  { id: 'A', slot: 0, height: 100 },
  { id: 'B', slot: 50, height: 200 }, // > STEP_HEIGHT
  { id: 'C', slot: 100, height: 50 }
];
const pattern2 = analyzeThreeEventPattern(...events2);
// Should be A, B, C (by slot: 0, 50, 100)

// Test 3: PAIR_SAME_START (A and B same, C different)
const events3 = [
  { id: 'A', slot: 0, height: 100 },
  { id: 'B', slot: 5, height: 200 }, // same as A (within STEP_HEIGHT)
  { id: 'C', slot: 50, height: 50 }  // different
];
const pattern3 = analyzeThreeEventPattern(...events3);
// Should be A, B, C (by slot: 0, 5, 50) - NOT by height!
