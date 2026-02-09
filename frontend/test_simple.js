// Simple test to understand current behavior
const events = [
  { id: 'event1', slot: 0, height: 86, title: 'Event 1' },
  { id: 'event2', slot: 43, height: 86, title: 'Event 2' }
];

// Mock the layoutTwoEvents logic
const STEP_HEIGHT = 21.5;
const startAtSamePoint = Math.abs(events[0].slot - events[1].slot) < STEP_HEIGHT;
console.log('Same start point?', startAtSamePoint); // false (43 > 21.5)

// Different start points logic
let firstEvent, secondEvent;
if (events[0].slot < events[1].slot) {
  firstEvent = events[0];
  secondEvent = events[1];
} else {
  firstEvent = events[1];
  secondEvent = events[0];
}

console.log('First event:', firstEvent.id);
console.log('Second event:', secondEvent.id);

// Width calculations (widthScale = 1 for 2 events)
const firstWidthPercent = 99; // 99 * 1
const secondWidthPercent = 89; // 89 * 1
const remOffset = 4.8; // 4.8 * 1

console.log('First event width: calc(' + firstWidthPercent + '% - ' + remOffset + 'rem)');
console.log('Second event width: calc(' + secondWidthPercent + '% - ' + remOffset + 'rem)');
