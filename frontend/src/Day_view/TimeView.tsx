import React, { useState, memo, useRef, useEffect } from "react"
import type { EventType } from '../lib/eventUtils'
import {unlockInteraction, resetInteractionLock, removePlaceholder, addEventOnClick, TOP_DEAD_ZONE, restoreEventWidths, calculateEventDuration, STEP_HEIGHT, snap, yToTime, storeEventToUIEvent, uiEventToStoreEvent } from '../lib/eventUtils'
import { useTimeStore } from "@/store/timeStore"
import { useEventsStore } from "@/store/eventsStore"

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

const TimeView: React.FC<TimeViewProps> = () => {
  const selectedDate = useTimeStore((state) => state.selectedDate)
  const addEventOptimistic = useEventsStore((state) => state.addEventOptimistic)
  const updateEvent = useEventsStore((state) => state.updateEvent)
  const eventsCache = useEventsStore((state) => state.eventsCache)
  
  // Local state for events - this is the key to performance!
  // We work with local events during drag/resize for instant feedback
  const [localEvents, setLocalEvents] = useState<EventType[]>([])
  
  // Sync local events from store when not dragging/resizing
  useEffect(() => {
    if (!selectedDate) {
      setLocalEvents([])
      return
    }
    const dateKey = selectedDate.toISOString().split('T')[0]
    const storeEvents = eventsCache[dateKey] || []
    const uiEvents = storeEvents.map(event => storeEventToUIEvent(event, selectedDate))
    
    // Check if any temp events were replaced with real ones (ID swap detection)
    const currentIds = new Set(localEvents.map(e => e.id))
    const newIds = new Set(uiEvents.map(e => e.id))
    
    // Find IDs that disappeared (temp events)
    const removedIds = [...currentIds].filter(id => !newIds.has(id))
    
    // For each removed temp ID, check if there's a new event at the same position
    // This indicates an ID swap (temp → real)
    removedIds.forEach(removedId => {
      if (pendingEventIds.current.has(removedId)) {
        // Find the removed event's position
        const removedEvent = localEvents.find(e => e.id === removedId)
        if (removedEvent) {
          // Find a new event at the same position (the real one)
          const replacementEvent = uiEvents.find(e => 
            e.slot === removedEvent.slot && 
            e.startHour === removedEvent.startHour &&
            e.startMin === removedEvent.startMin &&
            e.height === removedEvent.height &&
            e.title === removedEvent.title
          )
          if (replacementEvent) {
            // Mark the replacement event to skip layout animation
            lastAddedEventId.current = replacementEvent.id
            
            // Immediately calculate and apply the correct position to prevent any visible movement
            // Calculate the layout for this event based on all events (including the replacement)
            const allEvents = uiEvents.filter(e => e.id !== replacementEvent.id)
            const eventsInSameSlot = allEvents.filter(ev =>
              ev.slot < replacementEvent.slot + replacementEvent.height &&
              replacementEvent.slot < ev.slot + ev.height
            )
            
            // Position the replacement event immediately without animation
            requestAnimationFrame(() => {
              const newEl = document.getElementById(replacementEvent.id) as HTMLDivElement | null
              if (newEl && eventsInSameSlot.length > 0) {
                // If there are overlapping events, calculate the correct width
                const totalOverlapping = eventsInSameSlot.length + 1
                const widthPercent = 100 / totalOverlapping
                const index = eventsInSameSlot.length
                const leftPercent = index * widthPercent
                
                newEl.style.transition = "none"
                newEl.style.left = `calc(${leftPercent}%)`
                newEl.style.width = `calc(${widthPercent}%)`
                newEl.style.zIndex = "2"
              } else if (newEl) {
                // No overlap, full width
                newEl.style.transition = "none"
                newEl.style.left = "0"
                newEl.style.width = "100%"
                newEl.style.zIndex = "2"
              }
            })
          }
        }
        pendingEventIds.current.delete(removedId)
      }
    })
    
    setLocalEvents(uiEvents)
  }, [selectedDate, eventsCache])
  
  // UI state
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

  // Simple mousemove handler like the fast version
  // Effect dependencies are STABLE - localEvents only changes on mouse up
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

      if (draggingId && isDraggingRef.current) {
        // Get current dragged event
        const draggedEvent = localEvents.find(ev => ev.id === draggingId)
        if (draggedEvent) {
          // Calculate new position with snapping
          const snappedY = Math.max(0, snap(y - dragOffsetRef.current))
          
          // Update DOM directly for smooth animation
          const el = document.getElementById(draggingId) as HTMLDivElement | null
          if (el) {
            el.style.top = `${snappedY + TOP_DEAD_ZONE}px`
          }
          
          // Update local state for real-time overlap adjustments
          // This causes re-render but that's OK - it's local state only!
          const start = yToTime(snappedY)
          const end = yToTime(snappedY + draggedEvent.height)
          setLocalEvents(prev => prev.map(ev => 
            ev.id === draggingId 
              ? { ...ev, slot: snappedY, startHour: start.hour, startMin: start.min, endHour: end.hour, endMin: end.min }
              : ev
          ))
        }
      }

      if (resizingId && isResizingRef.current) {
        // Get current resized event
        const resizedEvent = localEvents.find(ev => ev.id === resizingId)
        if (resizedEvent) {
          // Calculate new height with snapping
          const newHeight = Math.max(STEP_HEIGHT, snap(y - resizedEvent.slot))
          
          // Update DOM directly for smooth animation
          const el = document.getElementById(resizingId) as HTMLDivElement | null
          if (el) {
            el.style.height = `${newHeight}px`
          }
          
          // Update local state for real-time overlap adjustments
          const end = yToTime(resizedEvent.slot + newHeight)
          setLocalEvents(prev => prev.map(ev => 
            ev.id === resizingId 
              ? { ...ev, height: newHeight, endHour: end.hour, endMin: end.min }
              : ev
          ))
        }
      }
    }

    window.addEventListener("mousemove", handleMouseMove)
    return () => {
      window.removeEventListener("mousemove", handleMouseMove)
    }
   }, [draggingId, resizingId, localEvents])

  // Track the most recently added event to skip its layout animation
  const lastAddedEventId = useRef<string | null>(null)
  
  // Track temp event IDs that are pending database save
  const pendingEventIds = useRef<Set<string>>(new Set())

  // Apply layout widths whenever local events change
  // Skip during drag/resize - only update when drag ends
  useEffect(() => {
    // Don't resize other events during drag/resize - wait until released
    if (isDraggingRef.current || isResizingRef.current || draggingId || resizingId) {
      // Only ensure active event stays full width during drag
      const activeId = draggingId || resizingId
      if (activeId) {
        const activeEl = document.getElementById(activeId) as HTMLDivElement | null
        if (activeEl) {
          activeEl.style.left = "0"
          activeEl.style.width = "100%"
        }
      }
      return
    }
    
    // Use requestAnimationFrame to ensure DOM elements are created before applying layout
    // This prevents jitter when new events are added
    const rafId = requestAnimationFrame(() => {
      // Only apply layout when NOT dragging/resizing
      // Skip animation for the most recently added event
      restoreEventWidths(localEvents, true, lastAddedEventId.current)
      
      // Clear the last added event ID after layout is applied
      if (lastAddedEventId.current) {
        lastAddedEventId.current = null
      }
      
      // Clear transitions after animation completes
      setTimeout(() => {
        localEvents.forEach(ev => {
          const el = document.getElementById(ev.id) as HTMLDivElement | null
          if (el) {
            el.style.transition = ""
            el.style.opacity = ""
          }
        })
      }, 200)
    })
    
    return () => cancelAnimationFrame(rafId)
  }, [localEvents, draggingId, resizingId])

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
    
    const newUIEvent = addEventOnClick(clickY, localEvents, selectedDate)
    if (!newUIEvent) return
    
    // Track the new event ID to skip its layout animation
    lastAddedEventId.current = newUIEvent.id
    
    // Add to pending set to track ID swaps when saved to DB
    pendingEventIds.current.add(newUIEvent.id)
    
    // Add to local state immediately for instant feedback
    setLocalEvents(prev => [...prev, newUIEvent])
    
    // Apply fade-in animation to the new event
    // We use a small delay to ensure the element is rendered
    setTimeout(() => {
      const newEl = document.getElementById(newUIEvent.id) as HTMLDivElement | null
      if (newEl) {
        // Start invisible and fade in - no transform to avoid jitter
        newEl.style.opacity = "0"
        // Only animate opacity for the new event, not position
        newEl.style.transition = "opacity 150ms ease-out"
        
        // Trigger fade in
        requestAnimationFrame(() => {
          newEl.style.opacity = "1"
        })
        
        // Clear transition after animation
        setTimeout(() => {
          newEl.style.transition = ""
          newEl.style.opacity = ""
        }, 150)
      }
    }, 10)
    
    // Convert to store format and save optimistically
    const dateStr = selectedDate.toISOString().split('T')[0]
    const storeEvent = uiEventToStoreEvent(newUIEvent, dateStr)
    console.log('Creating event with data:', storeEvent)
    try {
      // Use optimistic update - event appears immediately
      addEventOptimistic({
        title: storeEvent.title!,
        date: storeEvent.date!,
        start_time: storeEvent.start_time!,
        end_time: storeEvent.end_time!,
        description: storeEvent.description,
        color: storeEvent.color,
        is_all_day: storeEvent.is_all_day,
        location: storeEvent.location,
        id: storeEvent.id,
      })
    } catch (error) {
      console.error('Failed to create event:', error)
    }
  }

  // Handle drag/resize end - update state with final positions
  const handleMouseUp = () => {
    if (!draggingId && !resizingId) return
    
    const wasDragging = draggingId
    const wasResizing = resizingId
    
    // Get final DOM values and sync to store
    if (wasDragging && isDraggingRef.current) {
      const el = document.getElementById(wasDragging) as HTMLDivElement | null
      if (el) {
        const finalTop = parseInt(el.style.top || '0') - TOP_DEAD_ZONE
        const snappedY = snap(finalTop)
        const start = yToTime(snappedY)
        const draggedEvent = localEvents.find(e => e.id === wasDragging)
        
        if (draggedEvent && selectedDate) {
          const end = yToTime(snappedY + draggedEvent.height)
          const dateStr = selectedDate.toISOString().split('T')[0]
          
          // Update in store - this will trigger a re-sync via useEffect
          updateEvent(wasDragging, {
            title: draggedEvent.title,
            date: dateStr,
            start_time: start.hour * 60 + start.min,
            end_time: end.hour * 60 + end.min,
          })
        }

        // Cleanup styles
        el.style.boxShadow = "none"
        removePlaceholder(wasDragging)
      }
    }
    
    if (wasResizing && isResizingRef.current) {
      const el = document.getElementById(wasResizing) as HTMLDivElement | null
      if (el) {
        const finalHeight = parseInt(el.style.height || '100')
        const snappedHeight = Math.max(STEP_HEIGHT, snap(finalHeight))
        const resizedEvent = localEvents.find(e => e.id === wasResizing)
        
        if (resizedEvent && selectedDate) {
          const end = yToTime(resizedEvent.slot + snappedHeight)
          const dateStr = selectedDate.toISOString().split('T')[0]
          
          // Update in store - this will trigger a re-sync via useEffect
          updateEvent(wasResizing, {
            title: resizedEvent.title,
            date: dateStr,
            start_time: resizedEvent.startHour * 60 + resizedEvent.startMin,
            end_time: end.hour * 60 + end.min,
          })
        }

        // Cleanup styles
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
  }, [draggingId, resizingId, localEvents, selectedDate])

  return (
    <div
      onClick={handleEventClick}
      className="absolute inset-0 calendar-container"
      style={{ zIndex: 10 }}
    >
       {localEvents.map(event => (
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
