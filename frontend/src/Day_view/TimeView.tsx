import React, { useState, memo, useRef, useEffect } from "react"
import type { EventType } from '../lib/eventUtils'
import { addEventOnClick, dragEvent, resizeEvent, TOP_DEAD_ZONE} from '../lib/eventUtils'

const CalendarEvent = memo(
  ({
    event,
    onMouseDown,
    onResizeStart,
  }: {
    event: EventType
    onMouseDown: (e: React.MouseEvent) => void
    onResizeStart: (e: React.MouseEvent, event: EventType) => void
  }) => {
    return (
      <div
        onMouseDown={onMouseDown}
        className="absolute bg-pink-500/40 rounded-md left-19 right-0 text-white text-xs pl-2 pt-1 calendar-event cursor-grab active:cursor-grabbing select-none"
        style={{
          top: event.slot + TOP_DEAD_ZONE,
          height: event.height,
        }}
      >
        <div className="font-medium">{event.title}</div>
        <div className="text-[10px] opacity-80">
          {`${event.startHour.toString().padStart(2,"0")}:${event.startMin.toString().padStart(2,"0")} – ${event.endHour.toString().padStart(2,"0")}:${event.endMin.toString().padStart(2,"0")}`}
        </div>
        <div
          onMouseDown={e => onResizeStart(e, event)}
          className="absolute bottom-0 left-0 right-0 h-2 cursor-ns-resize bg-white/30 rounded-b-md"
        />
      </div>
    )
  }
)

const TimeView: React.FC = () => {
  const [events, setEvents] = useState<EventType[]>([])
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [resizingId, setResizingId] = useState<string | null>(null)
  const dragOffsetRef = useRef(0)
  const isDraggingRef = useRef(false)
  const isResizingRef = useRef(false)

  const handleDragStart = (e: React.MouseEvent, event: EventType) => {
    e.stopPropagation()
    setDraggingId(event.id)
    isDraggingRef.current = true
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    dragOffsetRef.current = e.clientY - rect.top
  }

  const handleResizeStart = (e: React.MouseEvent, event: EventType) => {
    e.stopPropagation()
    setResizingId(event.id)
    isResizingRef.current = true
  }

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      const container = document.querySelector(".calendar-container")
      if (!container) return
      const rect = container.getBoundingClientRect()
      const y = e.clientY - rect.top - TOP_DEAD_ZONE

      if (draggingId) {
        setEvents(prev =>
          prev.map(ev =>
            ev.id === draggingId ? dragEvent(ev, y - dragOffsetRef.current) : ev
          )
        )
      }

      if (resizingId) {
        setEvents(prev =>
          prev.map(ev =>
            ev.id === resizingId ? resizeEvent(ev, y - ev.slot) : ev
          )
        )
      }
    }

    const handleMouseUp = () => {
      setDraggingId(null)
      setResizingId(null)
      setTimeout(() => {
        isDraggingRef.current = false
        isResizingRef.current = false
      }, 0)
    }

    window.addEventListener("mousemove", handleMouseMove)
    window.addEventListener("mouseup", handleMouseUp)
    return () => {
      window.removeEventListener("mousemove", handleMouseMove)
      window.removeEventListener("mouseup", handleMouseUp)
    }
  }, [draggingId, resizingId])

  const handleEventClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (isDraggingRef.current || isResizingRef.current) return
    const rect = e.currentTarget.getBoundingClientRect()
    let clickY = e.clientY - rect.top
    if (clickY < TOP_DEAD_ZONE) return
    const target = e.target as HTMLElement
    if (target.closest(".calendar-event")) return

    clickY -= TOP_DEAD_ZONE
    const newEvent = addEventOnClick(clickY, events)
    if (!newEvent) return
    setEvents(prev => [...prev, newEvent])
  }

  return (
    <div
      onClick={handleEventClick}
      className="absolute inset-0 calendar-container"
      style={{ zIndex: 10 }}
    >
      {events.map(event => (
        <CalendarEvent
          key={event.id}
          event={event}
          onMouseDown={e => handleDragStart(e, event)}
          onResizeStart={handleResizeStart}
        />
      ))}
    </div>
  )
}

export default TimeView

