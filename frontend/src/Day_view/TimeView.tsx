import React, { useState, memo, useRef, useEffect } from "react"
import type { EventType } from '../lib/eventUtils'
import {unlockInteraction, resetInteractionLock, removePlaceholder, addEventOnClick, TOP_DEAD_ZONE, restoreEventWidths, calculateEventDuration, STEP_HEIGHT, snap, yToTime } from '../lib/eventUtils'
import { useTimeStore } from "@/store/timeStore"

interface TimeViewProps {
  initialEvents?: EventType[]
}

const CalendarEvent = memo(
  ({
    event,
    onMouseDown,
    onResizeStart,
    isDragging = false,
    isResizing = false,
  }: {
    event: EventType
    onMouseDown: (e: React.MouseEvent) => void
    onResizeStart: (e: React.MouseEvent, event: EventType) => void
    isDragging?: boolean
    isResizing?: boolean
  }) => {
const bgColor =isDragging ?
     'bg-[#db7fa5]'
    :'bg-[#f792bb] '


  const widthClass = isDragging ? 'left-0 right-0' : 'left-19 right-0'
const isActive = isDragging || isResizing

const zIndex = isActive ? 'z-[9999]' : 'z-10'
const shadow = isActive ? 'shadow-2xl' : ''
    
return (
  <div
    onMouseDown={onMouseDown}
className={`absolute ${bgColor} ${widthClass} ${zIndex} ${shadow}
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
    // 20 MIN OR LESS (super compact)
    <div className="font-medium truncate flex items-center ">
      <span className="truncate">{event.title}</span>
      <span className="shrink-0 ml-1">
        {`, ${event.startHour.toString().padStart(2, "0")}:${event.startMin
          .toString()
          .padStart(2, "0")}`}
      </span>
    </div>

  ) : calculateEventDuration(event) <= 30 ? (
    // 21-30 MIN (compact horizontal)
    <div className=" flex pt-1 items-center truncate">
      <span className="truncate  text-s">{event.title}</span>
      <span className="shrink-0 ml-1">
        {`, ${event.startHour.toString().padStart(2, "0")}:${event.startMin
          .toString()
          .padStart(2, "0")}`}
      </span>
    </div>

  ) : (
    // MORE THAN 30 MIN (normal layout)
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

const TimeView: React.FC<TimeViewProps> = ({ initialEvents = [] }) => {
  const selectedDate = useTimeStore((state) => state.selectedDate)
  
  // Store all events in memory (no database)
  const [allEvents, setAllEvents] = useState<EventType[]>(initialEvents)
  
  // Filter events for selected date only
  const filteredEvents = React.useMemo(() => {
    if (!selectedDate) return [];
    
    const selectedDateStr = selectedDate.toDateString();
    return allEvents.filter(event => {
      const eventDate = event.date instanceof Date ? event.date : new Date(event.date);
      return eventDate.toDateString() === selectedDateStr;
    });
  }, [allEvents, selectedDate]);
  
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [resizingId, setResizingId] = useState<string | null>(null)
  const dragOffsetRef = useRef(0)
  const isDraggingRef = useRef(false)
  const isResizingRef = useRef(false)
  const recentlyInteractedRef = useRef(false)

  // Reset interaction lock on mount to ensure clean state
  useEffect(() => {
    resetInteractionLock()
  }, [])

  const handleDragStart = (e: React.MouseEvent, event: EventType) => {
    e.stopPropagation()
    e.preventDefault()
    setDraggingId(event.id)
    isDraggingRef.current = true
    recentlyInteractedRef.current = true
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    dragOffsetRef.current = e.clientY - rect.top
    
    // Create placeholder for visual feedback
    const ph = document.createElement("div")
    ph.id = `ph-${event.id}`
    ph.style.position = "absolute"
    ph.style.top = `${event.slot + TOP_DEAD_ZONE + 2}px`
    ph.style.height = `${event.height - 1}px`
    ph.style.left = (e.currentTarget as HTMLElement).style.left
    ph.style.width = (e.currentTarget as HTMLElement).style.width
    ph.innerHTML = (e.currentTarget as HTMLElement).innerHTML
    ph.style.opacity = "0.5"
    ph.style.borderRadius = "10px"
    ph.style.background = "#db7fa5"
    ph.style.pointerEvents = "none"
    ph.style.zIndex = "1"
    ;(e.currentTarget as HTMLElement).parentElement?.appendChild(ph)
    
    // Style the element immediately for drag
    const el = document.getElementById(event.id) as HTMLDivElement | null
    if (el) {
      el.style.left = "0px"
      el.style.width = "calc(100%)"
      el.style.zIndex = "9999"
      el.style.boxShadow = "0 10px 25px rgba(0,0,0,0.5)"
      el.style.transition = "box-shadow 100ms ease, width 200ms ease, left 200ms ease"
    }
  }

  const handleResizeStart = (e: React.MouseEvent, event: EventType) => {
    e.stopPropagation()
    e.preventDefault()
    setResizingId(event.id)
    isResizingRef.current = true
    recentlyInteractedRef.current = true
    
    // Style the element immediately for resize
    const el = document.getElementById(event.id) as HTMLDivElement | null
    if (el) {
      el.style.zIndex = "9999"
      el.style.boxShadow = "0 10px 25px rgba(0,0,0,0.5)"
      el.style.transition = "box-shadow 100ms ease, width 200ms ease, left 200ms ease"
      el.style.left = "0"
      el.style.width = "100%"
    }
  }

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      const container = document.querySelector(".calendar-container")
      if (!container) return
      const rect = container.getBoundingClientRect()
      
      const tolerance = 50
      const isNearContainer = e.clientY >= rect.top - tolerance && e.clientY <= rect.bottom + tolerance
      
      if (!isNearContainer) {
        return
      }
      
      let y = e.clientY - rect.top - TOP_DEAD_ZONE
      const MAX_Y = 24 * 100
      y = Math.max(0, Math.min(y, MAX_Y))

      if (draggingId) {
        // Get current dragged event
        const draggedEvent = filteredEvents.find(ev => ev.id === draggingId)
        if (draggedEvent) {
          // Calculate new position with snapping
          const snappedY = Math.max(0, snap(y - dragOffsetRef.current))
          
          // Update DOM directly for smooth animation
          const el = document.getElementById(draggingId) as HTMLDivElement | null
          if (el) {
            el.style.top = `${snappedY + TOP_DEAD_ZONE}px`
          }
        }
      }

      if (resizingId) {
        // Get current resized event
        const resizedEvent = filteredEvents.find(ev => ev.id === resizingId)
        if (resizedEvent) {
          // Calculate new height with snapping
          const newHeight = Math.max(STEP_HEIGHT, snap(y - resizedEvent.slot))
          
          // Update DOM directly for smooth animation
          const el = document.getElementById(resizingId) as HTMLDivElement | null
          if (el) {
            el.style.height = `${newHeight}px`
          }
        }
      }
    }

    window.addEventListener("mousemove", handleMouseMove)
    return () => {
      window.removeEventListener("mousemove", handleMouseMove)
    }
   }, [draggingId, resizingId, filteredEvents])

  useEffect(() => {
    // Apply layout widths when events change (but not during drag/resize)
    if (isDraggingRef.current || isResizingRef.current || draggingId !== null || resizingId !== null) {
      return
    }
    
    // Small delay to ensure DOM is updated
    const timeoutId = setTimeout(() => {
      restoreEventWidths(filteredEvents)
      // Clear transitions after animation completes
      setTimeout(() => {
        filteredEvents.forEach(ev => {
          const el = document.getElementById(ev.id) as HTMLDivElement | null
          if (el) {
            el.style.transition = ""
          }
        })
      }, 200)
    }, 0)

    return () => clearTimeout(timeoutId)
  }, [filteredEvents, draggingId, resizingId])

  const handleEventClick = async (e: React.MouseEvent<HTMLDivElement>) => {
    if (isDraggingRef.current || isResizingRef.current || recentlyInteractedRef.current) return
    
    const rect = e.currentTarget.getBoundingClientRect()
    let clickY = e.clientY - rect.top
    const clickX = e.clientX - rect.left
    
    if (clickY < TOP_DEAD_ZONE) return
    const target = e.target as HTMLElement
    
    if (clickX < 76) {
      return
    }
    
    if (target.closest(".calendar-event")) return

    clickY -= TOP_DEAD_ZONE
    if (!selectedDate) return
    
    const newEvent = addEventOnClick(clickY, filteredEvents, selectedDate)
    if (!newEvent) return
    
    // Add event to local state only (no database)
    setAllEvents(prev => [...prev, newEvent])
  }

  // Handle drag/resize end - update state with final positions
  const handleMouseUp = () => {
    if (!draggingId && !resizingId) return
    
    const wasDragging = draggingId
    const wasResizing = resizingId
    
    // Get final DOM values
    if (wasDragging) {
      const el = document.getElementById(wasDragging) as HTMLDivElement | null
      if (el) {
        const finalTop = parseInt(el.style.top || '0') - TOP_DEAD_ZONE
        const snappedY = snap(finalTop)
        const start = yToTime(snappedY)
        const draggedEvent = filteredEvents.find(e => e.id === wasDragging)
        
        if (draggedEvent) {
          const end = yToTime(snappedY + draggedEvent.height)
          setAllEvents(prev => 
            prev.map(e => e.id === wasDragging ? {
              ...e,
              slot: snappedY,
              startHour: start.hour,
              startMin: start.min,
              endHour: end.hour,
              endMin: end.min
            } : e)
          )
        }

        // Cleanup styles - keep transition for smooth return to original size
        el.style.boxShadow = "none"
        removePlaceholder(wasDragging)
      }
    }
    
    if (wasResizing) {
      const el = document.getElementById(wasResizing) as HTMLDivElement | null
      if (el) {
        const finalHeight = parseInt(el.style.height || '100')
        const snappedHeight = Math.max(STEP_HEIGHT, snap(finalHeight))
        const resizedEvent = filteredEvents.find(e => e.id === wasResizing)
        
        if (resizedEvent) {
          const end = yToTime(resizedEvent.slot + snappedHeight)
          setAllEvents(prev => 
            prev.map(e => e.id === wasResizing ? {
              ...e,
              height: snappedHeight,
              endHour: end.hour,
              endMin: end.min
            } : e)
          )
        }

        // Cleanup styles - keep transition for smooth return to original size
        el.style.boxShadow = "none"
      }
    }

    isDraggingRef.current = false
    isResizingRef.current = false
    setDraggingId(null)
    setResizingId(null)
    unlockInteraction()
    
    setTimeout(() => {
      recentlyInteractedRef.current = false
    }, 100)
  }

  useEffect(() => {
    window.addEventListener("mouseup", handleMouseUp)
    return () => {
      window.removeEventListener("mouseup", handleMouseUp)
    }
  }, [draggingId, resizingId, filteredEvents])

  return (
    <div
      onClick={handleEventClick}
      className="absolute inset-0 calendar-container"
      style={{ zIndex: 10 }}
    >
       {filteredEvents.map(event => (
        <CalendarEvent
          key={event.id}
          event={event}
          onMouseDown={e => handleDragStart(e, event)}
          onResizeStart={handleResizeStart}
          isDragging={draggingId === event.id}
          isResizing={resizingId === event.id}
        />
      ))}
    </div>
  )
}

export default TimeView

