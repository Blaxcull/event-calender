// Final verification of implementation
const STEP_HEIGHT = 21.5;

// Simulate the logic
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

function sortThreeEventsByPattern(events, pattern) {
  if (pattern === "ALL_SAME_START") {
    // Height-based sorting when all start same
    return [...events].sort((a, b) => {
      if (b.height !== a.height) return b.height - a.height;
      return events.indexOf(a) - events.indexOf(b);
    });
  } else {
    // Slot-based sorting for other patterns
    return [...events].sort((a, b) => {
      if (a.slot !== b.slot) return a.slot - b.slot;
      return events.indexOf(a) - events.indexOf(b);
    });
  }
}


// Case 1: All start same, different heights
const case1 = [
  { id: 'ShortEarly', slot: 0, height: 50 },
  { id: 'TallMiddle', slot: 5, height: 200 },
  { id: 'MediumLate', slot: 10, height: 100 }
];
const pattern1 = analyzeThreeEventPattern(...case1);
const sorted1 = sortThreeEventsByPattern(case1, pattern1);

// Case 2: All different starts
const case2 = [
  { id: 'TallLate', slot: 100, height: 200 },
  { id: 'ShortEarly', slot: 0, height: 50 },
  { id: 'MediumMiddle', slot: 50, height: 100 }
];
const pattern2 = analyzeThreeEventPattern(...case2);
const sorted2 = sortThreeEventsByPattern(case2, pattern2);

// Case 3: Pair same start (A and B same, C different)
const case3 = [
  { id: 'TallSame', slot: 0, height: 200 },
  { id: 'ShortSame', slot: 5, height: 50 },
  { id: 'MediumDiff', slot: 100, height: 100 }
];
const pattern3 = analyzeThreeEventPattern(...case3);
const sorted3 = sortThreeEventsByPattern(case3, pattern3);

// Case 4: Verify height only matters for ALL_SAME_START
const case4 = [
  { id: 'TallButLate', slot: 100, height: 300 },
  { id: 'ShortButEarly', slot: 0, height: 50 },
  { id: 'MediumMiddle', slot: 50, height: 100 }
];
const pattern4 = analyzeThreeEventPattern(...case4);
const sorted4 = sortThreeEventsByPattern(case4, pattern4);
