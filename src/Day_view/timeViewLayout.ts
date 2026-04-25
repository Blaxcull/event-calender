import type { EventPositions } from '@/lib/eventUtils'

export const EVENT_TOP_GAP = 2
export const EVENT_SIDE_GAP = 2
export const EVENT_FULL_WIDTH_WITH_GAPS = `calc(100% - ${EVENT_SIDE_GAP * 2}px)`

export const insetEventLeft = (left: string) =>
  left === '0' ? `${EVENT_SIDE_GAP}px` : `calc(${left} + ${EVENT_SIDE_GAP}px)`

export const insetEventWidth = (width: string) =>
  width === '100%' ? EVENT_FULL_WIDTH_WITH_GAPS : `calc(${width} - ${EVENT_SIDE_GAP * 2}px)`

export const applyInsetPositionsToDOM = (positions: EventPositions) => {
  requestAnimationFrame(() => {
    for (const id in positions) {
      const el = document.getElementById(id)
      if (!el) continue

      const { left, width, zIndex } = positions[id]
      el.style.transition = 'left 200ms ease, width 200ms ease'
      el.style.left = insetEventLeft(left)
      el.style.width = insetEventWidth(width)
      el.style.zIndex = String(zIndex)
    }
  })
}
