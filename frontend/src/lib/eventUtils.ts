import type { Event } from '@/store/eventsStore'

/* ================= CONSTANTS ================= */

export const SLOT_HEIGHT = 100
export const STEP_HEIGHT = SLOT_HEIGHT / 4
export const TOP_DEAD_ZONE = 48
export const MIN_EVENT_HEIGHT = STEP_HEIGHT
export const MIN_15_MIN_HEIGHT = (15 / 60) * SLOT_HEIGHT  // 25px = 15 minutes

// Extended event type for UI
export interface EventType {
  id: string
  slot: number  // Y position in pixels
  startHour: number
  startMin: number
  endHour: number
  endMin: number
  height: number  // Height in pixels
  title: string
  date: Date
  endDate: Date
  description?: string
  notes?: string
  urls?: string[]
  color?: string
  isAllDay?: boolean
  location?: string
  series_id?: string
  isRecurringInstance?: boolean
  seriesMasterId?: string
  occurrenceDate?: string
  repeat?: string
}

export interface EventPosition {
  left: string
  width: string
  zIndex: number
}

export interface EventPositions {
  [eventId: string]: EventPosition
}

/* ================= INTERACTION LOCK ================= */

let interactionLocked = false

export function lockInteraction() {
  interactionLocked = true
}

export function unlockInteraction() {
  interactionLocked = false
}

export function isInteractionLocked(): boolean {
  return interactionLocked
}

export function resetInteractionLock(): void {
  interactionLocked = false
}

/* ================= HELPERS ================= */

export function snap(y: number) {
  return Math.round(y / STEP_HEIGHT) * STEP_HEIGHT
}

export function yToTime(y: number) {
  const totalMinutes = (y / SLOT_HEIGHT) * 60
  return {
    hour: Math.floor(totalMinutes / 60) % 24,
    min: Math.round(totalMinutes % 60),
  }
}

export function yToTimeSnapped(y: number) {
  const totalMinutes = (y / SLOT_HEIGHT) * 60
  const snappedMinutes = Math.round(totalMinutes / 15) * 15
  return {
    hour: Math.floor(snappedMinutes / 60) % 24,
    min: snappedMinutes % 60,
  }
}

// Convert minutes-since-midnight to Y position
export function timeToY(minutes: number): number {
  return (minutes / 60) * SLOT_HEIGHT
}

// Convert store event to UI event
export function storeEventToUIEvent(storeEvent: Event, selectedDate: Date): EventType {
  const startY = timeToY(storeEvent.start_time)
  const endY = timeToY(storeEvent.end_time)
  const startTime = yToTime(startY)
  const endTime = yToTime(endY)

  // Determine if event should display as all-day sticky
  const storeEndDate = storeEvent.end_date || storeEvent.date
  const isMultiDay = storeEndDate > storeEvent.date
  
  // Calculate duration in hours (handles overnight events)
  let durationMinutes: number
  if (storeEvent.end_time >= storeEvent.start_time) {
    durationMinutes = storeEvent.end_time - storeEvent.start_time
  } else {
    // Overnight event (e.g., 23:00 to 02:00)
    durationMinutes = (1440 - storeEvent.start_time) + storeEvent.end_time
  }
  const durationHours = durationMinutes / 60
  const isFullDay = durationHours >= 24

  const isAllDay = storeEvent.is_all_day || isMultiDay || isFullDay

  // Parse end_date for the UI event
  const endDate = storeEndDate ? new Date(storeEndDate + 'T00:00:00') : selectedDate

  return {
    id: storeEvent.id,
    slot: startY,
    startHour: startTime.hour,
    startMin: startTime.min,
    endHour: endTime.hour,
    endMin: endTime.min,
    height: Math.max(endY - startY, MIN_15_MIN_HEIGHT),
    title: storeEvent.title,
    date: selectedDate,
    endDate: endDate,
    description: storeEvent.description,
    notes: storeEvent.notes,
    urls: storeEvent.urls || [],
    color: storeEvent.color,
    isAllDay,
    location: storeEvent.location,
    repeat: storeEvent.repeat,
    isRecurringInstance: (storeEvent as any).isRecurringInstance,
    seriesMasterId: (storeEvent as any).seriesMasterId,
    occurrenceDate: (storeEvent as any).occurrenceDate,
  }
}

// Convert UI event to store event format
export function uiEventToStoreEvent(uiEvent: EventType, dateStr: string): Partial<Event> {
  const startTotalMinutes = uiEvent.startHour * 60 + uiEvent.startMin
  const endTotalMinutes = uiEvent.endHour * 60 + uiEvent.endMin

  // Format end_date as YYYY-MM-DD
  const endDateStr = uiEvent.endDate 
    ? `${uiEvent.endDate.getFullYear()}-${String(uiEvent.endDate.getMonth() + 1).padStart(2, '0')}-${String(uiEvent.endDate.getDate()).padStart(2, '0')}`
    : dateStr

  const result: Partial<Event> = {
    title: uiEvent.title,
    description: uiEvent.description,
    notes: uiEvent.notes,
    urls: uiEvent.urls,
    date: dateStr,
    end_date: endDateStr,
    start_time: startTotalMinutes,
    end_time: endTotalMinutes,
    color: uiEvent.color,
    is_all_day: uiEvent.isAllDay,
    location: uiEvent.location,
    // Include the UI event ID for optimistic updates
    ...(uiEvent.id && { id: uiEvent.id }),
  }

  return result
}

function overlaps(aTop: number, aBottom: number, bTop: number, bBottom: number) {
  return aTop < bBottom && bTop < aBottom
}

/* ================= CREATE ================= */

export function addEventOnClick(
  clickY: number,
  events: EventType[],
  selectedDate: Date,
  direction: "down" | "up" = "down"
): EventType | null {

  if (interactionLocked) return null

  const duration = SLOT_HEIGHT
  const hourStart = Math.floor(clickY / SLOT_HEIGHT) * SLOT_HEIGHT
  const hourEnd = hourStart + SLOT_HEIGHT

  let startY = hourStart
  const snappedClick = snap(clickY)

  const hourEvents = events.filter(ev =>
    overlaps(hourStart, hourEnd, ev.slot, ev.slot + ev.height)
  )

  if (hourEvents.length) {
    if (direction === "down") {
      let previousEnd = hourStart
      for (const ev of hourEvents) {
        const evEnd = ev.slot + ev.height
        if (evEnd <= snappedClick)
          previousEnd = Math.max(previousEnd, evEnd)
      }
      startY = previousEnd
    } else {
      let nextStart = hourEnd
      for (const ev of hourEvents) {
        if (ev.slot >= snappedClick)
          nextStart = Math.min(nextStart, ev.slot)
      }
      startY = Math.max(hourStart, nextStart - duration)
    }
  }

  const DAY_HEIGHT = 24 * SLOT_HEIGHT
  if (startY < 0 || startY + duration > DAY_HEIGHT)
    return null

  const start = yToTimeSnapped(startY)
  const end = yToTimeSnapped(startY + duration)

  return {
    id: Math.random().toString(36).slice(2, 11),
    slot: startY,
    height: duration,
    startHour: start.hour,
    startMin: start.min,
    endHour: end.hour,
    endMin: end.min,
    title: "New Event",
    date: selectedDate,
    endDate: selectedDate,
    notes: "",
    urls: [],
  }
}

/* ================= DRAG ================= */

export function dragEvent(event: EventType, deltaY: number): EventType {
  lockInteraction()

  const snappedY = Math.max(0, snap(deltaY))

  const el = document.getElementById(event.id) as HTMLDivElement | null
  if (el) {
    el.style.zIndex = "9999"
    el.style.boxShadow = "0 10px 25px rgba(0,0,0,0.5)"
    el.style.transition = "box-shadow 100ms ease"
  }

  const start = yToTimeSnapped(snappedY)
  const end = yToTimeSnapped(snappedY + event.height)

  return {
    ...event,
    slot: snappedY,
    startHour: start.hour,
    startMin: start.min,
    endHour: end.hour,
    endMin: end.min,
  }
}

/* ================= RESIZE ================= */

export function resizeEvent(event: EventType, deltaY: number): EventType {
  lockInteraction()

  const newHeight = Math.max(STEP_HEIGHT, snap(deltaY))

  const el = document.getElementById(event.id) as HTMLDivElement | null
  if (el) {
    el.style.zIndex = "9999"
    el.style.boxShadow = "0 10px 25px rgba(0,0,0,0.5)"
    el.style.transition = "box-shadow 10ms ease"
  }

  const end = yToTime(event.slot + newHeight)

  return {
    ...event,
    height: newHeight,
    endHour: end.hour,
    endMin: end.min,
  }
}

/* ================= LAYOUT ENGINE ================= */

interface InternalPositionedEvent extends EventType {
  col: number
  colSpan: number
}

function buildClusters(events: EventType[]): EventType[][] {
  const sorted = [...events].sort((a, b) => {
    if (a.slot !== b.slot) return a.slot - b.slot
    return b.height - a.height
  })

  const clusters: EventType[][] = []

  let cluster: EventType[] = []
  let bottom = -1

  for (const ev of sorted) {
    const top = ev.slot
    const btm = ev.slot + ev.height

    if (cluster.length && top < bottom) {
      cluster.push(ev)
      bottom = Math.max(bottom, btm)
    } else {
      if (cluster.length) clusters.push(cluster)
      cluster = [ev]
      bottom = btm
    }
  }

  if (cluster.length) clusters.push(cluster)
  return clusters
}

function assignColumns(events: EventType[]): InternalPositionedEvent[] {
  const sorted = [...events].sort((a, b) => a.slot - b.slot)

  const colEnd: number[] = []
  const result: InternalPositionedEvent[] = []

  for (const ev of sorted) {
    let col = 0

    while (col < colEnd.length && colEnd[col] > ev.slot) {
      col++
    }

    if (col === colEnd.length) {
      colEnd.push(ev.slot + ev.height)
    } else {
      colEnd[col] = ev.slot + ev.height
    }

    result.push({ ...ev, col, colSpan: 1 })
  }

  return result
}

function expandSpans(events: InternalPositionedEvent[]) {
  const byCol: Record<number, InternalPositionedEvent[]> = {}

  for (const ev of events) {
    if (!byCol[ev.col]) byCol[ev.col] = []
    byCol[ev.col].push(ev)
  }

  const maxCol = Math.max(...events.map(e => e.col)) + 1

  for (const ev of events) {
    let span = 1

    for (let c = ev.col + 1; c < maxCol; c++) {
      const collision = byCol[c]?.some(other =>
        overlaps(ev.slot, ev.slot + ev.height, other.slot, other.slot + other.height)
      )

      if (collision) break
      span++
    }

    ev.colSpan = span
  }
}

export function calculateEventPositions(events: EventType[], selectedEventId: string | null = null): EventPositions {
  const positions: EventPositions = {}
  
  if (events.length === 0) return positions
  
  const layoutEvents = selectedEventId
    ? events.filter(e => e.id !== selectedEventId)
    : events

  const clusters = buildClusters(layoutEvents)

  for (const cluster of clusters) {
    const positioned = assignColumns(cluster)
    expandSpans(positioned)

    const maxCol = Math.max(...positioned.map(e => e.col + e.colSpan))

    for (const ev of positioned) {
      const leftPercent = (ev.col / maxCol) * 100
      const widthPercent = (ev.colSpan / maxCol) * 100

      const left = leftPercent === 0 ? "0" : `${leftPercent}%`
      const width = widthPercent === 100 ? "100%" : `${widthPercent}%`
      
      positions[ev.id] = {
        left,
        width,
        zIndex: 2
      }
    }
  }

  if (selectedEventId) {
    const selected = events.find(e => e.id === selectedEventId)
    if (selected) {
      positions[selectedEventId] = {
        left: "0",
        width: "100%",
        zIndex: 20
      }
    }
  }
  
  return positions
}

export function restoreEventWidths(events: EventType[], animate: boolean = true, skipEventId: string | null = null, selectedEventId: string | null = null) {
  const layoutEvents = selectedEventId
    ? events.filter(e => e.id !== selectedEventId)
    : events

  const clusters = buildClusters(layoutEvents)

  for (const cluster of clusters) {
    const positioned = assignColumns(cluster)
    expandSpans(positioned)

    const maxCol = Math.max(...positioned.map(e => e.col + e.colSpan))

    for (const ev of positioned) {
      const el = document.getElementById(ev.id) as HTMLDivElement | null
      if (!el) continue

      el.style.zIndex = ""
      el.style.boxShadow = ""
      
      if (animate && ev.id !== skipEventId) {
        el.style.transition = "left 200ms ease, width 200ms ease"
      }

      const leftPercent = (ev.col / maxCol) * 100
      const widthPercent = (ev.colSpan / maxCol) * 100

      const newLeft = leftPercent === 0 ? "0" : `${leftPercent}%`
      const newWidth = widthPercent === 100 ? "100%" : `${widthPercent}%`
      
      el.style.left = newLeft
      el.style.width = newWidth
      el.style.zIndex = "2"
    }
  }

  if (selectedEventId) {
    const el = document.getElementById(selectedEventId) as HTMLDivElement | null
    if (el) {
      if (animate) {
        el.style.transition = "none"
        void el.offsetHeight
      }
      el.style.left = "0"
      el.style.width = "100%"
      el.style.zIndex = "20"
      if (animate) {
        el.style.transition = "left 200ms ease, width 200ms ease"
      }
    }
  }
}

export function calculateEventDuration(event: EventType): number {
  const startTotal = event.startHour * 60 + event.startMin
  const endTotal = event.endHour * 60 + event.endMin
  
  if (endTotal < startTotal) {
    return (endTotal + 24 * 60) - startTotal
  }
  
  return endTotal - startTotal
}

export function applyPositionsToDOM(positions: EventPositions, animate: boolean = true) {
  requestAnimationFrame(() => {
    for (const id in positions) {
      const el = document.getElementById(id)
      if (!el) continue

      const { left, width, zIndex } = positions[id]

      if (animate) {
        el.style.transition = "left 200ms ease, width 200ms ease"
      }

      el.style.left = left
      el.style.width = width
      el.style.zIndex = String(zIndex)
    }
  })
}
