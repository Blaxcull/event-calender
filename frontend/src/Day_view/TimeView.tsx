import React, { useState, memo, useRef, useEffect, useLayoutEffect } from "react"
import type { EventType } from '../lib/eventUtils'
import {unlockInteraction, resetInteractionLock, removePlaceholder, addEventOnClick, TOP_DEAD_ZONE, restoreEventWidths, calculateEventDuration, STEP_HEIGHT, snap, yToTime, yToTimeSnapped, storeEventToUIEvent, uiEventToStoreEvent } from '../lib/eventUtils'
import { useTimeStore } from "@/store/timeStore"
import { useEventsStore, formatDate } from "@/store/eventsStore"

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
    isSelected = false,
  }: {
    event: EventType
    onMouseDown: (e: React.MouseEvent) => void
    onResizeStart: (e: React.MouseEvent, event: EventType) => void
    isDragging?: boolean
    isResizing?: boolean
    isSelected?: boolean
  }) => {
const bgColor = isDragging
  ? 'bg-[#db7fa5]'
  : 'bg-[#f792bb]'

 const isActive = isDragging || isResizing || isSelected

const zIndex = isActive ? 'z-[9999]' : 'z-10'
const shadow = isActive ? 'shadow-2xl' : ''

const eventStyle: React.CSSProperties = {
      top: event.slot + TOP_DEAD_ZONE,
      height: event.height,
    }

const leftStrip = isSelected
  ? 'bg-black'
  : 'bg-pink-500'

return (
  <div
    onMouseDown={onMouseDown}
    className={`absolute ${bgColor} ${zIndex} ${shadow}
  rounded-md calendar-event
  cursor-grab active:cursor-grabbing select-none
  ${isSelected ? 'border-2 border-black' : 'border-r-2 border-b-0 border-t-4 border-transparent'}
  bg-clip-padding`}
    id={event.id}
    style={eventStyle}
  >
    <div className={`absolute top-1 bottom-1 left-[3px] w-[6px] ${leftStrip} rounded`} />

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
  const deleteEvent = useEventsStore((state) => state.deleteEvent)
  const eventsCache = useEventsStore((state) => state.eventsCache)
  const selectedEventId = useEventsStore((state) => state.selectedEventId)
  const setSelectedEvent = useEventsStore((state) => state.setSelectedEvent)

  // Local state for events - this is the key to performance!
  // We work with local events during drag/resize for instant feedback
  const [localEvents, setLocalEvents] = useState<EventType[]>([])
  
  // Sync local events from store when not dragging/resizing
  useEffect(() => {
    if (!selectedDate) {
      setLocalEvents([])
      return
    }
    const dateKey = formatDate(selectedDate)
    const storeEvents = eventsCache[dateKey] || []
    const uiEvents = storeEvents.map(event => storeEventToUIEvent(event, selectedDate))
    
    // Check if any temp events were replaced with real ones (ID swap detection)
    const currentIds = new Set(localEvents.map(e => e.id))
    const newIds = new Set(uiEvents.map(e => e.id))
    
    // Find IDs that disappeared (temp events)
    const removedIds = [...currentIds].filter(id => !newIds.has(id))
    
    // Find ID swaps before updating state
    // When a temp event is replaced with a real one, we track the mapping
    // and update the DOM element's ID so React doesn't destroy and recreate it
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
            // Store the mapping from temp ID to real ID
            idMapping.current.set(removedId, replacementEvent.id)
            
            // Update the DOM element's ID from temp to real
            const tempEl = document.getElementById(removedId) as HTMLDivElement | null
            if (tempEl) {
              tempEl.id = replacementEvent.id
            }
            
            // Mark this ID to skip layout animation
            lastAddedEventId.current = replacementEvent.id
          }
        }
        pendingEventIds.current.delete(removedId)
      }
    })
    
    setLocalEvents(uiEvents)
    
    // Clean up old ID mappings for events that no longer exist
    const currentEventIds = new Set(uiEvents.map(e => e.id))
    for (const [tempId, realId] of idMapping.current.entries()) {
      if (!currentEventIds.has(realId)) {
        idMapping.current.delete(tempId)
      }
    }
  }, [selectedDate, eventsCache])
  
  // UI state
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [resizingId, setResizingId] = useState<string | null>(null)
  const dragOffsetRef = useRef(0)
  const isDraggingRef = useRef(false)
  const isResizingRef = useRef(false)
  const recentlyInteractedRef = useRef(false)
  const mouseDownPosRef = useRef<{ x: number; y: number; eventId: string } | null>(null)
  const justCreatedEventRef = useRef<string | null>(null)
  const DRAG_THRESHOLD = 5

  // Reset interaction lock on mount to ensure clean state
  useEffect(() => {
    resetInteractionLock()
  }, [])

  // Handle ESC key to delete selected event
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && selectedEventId) {
        // Confirm before deleting
        if (confirm('Delete this event?')) {
          deleteEvent(selectedEventId)
          setSelectedEvent(null)
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [selectedEventId, deleteEvent, setSelectedEvent])

  // Handle click on calendar to create events
  const handleContainerClick = async (e: React.MouseEvent<HTMLDivElement>) => {
    if (isDraggingRef.current || isResizingRef.current || recentlyInteractedRef.current) return
    
    const target = e.target as HTMLElement
    
    if (target.closest(".calendar-event")) {
      return
    }
    
    if (selectedEventId) {
      // Don't deselect if we just created this event
      if (justCreatedEventRef.current === selectedEventId) {
        justCreatedEventRef.current = null
        return
      }
      setSelectedEvent(null)
      return
    }
    
    // Create new event at click position
    const rect = e.currentTarget.getBoundingClientRect()
    let clickY = e.clientY - rect.top
    const clickX = e.clientX - rect.left
    
    if (clickY < TOP_DEAD_ZONE) return
    
    if (clickX < 76) {
      return
    }
    
    clickY -= TOP_DEAD_ZONE
    if (!selectedDate) return
    
    const newUIEvent = addEventOnClick(clickY, localEvents, selectedDate)
    if (!newUIEvent) return
    
    // Calculate correct width for the new event immediately
    const overlappingEvents = localEvents.filter(ev =>
      ev.slot < newUIEvent.slot + newUIEvent.height &&
      newUIEvent.slot < ev.slot + ev.height
    )
    
    const totalEvents = overlappingEvents.length + 1
    const widthPercent = 100 / totalEvents
    
    lastAddedEventId.current = newUIEvent.id
    pendingEventIds.current.add(newUIEvent.id)
    
    // Pre-position existing overlapping events
    overlappingEvents.forEach((ev, index) => {
      const el = document.getElementById(ev.id) as HTMLDivElement | null
      if (el) {
        el.style.transition = "left 200ms ease, width 200ms ease"
        const newLeftPercent = index * widthPercent
        el.style.left = `calc(${newLeftPercent}%)`
        el.style.width = `calc(${widthPercent}%)`
      }
    })
    
    // Add to local state immediately
    setLocalEvents(prev => [...prev, newUIEvent])
    
    // Apply correct position and fade-in (full width since selected)
    requestAnimationFrame(() => {
      const newEl = document.getElementById(newUIEvent.id) as HTMLDivElement | null
      if (newEl) {
        newEl.style.left = '0'
        newEl.style.width = '100%'
        newEl.style.zIndex = "20"
        newEl.style.opacity = "0"
        
        requestAnimationFrame(() => {
          newEl.style.transition = "opacity 150ms ease-out"
          newEl.style.opacity = "1"
          
          setTimeout(() => {
            newEl.style.transition = ""
            newEl.style.opacity = ""
          }, 150)
        })
      }
    })
    
    // Save to store
    const dateStr = formatDate(selectedDate)
    const storeEvent = uiEventToStoreEvent(newUIEvent, dateStr)
    console.log('Creating event with data:', storeEvent)
    try {
      addEventOptimistic({
        title: storeEvent.title!,
        date: storeEvent.date!,
        end_date: storeEvent.end_date!,
        start_time: storeEvent.start_time!,
        end_time: storeEvent.end_time!,
        description: storeEvent.description,
        notes: storeEvent.notes,
        urls: storeEvent.urls,
        color: storeEvent.color,
        is_all_day: storeEvent.is_all_day,
        location: storeEvent.location,
        id: storeEvent.id,
      })
      justCreatedEventRef.current = newUIEvent.id
      setSelectedEvent(newUIEvent.id)
    } catch (error) {
      console.error('Failed to create event:', error)
    }
  }

  const handleMouseDown = (e: React.MouseEvent, event: EventType) => {
    e.stopPropagation()
    e.preventDefault()
    
    mouseDownPosRef.current = {
      x: e.clientX,
      y: e.clientY,
      eventId: event.id,
    }
    
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    dragOffsetRef.current = e.clientY - rect.top
  }

  const startDrag = (event: EventType) => {
    setDraggingId(event.id)
    isDraggingRef.current = true
    recentlyInteractedRef.current = true
    
    const el = document.getElementById(event.id) as HTMLDivElement | null
    if (!el) return
    
    const ph = document.createElement("div")
    ph.id = `ph-${event.id}`
    ph.style.position = "absolute"
    ph.style.top = `${event.slot + TOP_DEAD_ZONE + 2}px`
    ph.style.height = `${event.height - 1}px`
    ph.style.left = el.style.left
    ph.style.width = el.style.width
    ph.innerHTML = el.innerHTML
    ph.style.opacity = "0.5"
    ph.style.borderRadius = "10px"
    ph.style.background = "#db7fa5"
    ph.style.pointerEvents = "none"
    ph.style.zIndex = "1"
    el.parentElement?.appendChild(ph)
    
    el.style.left = "0px"
    el.style.width = "calc(100%)"
    el.style.zIndex = "9999"
    el.style.boxShadow = "0 10px 25px rgba(0,0,0,0.5)"
    el.style.transition = "box-shadow 100ms ease, width 200ms ease, left 200ms ease"
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
      
      // Check for drag threshold to start dragging
      if (mouseDownPosRef.current && !isDraggingRef.current && !isResizingRef.current) {
        const dx = e.clientX - mouseDownPosRef.current.x
        const dy = e.clientY - mouseDownPosRef.current.y
        const distance = Math.sqrt(dx * dx + dy * dy)
        
        if (distance > DRAG_THRESHOLD) {
          const event = localEvents.find(ev => ev.id === mouseDownPosRef.current?.eventId)
          if (event) {
            startDrag(event)
          }
        }
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
  
  // Track temp-to-real ID mappings for stable keys
  const idMapping = useRef<Map<string, string>>(new Map())

  // Clean up any orphaned placeholders and duplicate event elements when events change
  useEffect(() => {
    if (draggingId || resizingId) return
    
    // Remove orphaned placeholders
    document.querySelectorAll('[id^="ph-"]').forEach(el => {
      el.remove()
    })
    
    // Remove any duplicate event elements (keep first occurrence)
    const seenIds = new Set<string>()
    document.querySelectorAll('.calendar-event').forEach(el => {
      const id = el.id
      if (seenIds.has(id)) {
        el.remove()
      } else {
        seenIds.add(id)
      }
    })
  }, [localEvents, draggingId, resizingId])

  // Apply layout widths whenever local events change
  // Skip during drag/resize - only update when drag ends
  useLayoutEffect(() => {
    if (isDraggingRef.current || isResizingRef.current || draggingId || resizingId) {
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
    
    // Small delay to ensure React has updated the DOM
    const timer = setTimeout(() => {
      const skipEventId = lastAddedEventId.current || 
        (pendingEventIds.current.size > 0 ? Array.from(pendingEventIds.current)[0] : null)
      
      restoreEventWidths(localEvents, true, skipEventId, selectedEventId)
      
      if (lastAddedEventId.current) {
        lastAddedEventId.current = null
      }
      
      setTimeout(() => {
        localEvents.forEach(ev => {
          const el = document.getElementById(ev.id) as HTMLDivElement | null
          if (el) {
            el.style.transition = ""
            el.style.opacity = ""
          }
        })
      }, 300) // Increased from 200ms to match transition duration
    }, 10)
    
    return () => clearTimeout(timer)
  }, [localEvents, draggingId, resizingId, selectedEventId])

  // Handle drag/resize end - update state with final positions
  const handleMouseUp = () => {
    const wasDragging = isDraggingRef.current
    const wasResizing = isResizingRef.current
    
    // Handle click (no drag/resize happened)
    if (mouseDownPosRef.current && !wasDragging && !wasResizing) {
      const event = localEvents.find(ev => ev.id === mouseDownPosRef.current?.eventId)
      if (event) {
        setSelectedEvent(event.id)
      }
      mouseDownPosRef.current = null
      return
    }
    
    mouseDownPosRef.current = null
    
    if (!draggingId && !resizingId) return
    
    const wasDraggingId = draggingId
    const wasResizingId = resizingId
    
    // Get final DOM values and sync to store
    if (wasDraggingId && isDraggingRef.current) {
      const el = document.getElementById(wasDraggingId) as HTMLDivElement | null
      if (el) {
        const finalTop = parseInt(el.style.top || '0') - TOP_DEAD_ZONE
        const snappedY = snap(finalTop)
        const start = yToTime(snappedY)
        const draggedEvent = localEvents.find(e => e.id === wasDraggingId)
        
        if (draggedEvent && selectedDate) {
          const end = yToTime(snappedY + draggedEvent.height)
          const dateStr = formatDate(selectedDate)
          
          // Update in store - this will trigger a re-sync via useEffect
          updateEvent(wasDraggingId, {
            title: draggedEvent.title,
            date: dateStr,
            start_time: start.hour * 60 + start.min,
            end_time: end.hour * 60 + end.min,
          })
        }

        // Cleanup styles
        el.style.boxShadow = "none"
        removePlaceholder(wasDraggingId)
      }
    }
    
    if (wasResizingId && isResizingRef.current) {
      const el = document.getElementById(wasResizingId) as HTMLDivElement | null
      if (el) {
        const finalHeight = parseInt(el.style.height || '100')
        const snappedHeight = Math.max(STEP_HEIGHT, snap(finalHeight))
        const resizedEvent = localEvents.find(e => e.id === wasResizingId)
        
        if (resizedEvent && selectedDate) {
          const end = yToTime(resizedEvent.slot + snappedHeight)
          const dateStr = formatDate(selectedDate)
          
          // Update in store - this will trigger a re-sync via useEffect
          updateEvent(wasResizingId, {
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
    setSelectedEvent(null)
    
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

  // Filter out all-day events from time grid (they're shown in the sticky row)
  const timedEvents = localEvents.filter(event => !event.isAllDay)

  return (
    <div
      onClick={handleContainerClick}
      className="absolute inset-0 calendar-container"
      style={{ zIndex: 10 }}
    >
        {timedEvents.map(event => {
          // Get stable key - use temp ID if available in mapping, otherwise use real ID
          // This prevents React from remounting when temp ID is swapped to real ID
          let stableKey = event.id
          for (const [tempId, realId] of idMapping.current.entries()) {
            if (realId === event.id) {
              stableKey = tempId
              break
            }
          }

          return (
            <CalendarEvent
              key={stableKey}
              event={event}
              onMouseDown={e => handleMouseDown(e, event)}
              onResizeStart={handleResizeStart}
              isDragging={draggingId === event.id}
              isResizing={resizingId === event.id}
              isSelected={selectedEventId === event.id}
            />
          )
        })}
    </div>
  )
}

export default TimeView
