// eventUtils.ts

export const SLOT_HEIGHT = 86          // 1 hour
export const STEP_HEIGHT = SLOT_HEIGHT / 4 // 15 min
export const TOP_DEAD_ZONE = 43
export const MIN_EVENT_HEIGHT = STEP_HEIGHT

// ✅ Export type using export
export interface EventType {
  id: string
  slot: number
  startHour: number
  startMin: number
  endHour: number
  endMin: number
  height: number
  title: string
}

/* ===== Smart click-to-create ===== */
export function addEventOnClick(
  clickY: number,
  events: EventType[]
): EventType | null {

  const duration = SLOT_HEIGHT
  const hourStart = Math.floor(clickY / SLOT_HEIGHT) * SLOT_HEIGHT
  const hourEnd = hourStart + SLOT_HEIGHT

  // 1️⃣ Check if that 1-hour block is clean
  const hourHasOverlap = events.some(ev => {
    const evTop = ev.slot
    const evBottom = ev.slot + ev.height
    return !(hourEnd <= evTop || hourStart >= evBottom)
  })

  let startY = hourStart

  // 2️⃣ If hour is dirty → use gap logic
  if (hourHasOverlap) {
    const snappedClick = Math.round(clickY / STEP_HEIGHT) * STEP_HEIGHT

    const sorted = [...events].sort((a, b) => a.slot - b.slot)

    let previousEnd = 0
    for (const ev of sorted) {
      const evEnd = ev.slot + ev.height
      if (evEnd <= snappedClick) previousEnd = Math.max(previousEnd, evEnd)
    }

    startY = previousEnd
  }

  // 3️⃣ Bounds
  if (startY + duration > 24 * SLOT_HEIGHT) return null

  const totalMinutes = (startY / STEP_HEIGHT) * 15
  const startHour = Math.floor(totalMinutes / 60) % 24
  const startMin = totalMinutes % 60
  const endMinutes = totalMinutes + 60
  const endHour = Math.floor(endMinutes / 60) % 24
  const endMin = endMinutes % 60

  return {
    id: Math.random().toString(36).slice(2, 11),
    slot: startY,
    startHour,
    startMin,
    endHour,
    endMin,
    height: duration,
    title: "New Event",
  }
}

/* ===== Drag event ===== */
export function dragEvent(
  event: EventType,
  deltaY: number
): EventType {
  const snappedY = Math.max(0, Math.round(deltaY / STEP_HEIGHT) * STEP_HEIGHT)
  return {
    ...event,
    slot: snappedY,
    startHour: Math.floor(snappedY / STEP_HEIGHT / 4) % 24,
    startMin: Math.round(snappedY / STEP_HEIGHT) * 15 % 60,
    endHour: Math.floor((snappedY + event.height) / STEP_HEIGHT / 4) % 24,
    endMin: Math.round((snappedY + event.height) / STEP_HEIGHT) * 15 % 60,
  }
}

/* ===== Resize event ===== */
export function resizeEvent(
  event: EventType,
  deltaY: number
): EventType {
  const newHeight = Math.max(MIN_EVENT_HEIGHT, Math.round(deltaY / STEP_HEIGHT) * STEP_HEIGHT)
  return {
    ...event,
    height: newHeight,
    endHour: Math.floor((event.slot + newHeight) / STEP_HEIGHT / 4) % 24,
    endMin: Math.round((event.slot + newHeight) / STEP_HEIGHT) * 15 % 60,
  }
}

