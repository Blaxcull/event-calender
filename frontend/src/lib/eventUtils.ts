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

  // 0️⃣ Check if click is directly on an existing event
  const clickedEvent = events.find(ev => {
    const evTop = ev.slot
    const evBottom = ev.slot + ev.height
    return clickY >= evTop && clickY < evBottom
  })
  
  if (clickedEvent) {
    console.log(`Event clicked with id: ${clickedEvent.id}`)
    return null
  }

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

  // 🔍 Find events overlapping with the NEW position of the moving event
  const overlappingEvents = events.filter(ev => {
    if (ev.id === event.id) return false;

    const evTop = ev.slot;
    const evBottom = ev.slot + ev.height;

    return !(newBottom <= evTop || newTop >= evBottom);
  });

  // 🎯 Get the moving element
  const movingEl = document.getElementById(event.id) as HTMLDivElement | null;
  if (!movingEl) {
    return { ...event, slot: snappedY };
  }

  // 1️⃣ Dragged event ALWAYS 100% width and on top
  movingEl.style.transform = "none";
  movingEl.style.transformOrigin = "center";
  movingEl.style.setProperty("--event-scale", "1");
  movingEl.style.zIndex = "9999";

  // 2️⃣ Handle OTHER overlapping events - maintain their current widths
  for (const ev of overlappingEvents) {
    const otherEl = document.getElementById(ev.id) as HTMLDivElement | null;
    if (!otherEl) continue;

    // Keep other events' current transform (width)
    // Only ensure they're below the dragged event
    otherEl.style.zIndex = "1";
  }

  // 🕒 Recalculate time from vertical position
  return {
    ...event,
    slot: snappedY,
    startHour: Math.floor(snappedY / STEP_HEIGHT / 4) % 24,
    startMin: (Math.round(snappedY / STEP_HEIGHT) * 15) % 60,
    endHour: Math.floor((snappedY + event.height) / STEP_HEIGHT / 4) % 24,
    endMin: (Math.round((snappedY + event.height) / STEP_HEIGHT) * 15) % 60,
  };
}

/* ===== Restore event widths after drag ===== */
export function restoreEventWidths(events: EventType[]): void {
  // Reset all events to normal width and z-index
  events.forEach(ev => {
    const el = document.getElementById(ev.id) as HTMLDivElement | null;
    if (!el) return;
    
    el.style.transform = "none";
    el.style.transformOrigin = "center";
    el.style.removeProperty("--event-scale");
    el.style.zIndex = "auto";
  });
  
  // Now calculate proper widths for overlapping events
  const sortedEvents = [...events].sort((a, b) => a.slot - b.slot);
  
  // Group overlapping events
  const overlappingGroups: EventType[][] = [];
  let currentGroup: EventType[] = [];
  let currentBottom = -1;
  
  for (const ev of sortedEvents) {
    const evTop = ev.slot;
    const evBottom = ev.slot + ev.height;
    
    if (evTop < currentBottom) {
      // Overlaps with current group
      currentGroup.push(ev);
      currentBottom = Math.max(currentBottom, evBottom);
    } else {
      // Start new group
      if (currentGroup.length > 0) {
        overlappingGroups.push([...currentGroup]);
      }
      currentGroup = [ev];
      currentBottom = evBottom;
    }
  }
  
  if (currentGroup.length > 0) {
    overlappingGroups.push(currentGroup);
  }
  
  // Apply width distribution for overlapping groups
  overlappingGroups.forEach(group => {
    // Sort by start time (slot) - earliest first
    const sortedGroup = [...group].sort((a, b) => a.slot - b.slot);
    
    if (sortedGroup.length === 1) {
      // Single event - full width
      const el = document.getElementById(sortedGroup[0].id) as HTMLDivElement | null;
      if (el) {
        el.style.transform = "none";
        el.style.transformOrigin = "center";
        el.style.setProperty("--event-scale", "1");
        el.style.zIndex = "1"; // Full width events behind
      }
    } else if (sortedGroup.length === 2) {
      // 2 overlapping events: first = 100%, second = 50%
      const [first, second] = sortedGroup;
      const firstEl = document.getElementById(first.id) as HTMLDivElement | null;
      const secondEl = document.getElementById(second.id) as HTMLDivElement | null;
      
      if (firstEl) {
        firstEl.style.transform = "none";
        firstEl.style.transformOrigin = "center";
        firstEl.style.setProperty("--event-scale", "1");
        firstEl.style.zIndex = "1"; // Behind
      }
      if (secondEl) {
        secondEl.style.transformOrigin = "right";
        secondEl.style.transform = "scaleX(0.5)";
        secondEl.style.setProperty("--event-scale", "0.5");
        secondEl.style.zIndex = "2"; // In front
      }
    } else {
      // 3+ overlapping events
      // Check if this is a case where middle event overlaps with first and last
      // but first and last don't overlap each other
      const firstEvent = sortedGroup[0];
      const lastEvent = sortedGroup[sortedGroup.length - 1];
      const firstEnd = firstEvent.slot + firstEvent.height;
      const lastStart = lastEvent.slot;
      
      // If first and last events don't overlap, they should both be full width
      if (firstEnd <= lastStart) {
        // First and last don't overlap - they get full width
        // Middle events get 50% width
         sortedGroup.forEach((ev, index) => {
          const el = document.getElementById(ev.id) as HTMLDivElement | null;
          if (!el) return;
          
          if (index === 0 || index === sortedGroup.length - 1) {
            // First and last events: 100% width
            el.style.transform = "none";
            el.style.transformOrigin = "center";
            el.style.setProperty("--event-scale", "1");
            el.style.zIndex = `${index + 1}`;
          } else {
            // Middle events: 50% width
            el.style.transformOrigin = "right";
            el.style.transform = "scaleX(0.5)";
            el.style.setProperty("--event-scale", "0.5");
            el.style.zIndex = `${index + 2}`;
          }
        });
      } else {
        // All events overlap with each other - use decreasing percentages
         sortedGroup.forEach((ev, index) => {
          const el = document.getElementById(ev.id) as HTMLDivElement | null;
          if (!el) return;
          
          if (index === 0) {
            // First event: 100% width
            el.style.transform = "none";
            el.style.transformOrigin = "center";
            el.style.setProperty("--event-scale", "1");
            el.style.zIndex = "1"; // Behind
          } else {
            // Calculate percentage: (100% / count) * (count - index)
            const percent = (1.0 / sortedGroup.length) * (sortedGroup.length - index);
            el.style.transformOrigin = "right";
            el.style.transform = `scaleX(${percent})`;
            el.style.setProperty("--event-scale", percent.toString());
            el.style.zIndex = `${index + 2}`; // Higher index = more in front
          }
        });
      }
    }
  });
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

