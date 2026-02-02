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
  events: EventType[],
  direction: "down" | "up" = "down"
): EventType | null {

  const duration = SLOT_HEIGHT
  const hourStart = Math.floor(clickY / SLOT_HEIGHT) * SLOT_HEIGHT
  const hourEnd = hourStart + SLOT_HEIGHT

  // 1️⃣ Check if that 1-hour block has events
  const hourHasOverlap = events.some(ev => {
    const evTop = ev.slot
    const evBottom = ev.slot + ev.height
    return !(hourEnd <= evTop || hourStart >= evBottom)
  })

  let startY = hourStart

  // 2️⃣ If hour has events → use gap logic
  if (hourHasOverlap) {
    const snappedClick = Math.round(clickY / STEP_HEIGHT) * STEP_HEIGHT
    const sorted = [...events].sort((a, b) => a.slot - b.slot)

    if (direction === "down") {
      // Place **below the click**
      let previousEnd = hourStart
      for (const ev of sorted) {
        const evEnd = ev.slot + ev.height
        if (evEnd <= snappedClick) previousEnd = Math.max(previousEnd, evEnd)
      }
      startY = previousEnd
    } else {
      // Place **above the click**
      let nextEventStart = 24 * SLOT_HEIGHT
      for (const ev of sorted) {
        if (ev.slot >= snappedClick) nextEventStart = Math.min(nextEventStart, ev.slot)
      }
      startY = Math.max(hourStart, nextEventStart - duration)
    }
  }

  // 3️⃣ Bounds
  if (startY < 0 || startY + duration > 24 * SLOT_HEIGHT) return null

  // 4️⃣ Convert slot to time
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
  deltaY: number,
  events: EventType[]
): EventType {
  const snappedY = Math.max(0, Math.round(deltaY / STEP_HEIGHT) * STEP_HEIGHT);
  const newTop = snappedY;
  const newBottom = snappedY + event.height;

  const SHRINK_PERCENT = 0.8;

  // Find overlapping events
  const overlappingEvents = events.filter(ev => {
    if (ev.id === event.id) return false;
    const evTop = ev.slot;
    const evBottom = ev.slot + ev.height;
    return !(newBottom <= evTop || newTop >= evBottom);
  });

  // ✅ Reset all events to original full width first
  events.forEach(ev => {
    const el = document.getElementById(ev.id) as HTMLDivElement | null;
    if (!el) return;

    el.style.transform = "none";   // remove scale
    el.style.left = el.style.left || `${el.offsetLeft}px`; // preserve left
  });

  // ✅ Shrink later-starting events if overlapping
  overlappingEvents.forEach(ev => {
    const movingEl = document.getElementById(event.id) as HTMLDivElement | null;
    const otherEl = document.getElementById(ev.id) as HTMLDivElement | null;
    if (!movingEl || !otherEl) return;

    const eventStart = event.startHour * 60 + event.startMin;
    const evStart = ev.startHour * 60 + ev.startMin;

    let elToShrink: HTMLDivElement | null = null;
    if (eventStart > evStart) elToShrink = movingEl;
    else if (eventStart < evStart) elToShrink = otherEl;

    if (elToShrink) {
      elToShrink.style.transformOrigin = "right"; // shrink toward left, right edge stays
      elToShrink.style.transform = `scaleX(${SHRINK_PERCENT})`;
    }
  });

  // Return updated event with new slot and times
  return {
    ...event,
    slot: snappedY,
    startHour: Math.floor(snappedY / STEP_HEIGHT / 4) % 24,
    startMin: (Math.round(snappedY / STEP_HEIGHT) * 15) % 60,
    endHour: Math.floor((snappedY + event.height) / STEP_HEIGHT / 4) % 24,
    endMin: (Math.round((snappedY + event.height) / STEP_HEIGHT) * 15) % 60,
  };
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

