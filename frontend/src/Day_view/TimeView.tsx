import React, { useState, memo, useRef, useEffect } from "react"
import type { EventType } from '../lib/eventUtils'
import { removePlaceholder, addEventOnClick, dragEvent, resizeEvent, TOP_DEAD_ZONE, restoreEventWidths, calculateEventDuration, STEP_HEIGHT } from '../lib/eventUtils'

interface TimeViewProps {
  initialEvents?: EventType[]
}

const CalendarEvent = memo(
  ({
    event,
    onMouseDown,
    onResizeStart,
    isDragging = false,
  }: {
    event: EventType
    onMouseDown: (e: React.MouseEvent) => void
    onResizeStart: (e: React.MouseEvent, event: EventType) => void
    isDragging?: boolean
  }) => {
const bgColor =isDragging ?
     'bg-[#db7fa5]'
    :'bg-[#f792bb] '


  const widthClass = isDragging ? 'left-0 right-0' : 'left-19 right-0'
  const zIndex = isDragging ? 'z-[9999]' : 'z-10'
    
return (
  <div
    onMouseDown={onMouseDown}
    className={`absolute ${bgColor} ${widthClass} ${zIndex}
      rounded-md calendar-event
      cursor-grab active:cursor-grabbing select-none
      border-r-2 border-b-0 border-t-4 border-transparent bg-clip-padding`}
    id={event.id}
    style={{
      top: event.slot + TOP_DEAD_ZONE,
      height: event.height,
    } as React.CSSProperties}
  >
    {/* Right vertical strip */}
<div className="absolute top-1 bottom-1 left-[3px] w-[6px] bg-pink-500 rounded" />

    {/* Event content - adjust based on event height */}
<div
  className={`text-white pl-[18px] pt-0 pb-1 relative z-10 `}
>
  {calculateEventDuration(event) <= 20 ? (
    // 🔹 20 MIN OR LESS (super compact)
    <div className="font-medium truncate flex items-center ">
      <span className="truncate">{event.title}</span>
      <span className="shrink-0 ml-1">
        {`, ${event.startHour.toString().padStart(2, "0")}:${event.startMin
          .toString()
          .padStart(2, "0")}`}
      </span>
    </div>

  ) : calculateEventDuration(event) <= 30 ? (
    // 🔹 21–30 MIN (compact horizontal)
    <div className=" flex pt-1 items-center truncate">
      <span className="truncate  text-s">{event.title}</span>
      <span className="shrink-0 ml-1">
        {`, ${event.startHour.toString().padStart(2, "0")}:${event.startMin
          .toString()
          .padStart(2, "0")}`}
      </span>
    </div>

  ) : (
    // 🔹 MORE THAN 30 MIN (normal layout)
    <>
      <div className="font-medium pt-1 truncate">
        {event.title}
      </div>
      <div
        className={`${
          event.height <= STEP_HEIGHT * 2 ? "text-xs" : "text-s"
        } truncate`}
      >
        {`${event.startHour.toString().padStart(2, "0")}:${event.startMin
          .toString()
          .padStart(2, "0")} - ${event.endHour
          .toString()
          .padStart(2, "0")}:${event.endMin
          .toString()
          .padStart(2, "0")}`}
      </div>
    </>
  )}
</div>

    {/* Resize handle - always visible and clickable */}
    <div
      onMouseDown={e => {
        console.log('Resize handle clicked for event:', event.id, 'height:', event.height)
        onResizeStart(e, event)
      }}
      className="absolute bottom-0 left-0 right-0 h-2 cursor-ns-resize rounded-b-md  z-30"
      title="Drag to resize"
    />
  </div>
)
  }
)

const TimeView: React.FC<TimeViewProps> = ({ 
  initialEvents = []
}) => {
  const [events, setEvents] = useState<EventType[]>(initialEvents)
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [resizingId, setResizingId] = useState<string | null>(null)
  const dragOffsetRef = useRef(0)
  const isDraggingRef = useRef(false)
  const isResizingRef = useRef(false)
  const eventsRef = useRef(events)
  
  // Keep eventsRef updated
  useEffect(() => {
    eventsRef.current = events
  }, [events])

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
      // Reset refs synchronously FIRST to prevent race conditions
      isDraggingRef.current = false
      isResizingRef.current = false
      
      if (draggingId || resizingId) {
        // Restore proper widths for all events after drag/resize
        restoreEventWidths(eventsRef.current)
        
        // Clean up placeholders and styles
        if (draggingId) {
          removePlaceholder(draggingId)
          const el = document.getElementById(draggingId)
          if (el) {
            el.style.boxShadow = "none"
            el.style.transition = ""
          }
        }
        // Note: resize doesn't create placeholders, but we might need cleanup in future
      }
      
      // Reset state AFTER cleanup
      setDraggingId(null)
      setResizingId(null)
    }

    window.addEventListener("mousemove", handleMouseMove)
    window.addEventListener("mouseup", handleMouseUp)
    return () => {
      // Cleanup event listeners
      window.removeEventListener("mousemove", handleMouseMove)
      window.removeEventListener("mouseup", handleMouseUp)
      
      // If component unmounts during drag/resize, clean up
      if (draggingId) {
        removePlaceholder(draggingId)
        const el = document.getElementById(draggingId)
        if (el) {
          el.style.boxShadow = "none"
          el.style.transition = ""
        }
      }
      // Note: resize doesn't create placeholders
    }
   }, [draggingId, resizingId])

  // Call restoreEventWidths when events change (new events added, etc.)
  // But skip during dragging/resizing
  useEffect(() => {
    if (isDraggingRef.current || isResizingRef.current) return
    restoreEventWidths(events)
  }, [events, draggingId])

  const handleEventClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (isDraggingRef.current || isResizingRef.current) return
    const rect = e.currentTarget.getBoundingClientRect()
    let clickY = e.clientY - rect.top
    const clickX = e.clientX - rect.left
    
    if (clickY < TOP_DEAD_ZONE) return
    const target = e.target as HTMLElement
    
    // Check if clicking within the horizontal line area
    // Hour label is w-16 (64px) + gap-3 (12px) = 76px from left
    // Only allow clicks if X position is >= 76px (within horizontal line area)
    if (clickX < 76) {
      return // Click is in hour label area or gap, don't create event
    }
    
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
          isDragging={draggingId === event.id}
        />
      ))}
    </div>
  )
}

export default TimeView

