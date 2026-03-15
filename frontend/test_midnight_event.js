// Test for events crossing midnight
const { calculateEventDuration } = require('./dist/assets/index-yxbdxuvF.js?module=eventUtils')

// Mock event data for testing
const event2300to0000 = {
  startHour: 23,
  startMin: 0,
  endHour: 0,
  endMin: 0,
  title: "Test Event 23:00-00:00"
}

const event2345to0015 = {
  startHour: 23,
  startMin: 45,
  endHour: 0,
  endMin: 15,
  title: "Test Event 23:45-00:15"
}

const eventNormal = {
  startHour: 10,
  startMin: 0,
  endHour: 11,
  endMin: 0,
  title: "Test Event 10:00-11:00"
}


// Test 1: Event from 23:00 to 00:00 (1 hour, crosses midnight)
const duration1 = calculateEventDuration(event2300to0000)

// Test 2: Event from 23:45 to 00:15 (30 minutes, crosses midnight)
const duration2 = calculateEventDuration(event2345to0015)

// Test 3: Normal event (doesn't cross midnight)
const duration3 = calculateEventDuration(eventNormal)

