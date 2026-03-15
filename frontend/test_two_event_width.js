// Quick test to see what width 2-event same-start produces
const STEP_HEIGHT = 21.5;
const SLOT_HEIGHT = 86;

// Mock 2 events that start at same point
const eventA = {
  id: 'eventA',
  slot: 0,
  height: SLOT_HEIGHT * 2, // Taller
  title: 'Event A'
};

const eventB = {
  id: 'eventB', 
  slot: 10, // Within STEP_HEIGHT tolerance
  height: SLOT_HEIGHT, // Shorter
  title: 'Event B'
};

// Check if they start at same point
const startAtSamePoint = Math.abs(eventA.slot - eventB.slot) < STEP_HEIGHT;

// According to code:
// First event (taller): width = "calc(89% - 4.8rem)"
// Second event (shorter): width = "calc(49% - 2.352rem)"
// Second event left: "calc(4.75rem + 50%)"


