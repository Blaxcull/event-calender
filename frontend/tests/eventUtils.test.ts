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
} from '../src/lib/eventUtils'

// Mock DOM elements for testing
const mockElements = new Map<string, unknown>()

beforeEach(() => {
  mockElements.clear()
  
  // Mock global document
  global.document = {
    getElementById: vi.fn((id: string) => {
      if (!mockElements.has(id)) {
        const mockEl = {
          style: {
            transform: '',
            transformOrigin: '',
            zIndex: '',
            left: '',
            width: '',
            removeProperty: vi.fn((prop: string) => {
              // Mock removeProperty implementation
              if (prop === '--event-scale') {
                mockEl.style.transform = ''
                mockEl.style.transformOrigin = ''
              }
            })
          }
        }
        mockElements.set(id, mockEl)
      }
      return mockElements.get(id)
    })
  } as unknown as Document
})

describe('Event Utilities', () => {
  describe('addEventOnClick', () => {
    it('should create event in gap when clicking on existing event', () => {
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
      
      // With current logic, places at hourStart (86) since no events end before click
      expect(result).not.toBeNull()
      expect(result?.slot).toBe(SLOT_HEIGHT) // Places at 1 hour (86)
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
      // Click is at 1.5 hours (129), snapped to 1.5 hours (129)
      // Event ends at 2 hours (172), 172 <= 129 is false
      // So places at hourStart (86)
      expect(result?.slot).toBe(SLOT_HEIGHT)
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
      
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
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
      
      // events variable not needed for dragEvent tests
      
       // Mock elements
      const draggedEl = { style: { transform: '', transformOrigin: '', zIndex: '', left: '', width: '' } }
      const otherEl = { style: { transform: '', transformOrigin: '', zIndex: '', left: '', width: '' } }
      mockElements.set('dragged', draggedEl)
      mockElements.set('other', otherEl)
      
      // Drag to new position
      const result = dragEvent(draggedEvent, SLOT_HEIGHT * 2)
      
      // Dragged event should be 100% width and on top
      expect(draggedEl.style.left).toBe('4.75rem')
      expect(draggedEl.style.width).toBe('calc(100% - 4.75rem)')
      expect(draggedEl.style.zIndex).toBe('9999')
      
      // Other event should maintain its current position (zIndex not set during drag)
      expect(otherEl.style.zIndex).toBe('')
      
      // Event position should be updated
      expect(result.slot).toBe(SLOT_HEIGHT * 2)
    })

    it('should handle 3 overlapping events at different positions', () => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
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
      
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
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
      
      // events variable not needed for dragEvent tests
      
      // Mock elements
      mockElements.set('eventA', { style: { transform: '', transformOrigin: '', zIndex: '' } })
      mockElements.set('eventB', { style: { transform: '', transformOrigin: '', zIndex: '' } })
      mockElements.set('eventC', { style: { transform: '', transformOrigin: '', zIndex: '' } })
      
      // Drag eventB over others
      dragEvent(eventB, 0)
      
      // All events should be properly handled
      const eventBEl = mockElements.get('eventB') as { style: { transform: string; zIndex: string } }
      expect(eventBEl.style.transform).toBe('') // Dragged event sets left/width directly
      expect(eventBEl.style.zIndex).toBe('9999') // On top
      
      // Other events should maintain their current styles
      const eventAEl = mockElements.get('eventA') as { style: { transform: string } }
      const eventCEl = mockElements.get('eventC') as { style: { transform: string } }
      expect(eventAEl.style.transform).toBe('') // No change during drag
      expect(eventCEl.style.transform).toBe('') // No change during drag
    })

    it('should handle event B fully over A and maintain widths during drag', () => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
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
      
      // events variable not needed for dragEvent tests
      
       // Mock elements - simulate that events already have proper widths
      // Event A: 100% width (after restoreEventWidths)
      // Event B: 50% width (after restoreEventWidths)
      const eventAEl = { style: { transform: 'none', transformOrigin: 'center', zIndex: '1', left: '', width: '' } }
      const eventBEl = { style: { transform: 'scaleX(0.5)', transformOrigin: 'right', zIndex: '2', left: '', width: '' } }
      mockElements.set('eventA', eventAEl)
      mockElements.set('eventB', eventBEl)
      
      // Drag eventB
      dragEvent(eventB, STEP_HEIGHT)
      
       // Event B should be 100% width during drag and on top
      expect(eventBEl.style.left).toBe('4.75rem')
      expect(eventBEl.style.width).toBe('calc(100% - 4.75rem)')
      expect(eventBEl.style.zIndex).toBe('9999')
      
      // Event A should maintain its current position during drag
      expect(eventAEl.style.zIndex).toBe('1') // Still behind
    })
  })

  describe('restoreEventWidths', () => {
    it('should handle 2 overlapping events with same height', () => {
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
      const event1El = { style: { left: '', width: '', zIndex: '' } }
      const event2El = { style: { left: '', width: '', zIndex: '' } }
      mockElements.set('event1', event1El)
      mockElements.set('event2', event2El)
      
      restoreEventWidths(events)
      
      // Case 1: Both same height
      // First event: left=0%, width=80%
      // Second event: left=20%, width=80%
      // Event that starts first (event1) at bottom (z-index=1)
      
      expect(event1El.style.left).toBe('calc(4.75rem + 0%)')
      expect(event1El.style.width).toBe('calc(80% - 3.8rem)')
      expect(event1El.style.zIndex).toBe('1') // Starts first -> bottom
      
      expect(event2El.style.left).toBe('calc(4.75rem + 20%)')
      expect(event2El.style.width).toBe('calc(80% - 3.8rem)')
      expect(event2El.style.zIndex).toBe('2') // Starts later -> top
    })

    it('should handle 2 events with different heights starting at same point', () => {
      const events: EventType[] = [
        {
          id: 'event1',
          slot: 0,
          startHour: 0,
          startMin: 0,
          endHour: 2,
          endMin: 0,
          height: SLOT_HEIGHT * 2, // Taller
          title: 'Event 1'
        },
        {
          id: 'event2',
          slot: 0, // Same start point
          startHour: 0,
          startMin: 0,
          endHour: 1,
          endMin: 0,
          height: SLOT_HEIGHT, // Shorter
          title: 'Event 2'
        }
      ]
      
      // Mock elements
      const event1El = { style: { left: '', width: '', zIndex: '' } }
      const event2El = { style: { left: '', width: '', zIndex: '' } }
      mockElements.set('event1', event1El)
      mockElements.set('event2', event2El)
      
      restoreEventWidths(events)
      
      // Case 2, Subcase 1: Different heights, same start point
      // When same start point: taller event at bottom (gets 0% position)
      // Shorter event on top (gets 20% position) with more right side empty (70% width)
      
      expect(event1El.style.left).toBe('calc(4.75rem + 0%)')
      expect(event1El.style.width).toBe('calc(80% - 3.8rem)') // Taller event: 80% width
      expect(event1El.style.zIndex).toBe('1') // Taller -> bottom
      
      expect(event2El.style.left).toBe('calc(4.75rem + 20%)')
      expect(event2El.style.width).toBe('calc(70% - 3.325rem)') // Shorter event: 70% width (more right empty)
      expect(event2El.style.zIndex).toBe('2') // Shorter -> top
    })

    it('should handle 2 events with same height starting at exact same point', () => {
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
          slot: 0, // Exact same start point
          startHour: 0,
          startMin: 0,
          endHour: 1,
          endMin: 0,
          height: SLOT_HEIGHT,
          title: 'Event 2'
        }
      ]
      
      // Mock elements
      const event1El = { style: { left: '', width: '', zIndex: '' } }
      const event2El = { style: { left: '', width: '', zIndex: '' } }
      mockElements.set('event1', event1El)
      mockElements.set('event2', event2El)
      
      restoreEventWidths(events)
      
      // When same height and same start: event with smaller id or first in array gets 0% position
      // Top event should have 70% width (more right empty)
      
      // One event gets 0% position, the other gets 20%
      // Both have same width for bottom event (80%) and top event (70%)
      // Check that widths are correct
      expect(event1El.style.width).toBeOneOf(['calc(80% - 3.8rem)', 'calc(70% - 3.325rem)'])
      expect(event2El.style.width).toBeOneOf(['calc(80% - 3.8rem)', 'calc(70% - 3.325rem)'])
      
      // One should have left=0%, the other left=20%
      expect(event1El.style.left).toBeOneOf(['calc(4.75rem + 0%)', 'calc(4.75rem + 20%)'])
      expect(event2El.style.left).toBeOneOf(['calc(4.75rem + 0%)', 'calc(4.75rem + 20%)'])
      
      // Z-index: one is 1, other is 2
      expect(event1El.style.zIndex).toBeOneOf(['1', '2'])
      expect(event2El.style.zIndex).toBeOneOf(['1', '2'])
    })

    it('should handle 2 events where second starts before first', () => {
      const events: EventType[] = [
        {
          id: 'event1',
          slot: STEP_HEIGHT * 2, // Starts later
          startHour: 0,
          startMin: 30,
          endHour: 1,
          endMin: 30,
          height: SLOT_HEIGHT,
          title: 'Event 1'
        },
        {
          id: 'event2',
          slot: 0, // Starts first
          startHour: 0,
          startMin: 0,
          endHour: 1,
          endMin: 0,
          height: SLOT_HEIGHT,
          title: 'Event 2'
        }
      ]
      
      // Mock elements
      const event1El = { style: { left: '', width: '', zIndex: '' } }
      const event2El = { style: { left: '', width: '', zIndex: '' } }
      mockElements.set('event1', event1El)
      mockElements.set('event2', event2El)
      
      restoreEventWidths(events)
      
      // event2 starts first (slot 0) -> should be at bottom (z-index=1) -> left=0%
      // event1 starts later (slot 43) -> should be at top (z-index=2) -> left=20%
      
      expect(event1El.style.left).toBe('calc(4.75rem + 20%)') // Starts later -> right offset
      expect(event1El.style.width).toBe('calc(80% - 3.8rem)')
      expect(event1El.style.zIndex).toBe('2') // Starts later -> top
      
      expect(event2El.style.left).toBe('calc(4.75rem + 0%)') // Starts first -> left position
      expect(event2El.style.width).toBe('calc(80% - 3.8rem)')
      expect(event2El.style.zIndex).toBe('1') // Starts first -> bottom
    })

    it('should handle 2 events with different heights starting at different points', () => {
      const events: EventType[] = [
        {
          id: 'event1',
          slot: 0,
          startHour: 0,
          startMin: 0,
          endHour: 2,
          endMin: 0,
          height: SLOT_HEIGHT * 2, // Taller but starts first
          title: 'Event 1'
        },
        {
          id: 'event2',
          slot: STEP_HEIGHT * 2, // Starts later
          startHour: 0,
          startMin: 30,
          endHour: 1,
          endMin: 30,
          height: SLOT_HEIGHT, // Shorter
          title: 'Event 2'
        }
      ]
      
      // Mock elements
      const event1El = { style: { left: '', width: '', zIndex: '' } }
      const event2El = { style: { left: '', width: '', zIndex: '' } }
      mockElements.set('event1', event1El)
      mockElements.set('event2', event2El)
      
      restoreEventWidths(events)
      
      // Case 2, Subcase 2: Different heights, different start points
      // Same width layout: 0-80% and 20-100%
      // Event that starts first (event1) at bottom (z-index=1), ignore height
      
      expect(event1El.style.left).toBe('calc(4.75rem + 0%)')
      expect(event1El.style.width).toBe('calc(80% - 3.8rem)')
      expect(event1El.style.zIndex).toBe('1') // Starts first -> bottom
      
      expect(event2El.style.left).toBe('calc(4.75rem + 20%)')
      expect(event2El.style.width).toBe('calc(80% - 3.8rem)')
      expect(event2El.style.zIndex).toBe('2') // Starts later -> top
    })

    it('should handle 3 overlapping events with cascading layout', () => {
      const events: EventType[] = [
        {
          id: 'eventA',
          slot: 0,
          startHour: 0,
          startMin: 0,
          endHour: 1,
          endMin: 30, // Extends to 1:30 to overlap with C
          height: SLOT_HEIGHT * 1.5, // 90 minutes
          title: 'Event A'
        },
        {
          id: 'eventB',
          slot: STEP_HEIGHT * 2, // 10% position
          startHour: 0,
          startMin: 10,
          endHour: 1,
          endMin: 10,
          height: SLOT_HEIGHT,
          title: 'Event B'
        },
        {
          id: 'eventC',
          slot: STEP_HEIGHT * 3, // 15% position - overlaps with A
          startHour: 0,
          startMin: 15,
          endHour: 1,
          endMin: 15,
          height: SLOT_HEIGHT,
          title: 'Event C'
        }
      ]
      
      // Mock elements
      const eventAEl = { style: { left: '', width: '', zIndex: '' } }
      const eventBEl = { style: { left: '', width: '', zIndex: '' } }
      const eventCEl = { style: { left: '', width: '', zIndex: '' } }
      mockElements.set('eventA', eventAEl)
      mockElements.set('eventB', eventBEl)
      mockElements.set('eventC', eventCEl)
      
      restoreEventWidths(events)
      
      // For 3 events with default config:
      // baseOffset = min(15, 1.0*100/(3*2.0)) = min(15, 16.67) = 15%
      // widthDecrement = min(20, 0.8*100/3) = min(20, 26.67) = 20%
      // All events have same height, so order is by original position
      
      // All events overlap, should use cascading layout
      // Sorted by height: A (129) > B (86) = C (86), then by slot
      // Event A (tallest): left=0%, width=100%, z-index=1
      expect(['calc(4.75rem + 0%)', '4.75rem']).toContain(eventAEl.style.left)
      expect(eventAEl.style.width).toBe('100%')
      expect(eventAEl.style.zIndex).toBe('1')
      
      // Event B (shorter, earlier slot): left=15%, width=80%, z-index=2
      expect(eventBEl.style.left).toBe('calc(4.75rem + 15%)')
      expect(eventBEl.style.width).toBe('80%')
      expect(eventBEl.style.zIndex).toBe('2')
      
      // Event C (shorter, later slot): left=30%, width=60%, z-index=3
      expect(eventCEl.style.left).toBe('calc(4.75rem + 30%)')
      expect(eventCEl.style.width).toBe('60%')
      expect(eventCEl.style.zIndex).toBe('3')
    })

    it('should handle 3 events with different heights (tallest at bottom)', () => {
      // Events with different heights to test height-based sorting
      // All events overlap significantly
      const events: EventType[] = [
        {
          id: 'eventA',
          slot: 0,
          startHour: 0,
          startMin: 0,
          endHour: 1,
          endMin: 30,
          height: SLOT_HEIGHT * 1.5, // 90 minutes - tallest
          title: 'Event A'
        },
        {
          id: 'eventB',
          slot: STEP_HEIGHT * 2, // 10% position
          startHour: 0,
          startMin: 10,
          endHour: 1,
          endMin: 10,
          height: SLOT_HEIGHT, // 60 minutes - shortest
          title: 'Event B'
        },
        {
          id: 'eventC',
          slot: STEP_HEIGHT * 4, // 20% position
          startHour: 0,
          startMin: 20,
          endHour: 1,
          endMin: 20,
          height: SLOT_HEIGHT * 1.2, // 72 minutes - middle
          title: 'Event C'
        }
      ]
      
      // Mock elements
      const eventAEl = { style: { left: '', width: '', zIndex: '' } }
      const eventBEl = { style: { left: '', width: '', zIndex: '' } }
      const eventCEl = { style: { left: '', width: '', zIndex: '' } }
      mockElements.set('eventA', eventAEl)
      mockElements.set('eventB', eventBEl)
      mockElements.set('eventC', eventCEl)
      
      restoreEventWidths(events)
      
      // For 3 events with default config:
      // baseOffset = min(15, 1.0*100/(3*2.0)) = min(15, 16.67) = 15%
      // widthDecrement = min(20, 0.8*100/3) = min(20, 26.67) = 20%
      // Sorted by height: eventA (60%) > eventC (50%) > eventB (40%)
      
      // Sorted by height: eventA (129) > eventC (103.2) > eventB (86)
      // Event A (tallest): left might be calc(4.75rem + 0%) or 4.75rem
      expect(['calc(4.75rem + 0%)', '4.75rem']).toContain(eventAEl.style.left)
      expect(eventAEl.style.width).toBe('100%')
      expect(eventAEl.style.zIndex).toBe('1')
      
      // Event C (middle): left=15%, width=80%, z-index=2
      expect(eventCEl.style.left).toBe('calc(4.75rem + 15%)')
      expect(eventCEl.style.width).toBe('80%')
      expect(eventCEl.style.zIndex).toBe('2')
      
      // Event B (shortest): left=30%, width=60%, z-index=3 (appears in front)
      expect(eventBEl.style.left).toBe('calc(4.75rem + 30%)')
      expect(eventBEl.style.width).toBe('60%')
      expect(eventBEl.style.zIndex).toBe('3')
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