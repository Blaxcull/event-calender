export const SLOT_HEIGHT = 86
export const STEP_HEIGHT = SLOT_HEIGHT / 4
export const TOP_DEAD_ZONE = 43
export const MIN_EVENT_HEIGHT = STEP_HEIGHT

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

/* ================= HELPERS ================= */

const DAY_HEIGHT = 24 * SLOT_HEIGHT

function snap(y: number) {
  return Math.round(y / STEP_HEIGHT) * STEP_HEIGHT
}

function yToTime(y: number) {
  const totalMinutes = (y / STEP_HEIGHT) * 15
  return {
    hour: Math.floor(totalMinutes / 60) % 24,
    min: totalMinutes % 60,
  }
}

function overlaps(aTop: number, aBottom: number, bTop: number, bBottom: number) {
  return aTop < bBottom && bTop < aBottom
}

/* ================= CREATE ================= */

export function addEventOnClick(
  clickY: number,
  events: EventType[],
  direction: "down" | "up" = "down"
): EventType | null {
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
        if (evEnd <= snappedClick) previousEnd = Math.max(previousEnd, evEnd)
      }
      startY = previousEnd
    } else {
      let nextStart = DAY_HEIGHT
      for (const ev of hourEvents) {
        if (ev.slot >= snappedClick) nextStart = Math.min(nextStart, ev.slot)
      }
      startY = Math.max(hourStart, nextStart - duration)
    }
  }

  if (startY < 0 || startY + duration > DAY_HEIGHT) return null

  const start = yToTime(startY)
  const end = yToTime(startY + duration)

  return {
    id: Math.random().toString(36).slice(2, 11),
    slot: startY,
    height: duration,
    startHour: start.hour,
    startMin: start.min,
    endHour: end.hour,
    endMin: end.min,
    title: "New Event",
  }
}

/* ================= DRAG ================= */
export function dragEvent(event: EventType, deltaY: number): EventType {
  const snappedY = Math.max(0, snap(deltaY))

  const el = document.getElementById(event.id) as HTMLDivElement | null
  if (el) {
    el.style.left = "4.75rem"
    el.style.width = "calc(100% - 4.75rem)"
    el.style.zIndex = "9999"
  }

  const start = yToTime(snappedY)
  const end = yToTime(snappedY + event.height)

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
  const newHeight = Math.max(MIN_EVENT_HEIGHT, snap(deltaY))
  const end = yToTime(event.slot + newHeight)

  return {
    ...event,
    height: newHeight,
    endHour: end.hour,
    endMin: end.min,
  }
}

/* ================= LAYOUT ENGINE ================= */

interface PositionedEvent extends EventType {
  col: number
  colSpan: number
}

function buildClusters(events: EventType[]): EventType[][] {
  const sorted = [...events].sort((a, b) => a.slot - b.slot)
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

function assignColumns(events: EventType[]): PositionedEvent[] {
  const columns: PositionedEvent[][] = []
  const positioned: PositionedEvent[] = []
  const sorted = [...events].sort((a, b) => a.slot - b.slot)

  for (const ev of sorted) {
    let placed = false

    for (let c = 0; c < columns.length; c++) {
      const last = columns[c][columns[c].length - 1]
      if (last.slot + last.height <= ev.slot) {
        const pe = { ...ev, col: c, colSpan: 1 }
        columns[c].push(pe)
        positioned.push(pe)
        placed = true
        break
      }
    }

    if (!placed) {
      const pe = { ...ev, col: columns.length, colSpan: 1 }
      columns.push([pe])
      positioned.push(pe)
    }
  }

  return positioned
}

function expandSpans(events: PositionedEvent[]) {
  const maxCol = Math.max(...events.map(e => e.col)) + 1

  for (const ev of events) {
    let span = 1
    for (let c = ev.col + 1; c < maxCol; c++) {
      const collision = events.some(other =>
        other.col === c &&
        overlaps(ev.slot, ev.slot + ev.height, other.slot, other.slot + other.height)
      )
      if (collision) break
      span++
    }
    ev.colSpan = span
  }
}

export function restoreEventWidths(events: EventType[], draggingId: string | null = null) {
  const elements: Record<string, HTMLDivElement> = {}

  events.forEach(ev => {
    const el = document.getElementById(ev.id) as HTMLDivElement | null
    if (el) {
      // Skip applying styles to dragging event
      if (ev.id !== draggingId) {
        el.style.left = ""
        el.style.width = ""
        el.style.zIndex = "1"
      }
      elements[ev.id] = el
    }
  })

  const clusters = buildClusters(events)

  for (const cluster of clusters) {
    const positioned = assignColumns(cluster)
    expandSpans(positioned)

    const maxCol = Math.max(...positioned.map(e => e.col + e.colSpan))

    for (const ev of positioned) {
      const el = elements[ev.id]
      if (!el) continue

      const leftPercent = (ev.col / maxCol) * 96
      const widthPercent = (ev.colSpan / maxCol) * 96

      el.style.left = `calc(4.75rem + ${leftPercent}%)`
      el.style.width = `calc(${widthPercent}% - 4px)`
      el.style.zIndex = "2"
    }
  }
}

