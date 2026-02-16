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

console.log("Testing calculateEventDuration for events crossing midnight:")
console.log("==========================================================")

// Test 1: Event from 23:00 to 00:00 (1 hour, crosses midnight)
const duration1 = calculateEventDuration(event2300to0000)
console.log(`Event 23:00-00:00: Duration = ${duration1} minutes (expected: 60)`)

// Test 2: Event from 23:45 to 00:15 (30 minutes, crosses midnight)
const duration2 = calculateEventDuration(event2345to0015)
console.log(`Event 23:45-00:15: Duration = ${duration2} minutes (expected: 30)`)

// Test 3: Normal event (doesn't cross midnight)
const duration3 = calculateEventDuration(eventNormal)
console.log(`Event 10:00-11:00: Duration = ${duration3} minutes (expected: 60)`)

console.log("\nTest results:")
console.log(`Test 1 (23:00-00:00): ${duration1 === 60 ? "PASS" : "FAIL"}`)
console.log(`Test 2 (23:45-00:15): ${duration2 === 30 ? "PASS" : "FAIL"}`)
console.log(`Test 3 (10:00-11:00): ${duration3 === 60 ? "PASS" : "FAIL"}`)