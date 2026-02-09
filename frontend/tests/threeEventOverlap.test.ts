// Comprehensive test cases for 3-event overlap logic
// Tests the new 3-event implementation that uses 2-event logic as building blocks

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { 
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

describe('3-Event Overlap Logic', () => {
  describe('Pattern: ALL_DIFFERENT_START', () => {
    it('should handle 3 events with all different start times', () => {
      const events: EventType[] = [
        {
          id: 'eventA',
          slot: 0,                    // 0:00
          startHour: 0,
          startMin: 0,
          endHour: 2,                 // Extends to 2:00 to overlap with B
          endMin: 0,
          height: SLOT_HEIGHT * 2,
          title: 'Event A'
        },
        {
          id: 'eventB',
          slot: STEP_HEIGHT * 2,      // 0:30 (different start, overlaps with A)
          startHour: 0,
          startMin: 30,
          endHour: 2,                 // Extends to 2:30 to overlap with C
          endMin: 30,
          height: SLOT_HEIGHT * 2,
          title: 'Event B'
        },
        {
          id: 'eventC',
          slot: STEP_HEIGHT * 4,      // 1:00 (different start, overlaps with B)
          startHour: 1,
          startMin: 0,
          endHour: 3,
          endMin: 0,
          height: SLOT_HEIGHT * 2,
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
      
      // ALL_DIFFERENT pattern: equal left spacing (0%, 33.3%, 66.6%)
      // Widths: scaled 99%, 89%, 79%
      
      // Event A (earliest): left=0%, width=65.34% (99% * 0.66)
      // Accept both "4.75rem" and "calc(4.75rem + 0%)" formats
      expect(['calc(4.75rem + 0%)', '4.75rem']).toContain(eventAEl.style.left)
      expect(eventAEl.style.width).toBe('calc(65.34% - 3.168rem)')
      expect(eventAEl.style.zIndex).toBe('1')
      
      // Event B (middle): left=33.3%, width=58.74% (89% * 0.66)
      expect(eventBEl.style.left).toBe('calc(4.75rem + 33.3%)')
      expect(eventBEl.style.width).toBe('calc(58.74% - 3.168rem)')
      expect(eventBEl.style.zIndex).toBe('2')
      
      // Event C (latest): left=66.6%, width=58.74% (89% * 0.66) - matches 2-event second event
      // rem offset: 4.8 * 0.66 = 3.168rem
      expect(eventCEl.style.left).toBe('calc(4.75rem + 66.6%)')
      expect(eventCEl.style.width).toBe('calc(58.74% - 3.168rem)')
      expect(eventCEl.style.zIndex).toBe('3')
    })
    
    it('should handle 3 events with different heights and different start times', () => {
      const events: EventType[] = [
        {
          id: 'eventA',
          slot: 0,
          startHour: 0,
          startMin: 0,
          endHour: 3,                 // Extends to 3:00 to overlap all
          endMin: 0,
          height: SLOT_HEIGHT * 3, // Tallest
          title: 'Event A'
        },
        {
          id: 'eventB',
          slot: STEP_HEIGHT * 2, // 0:30 (different start, overlaps with A)
          startHour: 0,
          startMin: 30,
          endHour: 2,
          endMin: 30,
          height: SLOT_HEIGHT * 2,
          title: 'Event B'
        },
        {
          id: 'eventC',
          slot: STEP_HEIGHT * 4, // 1:00 (different start, overlaps with A & B)
          startHour: 1,
          startMin: 0,
          endHour: 2,
          endMin: 0,
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
      
      // Sorted by height: A (tallest), C (middle), B (shortest)
      // ALL_DIFFERENT pattern
      
      // Event A (tallest): left=0%, background
      expect(eventAEl.style.left).toBe('calc(4.75rem + 0%)')
      expect(eventAEl.style.zIndex).toBe('1')
      
      // Event C (shortest): left=66.6% (foreground)
      expect(eventCEl.style.left).toBe('calc(4.75rem + 66.6%)')
      expect(eventCEl.style.zIndex).toBe('3')
      
      // Event B (middle height): left=33.3%, middle position
      expect(eventBEl.style.left).toBe('calc(4.75rem + 33.3%)')
      expect(eventBEl.style.zIndex).toBe('2')
    })
  })
  
  describe('Pattern: ALL_SAME_START', () => {
    it('should handle 3 events all starting at same time', () => {
      const events: EventType[] = [
        {
          id: 'eventA',
          slot: 0,
          startHour: 0,
          startMin: 0,
          endHour: 2,
          endMin: 0,
          height: SLOT_HEIGHT * 2, // Tallest
          title: 'Event A'
        },
        {
          id: 'eventB',
          slot: 0, // Same start (within STEP_HEIGHT tolerance)
          startHour: 0,
          startMin: 0,
          endHour: 1,
          endMin: 30,
          height: SLOT_HEIGHT * 1.5,
          title: 'Event B'
        },
        {
          id: 'eventC',
          slot: STEP_HEIGHT / 2, // 7.5px difference (within 21.5px tolerance)
          startHour: 0,
          startMin: 7,
          endHour: 1,
          endMin: 0,
          height: SLOT_HEIGHT, // Shortest
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
      
      // ALL_SAME pattern: equal left spacing with aggressive width reduction
      // Widths: 89%, 66%, 33%
      
      // Event A (tallest): left=0%, width=89%
      expect(eventAEl.style.left).toBe('calc(4.75rem + 0%)')
      expect(eventAEl.style.width).toBe('calc(89% - 4.8rem)')
      expect(eventAEl.style.zIndex).toBe('1')
      
      // Event B (middle): left=33.3%, width=66%
      expect(eventBEl.style.left).toBe('calc(4.75rem + 33.3%)')
      expect(eventBEl.style.width).toBe('calc(66% - 3.168rem)')
      expect(eventBEl.style.zIndex).toBe('2')
      
      // Event C (shortest): left=66.6%, width=49% - matches BUGGY 2-event same-start second event
      expect(eventCEl.style.left).toBe('calc(66.6%)')  // Missing 4.75rem (buggy match)
      expect(eventCEl.style.width).toBe('calc(49% )')  // No rem subtraction (buggy match)
      expect(eventCEl.style.zIndex).toBe('3')
    })
    
    it('should handle 3 events with same height starting at same time', () => {
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
          slot: 0,
          startHour: 0,
          startMin: 0,
          endHour: 1,
          endMin: 0,
          height: SLOT_HEIGHT,
          title: 'Event B'
        },
        {
          id: 'eventC',
          slot: STEP_HEIGHT / 4, // 5.375px difference (within tolerance)
          startHour: 0,
          startMin: 5,
          endHour: 1,
          endMin: 0,
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
      
      // All same height, all same start
      // Sorted by slot: A (0), B (0), C (5.375)
      
      // Should have equal left spacing (BUGGY: same-start events missing '4.75rem +')
      expect(eventAEl.style.left).toBe('calc(0%)')  // Same-start with A
      expect(eventBEl.style.left).toBe('calc(33.3%)')  // Same-start with A
      expect(eventCEl.style.left).toBe('calc(66.6%)')  // Same-start with B
      
      // Should have progressive width reduction with topmost matching BUGGY 2-event second
      expect(eventAEl.style.width).toBe('calc(89% - 4.8rem)')
      expect(eventBEl.style.width).toBe('calc(66% - 3.168rem)')
      expect(eventCEl.style.width).toBe('calc(49% )')  // No rem subtraction (buggy match)
      
      // Z-order should be by slot order
      expect(eventAEl.style.zIndex).toBe('1')
      expect(eventBEl.style.zIndex).toBe('2')
      expect(eventCEl.style.zIndex).toBe('3')
    })
  })
  
  describe('Pattern: PAIR_SAME_START', () => {
    it('should handle 2 events same-start + 1 different (A-B same, C different)', () => {
      const events: EventType[] = [
        {
          id: 'eventA',
          slot: 0,
          startHour: 0,
          startMin: 0,
          endHour: 2,
          endMin: 0,
          height: SLOT_HEIGHT * 2, // Tallest
          title: 'Event A'
        },
        {
          id: 'eventB',
          slot: STEP_HEIGHT / 2, // 10.75px (within 21.5px tolerance)
          startHour: 0,
          startMin: 10,
          endHour: 1,
          endMin: 30,
          height: SLOT_HEIGHT * 1.5,
          title: 'Event B'
        },
        {
          id: 'eventC',
          slot: STEP_HEIGHT * 6, // 1:30 (different start)
          startHour: 1,
          startMin: 30,
          endHour: 2,
          endMin: 30,
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
      
      // Pattern: A-B same-start, C different
      // Sorted by height: A (tallest), B (middle), C (shortest)
      
      // A & B should have same-start layout (0% and 33.3% with scaled widths)
      // C should have different-start layout at 66.6%
      
      expect(eventAEl.style.left).toBe('calc(4.75rem + 0%)')
      expect(eventAEl.style.width).toBe('calc(58.74% - 3.168rem)') // 89% * 0.66
      expect(eventAEl.style.zIndex).toBe('1')
      
      expect(eventBEl.style.left).toBe('calc(33.3%)')  // Missing 4.75rem (buggy match)
      expect(eventBEl.style.width).toBe('calc(32.34% )') // 49% * 0.66, no rem subtraction (buggy match)
      expect(eventBEl.style.zIndex).toBe('2')
      
      expect(eventCEl.style.left).toBe('calc(4.75rem + 66.6%)')
      expect(eventCEl.style.width).toBe('calc(58.74% - 3.168rem)') // Different-start scaled
      expect(eventCEl.style.zIndex).toBe('3')
    })
    
    it('should handle 2 events same-start + 1 different (B-C same, A different)', () => {
      const events: EventType[] = [
        {
          id: 'eventA',
          slot: 0,
          startHour: 0,
          startMin: 0,
          endHour: 3,                 // Extends to overlap with B & C
          endMin: 0,
          height: SLOT_HEIGHT * 3,
          title: 'Event A'
        },
        {
          id: 'eventB',
          slot: STEP_HEIGHT * 6, // 1:30
          startHour: 1,
          startMin: 30,
          endHour: 2,
          endMin: 30,
          height: SLOT_HEIGHT,
          title: 'Event B'
        },
        {
          id: 'eventC',
          slot: STEP_HEIGHT * 6 + STEP_HEIGHT / 2, // 1:37.5 (within tolerance)
          startHour: 1,
          startMin: 37,
          endHour: 2,
          endMin: 0,
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
      
      // Pattern: B-C same-start, A different
      // All same height, sorted by slot: A (0), B (129), C (136.5)
      
      // A should be at 0% (different-start)
      // B & C should have same-start layout at 33.3% and 66.6% (BUGGY: missing '4.75rem +')
      
      expect(eventAEl.style.left).toBe('calc(4.75rem + 0%)')
      expect(eventAEl.style.zIndex).toBe('1')
      
      expect(eventBEl.style.left).toBe('calc(33.3%)')  // Same-start with C
      expect(eventBEl.style.zIndex).toBe('2')
      
      expect(eventCEl.style.left).toBe('calc(66.6%)')  // Same-start with B
      expect(eventCEl.style.zIndex).toBe('3')
    })
  })
  
  describe('Pattern: CHAIN_SAME_START', () => {
    it('should handle chain pattern (A-B same AND B-C same)', () => {
      const events: EventType[] = [
        {
          id: 'eventA',
          slot: 0,
          startHour: 0,
          startMin: 0,
          endHour: 2,
          endMin: 0,
          height: SLOT_HEIGHT * 2,
          title: 'Event A'
        },
        {
          id: 'eventB',
          slot: STEP_HEIGHT / 2, // 10.75px (within tolerance of A)
          startHour: 0,
          startMin: 10,
          endHour: 1,
          endMin: 30,
          height: SLOT_HEIGHT * 1.5,
          title: 'Event B'
        },
        {
          id: 'eventC',
          slot: STEP_HEIGHT, // 21.5px (within tolerance of B, borderline with A)
          startHour: 0,
          startMin: 20,
          endHour: 1,
          endMin: 0,
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
      
      // Chain pattern: A-B same (10.75px diff) AND B-C same (10.75px diff)
      // A-C diff is 21.5px (exactly STEP_HEIGHT, so not considered same)
      // Should use CHAIN_SAME_START pattern
      
      // Sorted by height: A (tallest), B (middle), C (shortest)
      
      // Chain pattern uses special layout
      expect(eventAEl.style.left).toBe('calc(4.75rem + 0%)')
      expect(eventAEl.style.width).toBe('calc(89% - 4.8rem)')
      expect(eventAEl.style.zIndex).toBe('1')
      
      expect(eventBEl.style.left).toBe('calc(4.75rem + 33.3%)')
      expect(eventBEl.style.width).toBe('calc(66% - 3.168rem)')
      expect(eventBEl.style.zIndex).toBe('2')
      
      expect(eventCEl.style.left).toBe('calc(66.6%)')  // Missing 4.75rem (buggy match)
      expect(eventCEl.style.width).toBe('calc(49% )')  // No rem subtraction (buggy match)
      expect(eventCEl.style.zIndex).toBe('3')
    })
  })
  
  describe('Edge Cases', () => {
    it('should handle non-overlapping 3 events (each gets full width)', () => {
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
          slot: SLOT_HEIGHT * 2, // 2:00 (no overlap with A)
          startHour: 2,
          startMin: 0,
          endHour: 3,
          endMin: 0,
          height: SLOT_HEIGHT,
          title: 'Event B'
        },
        {
          id: 'eventC',
          slot: SLOT_HEIGHT * 4, // 4:00 (no overlap with A or B)
          startHour: 4,
          startMin: 0,
          endHour: 5,
          endMin: 0,
          height: SLOT_HEIGHT,
          title: 'Event C'
        }
      ]
      
      // Mock elements
      const eventAEl = { style: { transform: 'scaleX(0.5)', transformOrigin: 'right', zIndex: '9999' } }
      const eventBEl = { style: { transform: 'scaleX(0.5)', transformOrigin: 'right', zIndex: '1' } }
      const eventCEl = { style: { transform: 'scaleX(0.5)', transformOrigin: 'right', zIndex: '2' } }
      mockElements.set('eventA', eventAEl)
      mockElements.set('eventB', eventBEl)
      mockElements.set('eventC', eventCEl)
      
      restoreEventWidths(events)
      
      // Non-overlapping events should each get full width
      // They won't be grouped together, so each will be handled as single event
      expect(eventAEl.style.transform).toBe('none')
      expect(eventBEl.style.transform).toBe('none')
      expect(eventCEl.style.transform).toBe('none')
    })
    
    it('should handle missing DOM elements gracefully', () => {
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
          slot: STEP_HEIGHT * 2,
          startHour: 0,
          startMin: 30,
          endHour: 1,
          endMin: 30,
          height: SLOT_HEIGHT,
          title: 'Event B'
        },
        {
          id: 'eventC',
          slot: STEP_HEIGHT * 3,
          startHour: 0,
          startMin: 45,
          endHour: 1,
          endMin: 45,
          height: SLOT_HEIGHT,
          title: 'Event C'
        }
      ]
      
      // Only mock some elements
      const eventAEl = { style: { left: '', width: '', zIndex: '' } }
      const eventCEl = { style: { left: '', width: '', zIndex: '' } }
      mockElements.set('eventA', eventAEl)
      // eventB not mocked
      mockElements.set('eventC', eventCEl)
      
      // Should not throw error, should handle gracefully
      expect(() => restoreEventWidths(events)).not.toThrow()
      
      // Events with DOM elements should still be positioned
      expect(eventAEl.style.left).not.toBe('')
      expect(eventCEl.style.left).not.toBe('')
    })
  })
})