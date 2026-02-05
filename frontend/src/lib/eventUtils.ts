// eventUtils.ts

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
  const sorted = [...events].sort((a, b) => a.slot - b.slot)

  const hourEvents = sorted.filter(ev =>
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

/* ================= RESTORE WIDTHS ================= */

export function restoreEventWidths(events: EventType[]): void {
  const elements: Record<string, HTMLDivElement> = {}

  // Batch DOM lookup once
  events.forEach(ev => {
    const el = document.getElementById(ev.id) as HTMLDivElement | null
    if (el) elements[ev.id] = el
  })

  // Reset
  Object.values(elements).forEach(el => {
    el.style.left = ""
    el.style.width = ""
    el.style.zIndex = "auto"
    el.style.transform = "none"
    el.style.removeProperty("--event-scale")
  })

  const sorted = [...events].sort((a, b) => a.slot - b.slot)
  const groups: EventType[][] = []
  let group: EventType[] = []
  let bottom = -1

  for (const ev of sorted) {
    const top = ev.slot
    const btm = ev.slot + ev.height

    if (group.length && overlaps(top, btm, group[0].slot, bottom)) {
      group.push(ev)
      bottom = Math.max(bottom, btm)
    } else {
      if (group.length) groups.push(group)
      group = [ev]
      bottom = btm
    }
  }
  if (group.length) groups.push(group)

  for (const group of groups) {
    const count = group.length

    if (count === 1) {
      const el = elements[group[0].id]
      if (!el) continue
      el.style.left = "4.75rem"
      el.style.width = "calc(100% - 4.75rem)"
      el.style.zIndex = "1"
      continue
    }

    // Chain detection preserved
    const sortedGroup = [...group].sort((a, b) => a.slot - b.slot)
    let chain = true
    for (let i = 0; i < sortedGroup.length - 1; i++) {
      if (sortedGroup[i].slot + sortedGroup[i].height <= sortedGroup[i + 1].slot) {
        chain = false
        break
      }
    }

    const first = sortedGroup[0]
    const last = sortedGroup[count - 1]
    const firstLastOverlap = first.slot + first.height > last.slot

    if (chain && !firstLastOverlap) {
      sortedGroup.forEach((ev, i) => {
        const el = elements[ev.id]
        if (!el) return
        if (i === 0 || i === count - 1) {
          el.style.left = "4.75rem"
          el.style.width = "calc(100% - 4.75rem)"
          el.style.zIndex = "1"
        } else {
          el.style.left = "calc(4.75rem + 50%)"
          el.style.width = "50%"
          el.style.zIndex = "5"
        }
      })
      continue
    }

    // Complex layout preserved
    sortedGroup.forEach((ev, index) => {
      const el = elements[ev.id]
      if (!el) return

      if (count === 2) {
        el.style.left = `calc(4.75rem + ${index === 0 ? 0 : 10}%)`
        el.style.width = `${index === 0 ? 90 : 86}%`
        el.style.zIndex = `${index + 1}`
        return
      }

      const baseShift = 10
      const maxShift = Math.min(30, (count - 1) * 8)
      let leftPercent = (index * baseShift * 100) / (count * baseShift + maxShift)
      leftPercent = Math.min(leftPercent, 70)

      let widthPercent =
        index === count - 1
          ? 96 - leftPercent
          : Math.max(30, (100 - leftPercent - 10) * 0.9)

      widthPercent = Math.max(widthPercent, 25)

      el.style.left = `calc(4.75rem + ${leftPercent}%)`
      el.style.width = `${widthPercent}%`
      el.style.zIndex = `${index + 1}`
    })
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

