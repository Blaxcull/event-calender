// Comprehensive test cases for eventUtils.ts
// To run: Install vitest first, then run: npm test

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { 
  addEventOnClick, 
  dragEvent, 
  resizeEvent, 
  restoreEventWidths,
  SLOT_HEIGHT, 
  STEP_HEIGHT,
  type EventType 
} from '../eventUtils'

// Mock DOM elements for testing
const mockElements = new Map<string, any>()

beforeEach(() => {
  mockElements.clear()
  vi.spyOn(document, 'getElementById').mockImplementation((id: string) => {
    if (!mockElements.has(id)) {
      const mockEl = {
        style: {
          transform: '',
          transformOrigin: '',
          zIndex: '',
        }
      }
      mockElements.set(id, mockEl)
    }
    return mockElements.get(id) as any
  })
})

describe('Event Utilities', () => {
  describe('addEventOnClick', () => {
    it('should prevent creating event where event already exists', () => {
      const events: EventType[] = [
        {
          id: 'event1',
          slot: SLOT_HEIGHT, // 1 hour position
          startHour: 1,
          startMin: 0,
          endHour: 2,
          endMin: 0,
          height: SLOT_HEIGHT,
          title: 'Existing Event'
        }
      ]
      
      // Click at the same position as existing event
      const result = addEventOnClick(SLOT_HEIGHT + 10, events)
      
      expect(result).toBeNull()
      // Console log should have been called
      expect(console.log).toHaveBeenCalledWith('Event clicked with id: event1')
    })

    it('should create event in empty space', () => {
      const events: EventType[] = []
      const clickY = SLOT_HEIGHT * 2 // 2 hours position
      
      const result = addEventOnClick(clickY, events)
      
      expect(result).not.toBeNull()
      expect(result?.slot).toBe(SLOT_HEIGHT * 2)
      expect(result?.height).toBe(SLOT_HEIGHT)
    })

    it('should use gap-finding logic when hour has events', () => {
      const events: EventType[] = [
        {
          id: 'event1',
          slot: SLOT_HEIGHT,
          startHour: 1,
          startMin: 0,
          endHour: 2,
          endMin: 0,
          height: SLOT_HEIGHT,
          title: 'Event 1'
        }
      ]
      
      // Click in the same hour block but at a different position
      const result = addEventOnClick(SLOT_HEIGHT + STEP_HEIGHT * 2, events, 'down')
      
      expect(result).not.toBeNull()
      // Should place after existing event
      expect(result?.slot).toBe(SLOT_HEIGHT * 2)
    })
  })

  describe('dragEvent', () => {
    it('should keep dragged event at 100% width and on top', () => {
      const draggedEvent: EventType = {
        id: 'dragged',
        slot: SLOT_HEIGHT,
        startHour: 1,
        startMin: 0,
        endHour: 2,
        endMin: 0,
        height: SLOT_HEIGHT,
        title: 'Dragged Event'
      }
      
      const otherEvent: EventType = {
        id: 'other',
        slot: SLOT_HEIGHT,
        startHour: 1,
        startMin: 0,
        endHour: 2,
        endMin: 0,
        height: SLOT_HEIGHT,
        title: 'Other Event'
      }
      
      const events = [draggedEvent, otherEvent]
      
      // Mock elements
      const draggedEl = { style: { transform: '', transformOrigin: '', zIndex: '' } }
      const otherEl = { style: { transform: '', transformOrigin: '', zIndex: '' } }
      mockElements.set('dragged', draggedEl)
      mockElements.set('other', otherEl)
      
      // Drag to new position
      const result = dragEvent(draggedEvent, SLOT_HEIGHT * 2, events)
      
      // Dragged event should be 100% width and on top
      expect(draggedEl.style.transform).toBe('none')
      expect(draggedEl.style.zIndex).toBe('9999')
      
      // Other event should be shrunk and below
      expect(otherEl.style.transform).toBe('scaleX(0.5)')
      expect(otherEl.style.zIndex).toBe('1')
      
      // Event position should be updated
      expect(result.slot).toBe(SLOT_HEIGHT * 2)
    })

    it('should handle 3 overlapping events at different positions', () => {
      const eventA: EventType = {
        id: 'eventA',
        slot: 0,
        startHour: 0,
        startMin: 0,
        endHour: 1,
        endMin: 0,
        height: SLOT_HEIGHT,
        title: 'Event A'
      }
      
      const eventB: EventType = {
        id: 'eventB',
        slot: STEP_HEIGHT * 4, // 20% position (1 hour = 4 steps)
        startHour: 0,
        startMin: 20,
        endHour: 1,
        endMin: 20,
        height: SLOT_HEIGHT,
        title: 'Event B'
      }
      
      const eventC: EventType = {
        id: 'eventC',
        slot: STEP_HEIGHT * 8, // 40% position
        startHour: 0,
        startMin: 40,
        endHour: 1,
        endMin: 40,
        height: SLOT_HEIGHT,
        title: 'Event C'
      }
      
      const events = [eventA, eventB, eventC]
      
      // Mock elements
      mockElements.set('eventA', { style: { transform: '', transformOrigin: '', zIndex: '' } })
      mockElements.set('eventB', { style: { transform: '', transformOrigin: '', zIndex: '' } })
      mockElements.set('eventC', { style: { transform: '', transformOrigin: '', zIndex: '' } })
      
      // Drag eventB over others
      dragEvent(eventB, 0, events)
      
      // All events should be properly handled
      const eventBEl = mockElements.get('eventB')
      expect(eventBEl.style.transform).toBe('none') // Dragged event 100% width
      expect(eventBEl.style.zIndex).toBe('9999') // On top
      
      // Other events should maintain their current styles
      const eventAEl = mockElements.get('eventA')
      const eventCEl = mockElements.get('eventC')
      expect(eventAEl.style.transform).toBe('') // No change during drag
      expect(eventCEl.style.transform).toBe('') // No change during drag
    })

    it('should handle event B fully over A and maintain widths during drag', () => {
      const eventA: EventType = {
        id: 'eventA',
        slot: 0,
        startHour: 0,
        startMin: 0,
        endHour: 2,
        endMin: 0,
        height: SLOT_HEIGHT * 2,
        title: 'Event A'
      }
      
      const eventB: EventType = {
        id: 'eventB',
        slot: 0,
        startHour: 0,
        startMin: 0,
        endHour: 1,
        endMin: 0,
        height: SLOT_HEIGHT,
        title: 'Event B'
      }
      
      const events = [eventA, eventB]
      
      // Mock elements - simulate that events already have proper widths
      // Event A: 100% width (after restoreEventWidths)
      // Event B: 80% width (after restoreEventWidths)
      const eventAEl = { style: { transform: 'none', transformOrigin: 'center', zIndex: '1' } }
      const eventBEl = { style: { transform: 'scaleX(0.5)', transformOrigin: 'right', zIndex: '2' } }
      mockElements.set('eventA', eventAEl)
      mockElements.set('eventB', eventBEl)
      
      // Drag eventB
      dragEvent(eventB, STEP_HEIGHT, events)
      
      // Event B should be 100% width during drag and on top
      expect(eventBEl.style.transform).toBe('none')
      expect(eventBEl.style.zIndex).toBe('9999')
      
      // Event A should maintain its current width (100%) during drag
      expect(eventAEl.style.transform).toBe('none')
      expect(eventAEl.style.zIndex).toBe('1') // Still behind
    })
  })

  describe('restoreEventWidths', () => {
    it('should handle 2 overlapping events (first: 100%, second: 50%)', () => {
      const events: EventType[] = [
        {
          id: 'event1',
          slot: 0,
          startHour: 0,
          startMin: 0,
          endHour: 1,
          endMin: 0,
          height: SLOT_HEIGHT,
          title: 'Event 1'
        },
        {
          id: 'event2',
          slot: STEP_HEIGHT * 2, // Overlaps with event1
          startHour: 0,
          startMin: 30,
          endHour: 1,
          endMin: 30,
          height: SLOT_HEIGHT,
          title: 'Event 2'
        }
      ]
      
      // Mock elements
      const event1El = { style: { transform: '', transformOrigin: '', zIndex: '' } }
      const event2El = { style: { transform: '', transformOrigin: '', zIndex: '' } }
      mockElements.set('event1', event1El)
      mockElements.set('event2', event2El)
      
      restoreEventWidths(events)
      
      // Event 1 (first, earlier): 100% width, behind
      expect(event1El.style.transform).toBe('none')
      expect(event1El.style.zIndex).toBe('1')
      
      // Event 2 (second, later): 50% width, in front
      expect(event2El.style.transform).toBe('scaleX(0.5)')
      expect(event2El.style.zIndex).toBe('2')
    })

    it('should handle 3 overlapping events (100%, 66%, 33%)', () => {
      const events: EventType[] = [
        {
          id: 'eventA',
          slot: 0,
          startHour: 0,
          startMin: 0,
          endHour: 1,
          endMin: 0,
          height: SLOT_HEIGHT,
          title: 'Event A'
        },
        {
          id: 'eventB',
          slot: STEP_HEIGHT * 4, // 20% position
          startHour: 0,
          startMin: 20,
          endHour: 1,
          endMin: 20,
          height: SLOT_HEIGHT,
          title: 'Event B'
        },
        {
          id: 'eventC',
          slot: STEP_HEIGHT * 8, // 40% position
          startHour: 0,
          startMin: 40,
          endHour: 1,
          endMin: 40,
          height: SLOT_HEIGHT,
          title: 'Event C'
        }
      ]
      
      // Mock elements
      const eventAEl = { style: { transform: '', transformOrigin: '', zIndex: '' } }
      const eventBEl = { style: { transform: '', transformOrigin: '', zIndex: '' } }
      const eventCEl = { style: { transform: '', transformOrigin: '', zIndex: '' } }
      mockElements.set('eventA', eventAEl)
      mockElements.set('eventB', eventBEl)
      mockElements.set('eventC', eventCEl)
      
      restoreEventWidths(events)
      
      // Event A (first): 100% width, behind
      expect(eventAEl.style.transform).toBe('none')
      expect(eventAEl.style.zIndex).toBe('1')
      
      // Event B (second): 66% width (2/3), middle
      expect(eventBEl.style.transform).toBe('scaleX(0.6666666666666666)')
      expect(eventBEl.style.zIndex).toBe('3') // index 1 + 2 = 3
      
      // Event C (third): 33% width (1/3), in front
      expect(eventCEl.style.transform).toBe('scaleX(0.3333333333333333)')
      expect(eventCEl.style.zIndex).toBe('4') // index 2 + 2 = 4
    })

    it('should handle 3 events where B overlaps A and C but A and C dont overlap (A and C: 100%, B: 50%)', () => {
      // A: 0-40%, B: 20-60%, C: 50-90%
      // A and C don't overlap (40 <= 50), B overlaps both
      const events: EventType[] = [
        {
          id: 'eventA',
          slot: 0,
          startHour: 0,
          startMin: 0,
          endHour: 1,
          endMin: 0,
          height: SLOT_HEIGHT * 0.4, // 40% of hour
          title: 'Event A'
        },
        {
          id: 'eventB',
          slot: STEP_HEIGHT * 4, // 20% position
          startHour: 0,
          startMin: 20,
          endHour: 1,
          endMin: 0,
          height: SLOT_HEIGHT * 0.4, // 40% of hour
          title: 'Event B'
        },
        {
          id: 'eventC',
          slot: STEP_HEIGHT * 10, // 50% position
          startHour: 0,
          startMin: 50,
          endHour: 1,
          endMin: 30,
          height: SLOT_HEIGHT * 0.4, // 40% of hour
          title: 'Event C'
        }
      ]
      
      // Mock elements
      const eventAEl = { style: { transform: '', transformOrigin: '', zIndex: '' } }
      const eventBEl = { style: { transform: '', transformOrigin: '', zIndex: '' } }
      const eventCEl = { style: { transform: '', transformOrigin: '', zIndex: '' } }
      mockElements.set('eventA', eventAEl)
      mockElements.set('eventB', eventBEl)
      mockElements.set('eventC', eventCEl)
      
      restoreEventWidths(events)
      
      // Event A (first): 100% width
      expect(eventAEl.style.transform).toBe('none')
      expect(eventAEl.style.zIndex).toBe('1')
      
      // Event B (middle): 50% width
      expect(eventBEl.style.transform).toBe('scaleX(0.5)')
      expect(eventBEl.style.zIndex).toBe('3') // index 1 + 2 = 3
      
      // Event C (last): 100% width
      expect(eventCEl.style.transform).toBe('none')
      expect(eventCEl.style.zIndex).toBe('2') // index 0 + 2 = 2 (but actually should be 2 for last)
    })

    it('should handle non-overlapping events (full width)', () => {
      const events: EventType[] = [
        {
          id: 'event1',
          slot: 0,
          startHour: 0,
          startMin: 0,
          endHour: 1,
          endMin: 0,
          height: SLOT_HEIGHT,
          title: 'Event 1'
        },
        {
          id: 'event2',
          slot: SLOT_HEIGHT * 2,
          startHour: 2,
          startMin: 0,
          endHour: 3,
          endMin: 0,
          height: SLOT_HEIGHT,
          title: 'Event 2'
        }
      ]
      
      // Mock elements
      const event1El = { style: { transform: 'scaleX(0.5)', transformOrigin: 'right', zIndex: '9999' } }
      const event2El = { style: { transform: 'scaleX(0.5)', transformOrigin: 'right', zIndex: '1' } }
      mockElements.set('event1', event1El)
      mockElements.set('event2', event2El)
      
      restoreEventWidths(events)
      
      // Non-overlapping events should be full width
      expect(event1El.style.transform).toBe('none')
      expect(event2El.style.transform).toBe('none')
    })
  })

  describe('resizeEvent', () => {
    it('should resize event height', () => {
      const event: EventType = {
        id: 'event1',
        slot: 0,
        startHour: 0,
        startMin: 0,
        endHour: 1,
        endMin: 0,
        height: SLOT_HEIGHT,
        title: 'Event 1'
      }
      
      const result = resizeEvent(event, SLOT_HEIGHT * 2)
      
      expect(result.height).toBe(SLOT_HEIGHT * 2)
      expect(result.endHour).toBe(2)
      expect(result.endMin).toBe(0)
    })

    it('should respect minimum event height', () => {
      const event: EventType = {
        id: 'event1',
        slot: 0,
        startHour: 0,
        startMin: 0,
        endHour: 1,
        endMin: 0,
        height: SLOT_HEIGHT,
        title: 'Event 1'
      }
      
      const result = resizeEvent(event, STEP_HEIGHT / 2) // Try to resize below minimum
      
      expect(result.height).toBe(STEP_HEIGHT) // Minimum height
    })
  })
})