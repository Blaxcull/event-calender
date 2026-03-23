import React, { useState, memo, useRef, useEffect, useLayoutEffect } from "react"
import ReactDOM from "react-dom"
import type { EventType, EventPositions } from '../lib/eventUtils'
import {unlockInteraction, resetInteractionLock, removePlaceholder, addEventOnClick, TOP_DEAD_ZONE, calculateEventDuration, STEP_HEIGHT, snap, yToTimeSnapped, storeEventToUIEvent, uiEventToStoreEvent, calculateEventPositions } from '../lib/eventUtils'
import { useTimeStore } from "@/store/timeStore"
import { useEventsStore, formatDate } from "@/store/eventsStore"
import RecurringActionDialog from "@/components/RecurringActionDialog"

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
    position = { left: "0", width: "100%", zIndex: 10 },
  }: {
    event: EventType
    onMouseDown: (e: React.MouseEvent) => void
    onResizeStart: (e: React.MouseEvent, event: EventType) => void
    isDragging?: boolean
    isResizing?: boolean
    isSelected?: boolean
    position?: { left: string; width: string; zIndex: number }
  }) => {
const containerRef = useRef<HTMLDivElement>(null)
const [showEndTime, setShowEndTime] = useState(true)

useEffect(() => {
  if (!containerRef.current) return
  const checkWidth = () => {
    setShowEndTime(containerRef.current!.offsetWidth > 180)
  }
  checkWidth()
  const observer = new ResizeObserver(checkWidth)
  observer.observe(containerRef.current)
  return () => observer.disconnect()
}, [])

const bgColor = isDragging
  ? 'bg-[#db7fa5]'
  : 'bg-[#f792bb]'

 const isActive = isDragging || isResizing || isSelected

const zIndex = isActive ? 'z-[9999]' : 'z-10'
const shadow = isActive ? 'shadow-2xl' : ''

const eventStyle: React.CSSProperties = {
      top: event.slot + TOP_DEAD_ZONE,
      height: event.height,
      left: position.left,
      width: position.width,
      zIndex: position.zIndex,
    }

const leftStrip = isSelected
  ? 'bg-white'
  : 'bg-pink-500'

return (
  <div
    ref={containerRef}
    onMouseDown={onMouseDown}
    className={`absolute ${bgColor} ${zIndex} ${shadow}
  rounded-md calendar-event
  cursor-grab active:cursor-grabbing select-none
  ${isSelected ? 'border-2 border-white' : isDragging || isResizing ? 'border-0' : 'border-r-2 border-b-0 border-t-4 border-transparent'}
  bg-clip-padding`}
    id={event.id}
    style={eventStyle}
  >
    <div className={`absolute top-1 bottom-1 left-[3px] w-[6px] ${leftStrip} rounded`} />

    {/* Event content - adjust based on event height */}
<div
  className={`text-white pl-[18px] pt-0  relative z-10 `}
>
  {calculateEventDuration(event) <= 20 ? (
    // 20 MIN OR LESS (super compact)
    <div className=" text-base truncate flex pr-2 h-5 items-center ">
      <span className="truncate font-semibold ">{event.title}</span>
      {/* Repeat icon for recurring events */}
      {event.series_id && (
        <span className="shrink-0 ml-1 text-xs opacity-70">↻</span>
      )}
      <span className="shrink-0 ml-1">
        {`, ${event.startHour.toString().padStart(2, "0")}:${event.startMin
          .toString()
          .padStart(2, "0")}`}
      </span>
    </div>

  ) : calculateEventDuration(event) <= 30 ? (
    // 21-30 MIN (compact horizontal)
    <div className=" flex pt-1 items-center pr-2 truncate">
      <span className="truncate font-semibold text-xl ">{event.title}</span>
      {/* Repeat icon for recurring events */}
      {event.series_id && !event.isRecurringInstance && (
        <span className="shrink-0 ml-1 text-sm opacity-70">↻</span>
      )}
      <span className="shrink-0 font-medium text-xl ml-1">
        {`, ${event.startHour.toString().padStart(2, "0")}:${event.startMin
          .toString()
          .padStart(2, "0")}`}
      </span>
    </div>

  ) : (
    // MORE THAN 30 MIN (normal layout)
    <>
      <div className="font-semibold text-xl pt-1 truncate flex items-center gap-1">
        {event.title}
        {/* Repeat icon for recurring events */}
        {event.series_id && (
          <span className="shrink-0 text-base opacity-70">↻</span>
        )}
      </div>
      <div className="text-lg flex items-center gap-2">
  <img
    src="/src/assets/clock.png"
    alt="clock"
    className="w-4 h-4  rotate-[270deg] invert"
  />

  {showEndTime 
    ? `${event.startHour.toString().padStart(2, "0")}:${event.startMin
      .toString()
      .padStart(2, "0")} - ${event.endHour
      .toString()
      .padStart(2, "0")}:${event.endMin
      .toString()
      .padStart(2, "0")}`
    : `${event.startHour.toString().padStart(2, "0")}:${event.startMin
      .toString()
      .padStart(2, "0")}`}
</div>
    </>
  )}
</div>

    {/* Resize handle - always visible and clickable */}
    <div
      onMouseDown={e => {
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
  const addEventLocal = useEventsStore((state) => state.addEventLocal)
  const updateEvent = useEventsStore((state) => state.updateEvent)
  const deleteEvent = useEventsStore((state) => state.deleteEvent)
  const getEventsForDate = useEventsStore((state) => state.getEventsForDate)
  const selectedEventId = useEventsStore((state) => state.selectedEventId)
  const setSelectedEvent = useEventsStore((state) => state.setSelectedEvent)
  const showRecurringDialog = useEventsStore((state) => state.showRecurringDialog)
  const closeRecurringDialog = useEventsStore((state) => state.closeRecurringDialog)

  // Subscribe to entire store for reactivity
  const storeState = useEventsStore()

  // Local state for events - this is the key to performance!
  // We work with local events during drag/resize for instant feedback
  const [localEvents, setLocalEvents] = useState<EventType[]>([])
  const [eventPositions, setEventPositions] = useState<EventPositions>({})
  
  // Get store functions
  const recurringDialogOpen = useEventsStore((state) => state.recurringDialogOpen)
  const recurringDialogEvent = useEventsStore((state) => state.recurringDialogEvent)
  const recurringDialogActionType = useEventsStore((state) => state.recurringDialogActionType)
  
  // Skip sync ref for recurring action handling
  const skipSyncRef = useRef(false)
  const lastDateKeyRef = useRef<string | null>(null)
  const [containerVisible, setContainerVisible] = useState(false)
  
  // Sync local events from store when not dragging/resizing
  useEffect(() => {
    // Skip sync when handling recurring action (to preserve local state changes)
    if (skipSyncRef.current) {
      skipSyncRef.current = false
      return
    }
    
    if (!selectedDate) {
      setLocalEvents([])
      return
    }
    
    // Check if date actually changed (not just events updating)
    const dateKey = selectedDate.toISOString().split('T')[0]
    const isDateChange = lastDateKeyRef.current !== dateKey
    if (isDateChange) {
      lastDateKeyRef.current = dateKey
      setContainerVisible(false)
    }
    
    const storeEvents = getEventsForDate(selectedDate)
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
    
    // Pre-calculate event positions synchronously so events render at correct positions
    const positions = calculateEventPositions(uiEvents, selectedEventId)
    setEventPositions(positions)
    
    // Clean up old ID mappings for events that no longer exist
    const currentEventIds = new Set(uiEvents.map(e => e.id))
    for (const [tempId, realId] of idMapping.current.entries()) {
      if (!currentEventIds.has(realId)) {
        idMapping.current.delete(tempId)
      }
    }
  }, [selectedDate, storeState.eventsCache, storeState.computedEventsCache, getEventsForDate])
  
  // UI state
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [resizingId, setResizingId] = useState<string | null>(null)
  const dragOffsetRef = useRef(0)
  const isDraggingRef = useRef(false)
  const isResizingRef = useRef(false)
  const recentlyInteractedRef = useRef(false)
  const mouseDownPosRef = useRef<{ x: number; y: number; eventId: string } | null>(null)
  const justCreatedEventRef = useRef<string | null>(null)
  const originalEventRef = useRef<{ id: string; slot: number; startHour: number; startMin: number; endHour: number; endMin: number; height: number } | null>(null)
  const DRAG_THRESHOLD = 5

  // Reset interaction lock on mount to ensure clean state
  useEffect(() => {
    resetInteractionLock()
  }, [])

  // Handle ESC key to delete selected event
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && selectedEventId) {
        const selectedEvent = localEvents.find(e => e.id === selectedEventId)
        if (selectedEvent) {
          if (selectedEvent.title === "New Event") {
            // Delete new events
            deleteEvent(selectedEvent.id)
            setSelectedEvent(null)
          } else if (selectedEvent.isRecurringInstance || selectedEvent.seriesMasterId) {
            // Show dialog for recurring events - delete only this occurrence
            const eventDateStr = selectedEvent.date instanceof Date 
              ? formatDate(selectedEvent.date) 
              : selectedEvent.date
            const startTime = selectedEvent.startHour * 60 + selectedEvent.startMin
            const endTime = selectedEvent.endHour * 60 + selectedEvent.endMin
            
            showRecurringDialog(selectedEvent as any, "delete", async (choice: string) => {
              if (choice === "only-this") {
                // Delete only this occurrence by splitting with empty updates
                const splitRecurringEvent = useEventsStore.getState().splitRecurringEvent
                await splitRecurringEvent(
                  selectedEvent as any,
                  eventDateStr,
                  startTime,
                  endTime,
                  {}
                )
              } else if (choice === "all-events" && selectedEvent.seriesMasterId) {
                // Delete all events in the series
                const deleteEvent = useEventsStore.getState().deleteEvent
                await deleteEvent(selectedEvent.seriesMasterId)
              } else if (choice === "this-and-following" && selectedEvent.seriesMasterId) {
                // Delete from this event onwards
                // Shorten original series to end before this event
                const prevDay = (() => {
                  const d = new Date(eventDateStr)
                  d.setDate(d.getDate() - 1)
                  return d.toISOString().split('T')[0]
                })()
                
                const updateEvent = useEventsStore.getState().updateEvent
                await updateEvent(selectedEvent.seriesMasterId, {
                  series_end_date: prevDay,
                })
              }
              setSelectedEvent(null)
              closeRecurringDialog()
            })
          } else {
            // Non-recurring existing events - delete
            deleteEvent(selectedEvent.id)
            setSelectedEvent(null)
          }
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [selectedEventId, deleteEvent, setSelectedEvent, localEvents, showRecurringDialog, closeRecurringDialog])

  // Handle click on calendar to create events
  const handleContainerClick = async (e: React.MouseEvent<HTMLDivElement>) => {
    if (isDraggingRef.current || isResizingRef.current || recentlyInteractedRef.current) return
    
    const target = e.target as HTMLElement
    
    if (target.closest(".calendar-event")) {
      return
    }
    
    if (selectedEventId) {
      // Check if this is a virtual event ID (format: "masterEventId-YYYY-MM-DD")
      const datePattern = /-(\d{4}-\d{2}-\d{2})$/
      const isVirtualEventId = datePattern.test(selectedEventId)
      
      // Only delete temp events that are in eventsCache (real events)
      // Virtual events should NOT be deleted - they're generated from master
      if (!isVirtualEventId) {
        const { eventsCache } = useEventsStore.getState()
        let eventInStore: any = null
        
        // Search in eventsCache (real events)
        for (const events of Object.values(eventsCache)) {
          const found = events.find(e => e.id === selectedEventId)
          if (found) {
            eventInStore = found
            break
          }
        }
        
        if (eventInStore && eventInStore.isTemp === true) {
          // Delete unsaved temp event immediately
          deleteEvent(selectedEventId)
          setSelectedEvent(null)
          justCreatedEventRef.current = null
          return
        }
      }
      
      // Don't deselect if we just created this event (saved event)
      if (justCreatedEventRef.current === selectedEventId) {
        justCreatedEventRef.current = null
        return
      }
      
      // Clicking on empty grid just deselects - doesn't delete
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
    
    // Save to store (local only - not saved to DB until Save/Enter)
    const dateStr = formatDate(selectedDate)
    const storeEvent = uiEventToStoreEvent(newUIEvent, dateStr)
    try {
      addEventLocal({
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
      // Event creation failed
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
    
    // Save original event state for cancel restore
    originalEventRef.current = {
      id: event.id,
      slot: event.slot,
      startHour: event.startHour,
      startMin: event.startMin,
      endHour: event.endHour,
      endMin: event.endMin,
      height: event.height
    }
    
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
    
    // Save original event state for cancel restore
    originalEventRef.current = {
      id: event.id,
      slot: event.slot,
      startHour: event.startHour,
      startMin: event.startMin,
      endHour: event.endHour,
      endMin: event.endMin,
      height: event.height
    }
    
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
          const start = yToTimeSnapped(snappedY)
          const end = yToTimeSnapped(snappedY + draggedEvent.height)
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
          const end = yToTimeSnapped(resizedEvent.slot + newHeight)
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
    // Handle drag/resize state - set full width for active event
    if (isDraggingRef.current || isResizingRef.current || draggingId || resizingId) {
      const activeId = draggingId || resizingId
      if (activeId) {
        const activeEl = document.getElementById(activeId) as HTMLDivElement | null
        if (activeEl) {
          activeEl.style.left = "0"
          activeEl.style.width = "100%"
          activeEl.style.zIndex = "9999"
        }
      }
      return
    }
    
    // Show container with fade-in (events already have correct positions from pre-calculation)
    setContainerVisible(true)
    
    // Apply animations for newly added events (user-created, not initial load)
    if (lastAddedEventId.current) {
      const newEl = document.getElementById(lastAddedEventId.current) as HTMLDivElement | null
      if (newEl) {
        newEl.style.transition = "opacity 150ms ease-out"
        newEl.style.opacity = "1"
        setTimeout(() => {
          newEl.style.transition = ""
        }, 150)
      }
      lastAddedEventId.current = null
    }
  }, [localEvents, draggingId, resizingId])

  // Handle drag/resize end - update state with final positions
  const handleMouseUp = () => {
    const wasDragging = isDraggingRef.current
    const wasResizing = isResizingRef.current
    let dialogShown = false
    
    // Handle click (no drag/resize happened)
    if (mouseDownPosRef.current && !wasDragging && !wasResizing) {
      const event = localEvents.find(ev => ev.id === mouseDownPosRef.current?.eventId)
      if (event) {
        // Check if there's a temp event selected that needs to be deleted
        if (selectedEventId && selectedEventId !== event.id) {
          // Check if previous selected event is unsaved temp event
          const { eventsCache } = useEventsStore.getState()
          const prevEventInStore = Object.values(eventsCache).flat().find(e => e.id === selectedEventId)
          if (prevEventInStore && prevEventInStore.isTemp === true) {
            deleteEvent(selectedEventId)
          }
        }
        setSelectedEvent(event.id)
      }
      mouseDownPosRef.current = null
      return
    }
    
    mouseDownPosRef.current = null
    
    if (!draggingId && !resizingId) return
    
    const wasDraggingId = draggingId
    const wasResizingId = resizingId
    
    // Helper to restore original event position - updates both DOM and store
    const restoreOriginalPosition = () => {
      const original = originalEventRef.current
      if (!original) return
      
      const eventId = original.id
      
      // Skip sync when restoring
      skipSyncRef.current = true
      
      // Update store with original times
      const originalStartTime = original.startHour * 60 + original.startMin
      const originalEndTime = original.endHour * 60 + original.endMin
      useEventsStore.getState().updateEventField(eventId, 'start_time', originalStartTime)
      useEventsStore.getState().updateEventField(eventId, 'end_time', originalEndTime)
      
      // Update DOM immediately for instant visual restore
      const el = document.getElementById(eventId) as HTMLDivElement | null
      if (el) {
        el.style.top = `${original.slot + TOP_DEAD_ZONE}px`
        el.style.height = `${original.height}px`
        el.style.left = "0"
        el.style.width = "100%"
        el.style.boxShadow = "none"
        el.style.zIndex = "20"
        el.style.transition = ""
      }
      
      // Also recalculate positions for all events to ensure correct widths
      const positions = calculateEventPositions(localEvents, eventId)
      setEventPositions(positions)
      
      originalEventRef.current = null
      
      // Reset skip sync after a delay
      setTimeout(() => {
        skipSyncRef.current = false
      }, 100)
    }
    
    // Get final DOM values and sync to store
    if (wasDraggingId && isDraggingRef.current) {
      const el = document.getElementById(wasDraggingId) as HTMLDivElement | null
      if (el) {
        const finalTop = parseInt(el.style.top || '0') - TOP_DEAD_ZONE
        const snappedY = snap(finalTop)
        const start = yToTimeSnapped(snappedY)
        const draggedEvent = localEvents.find(e => e.id === wasDraggingId)
        
        if (draggedEvent && selectedDate) {
          const end = yToTimeSnapped(snappedY + draggedEvent.height)
          const dateStr = formatDate(selectedDate)
          
          // Check if this is a recurring event INSTANCE (not the base master event)
          // Only show dialog for virtual instances (isRecurringInstance = true)
          const isRecurring = draggedEvent.isRecurringInstance === true
          
          if (isRecurring) {
            // Show recurring dialog - cleanup drag state immediately
            el.style.boxShadow = "none"
            removePlaceholder(wasDraggingId)
            isDraggingRef.current = false
            isResizingRef.current = false
            setDraggingId(null)
            setResizingId(null)
            unlockInteraction()
            dialogShown = true
            
            showRecurringDialog(
              draggedEvent as any,
              "edit",
              async (choice: string) => {
                // Cleanup after dialog closes
                el.style.boxShadow = "none"
                removePlaceholder(wasDraggingId)
                isDraggingRef.current = false
                isResizingRef.current = false
                setDraggingId(null)
                setResizingId(null)
                unlockInteraction()
                
                // Delay resetting recentlyInteracted to prevent stray clicks creating events
                const resetInteraction = () => {
                  setTimeout(() => {
                    recentlyInteractedRef.current = false
                  }, 100)
                }
                
                if (choice === "cancel") {
                  // Restore original position - DOM update is immediate
                  restoreOriginalPosition()
                  // Use flushSync for immediate deselect
                  ReactDOM.flushSync(() => {
                    setSelectedEvent(null)
                  })
                  resetInteraction()
                } else if (choice === "only-this") {
                  // Split the recurring event into 3 events
                  const splitRecurringEvent = useEventsStore.getState().splitRecurringEvent
                  await splitRecurringEvent(
                    draggedEvent as any,
                    dateStr,
                    start.hour * 60 + start.min,
                    end.hour * 60 + end.min
                  )
                  originalEventRef.current = null
                  setSelectedEvent(null)
                  resetInteraction()
                } else if (choice === "all-events" && draggedEvent.seriesMasterId) {
                  // Update all events in the series
                  const updateAllInSeries = useEventsStore.getState().updateAllInSeries
                  await updateAllInSeries(draggedEvent.seriesMasterId, {
                    start_time: start.hour * 60 + start.min,
                    end_time: end.hour * 60 + end.min,
                  })
                  originalEventRef.current = null
                  resetInteraction()
                } else if (choice === "this-and-following" && draggedEvent.seriesMasterId) {
                  // Split into 2 recurring series
                  const updateThisAndFollowing = useEventsStore.getState().updateThisAndFollowing
                  await updateThisAndFollowing(
                    draggedEvent as any,
                    dateStr,
                    start.hour * 60 + start.min,
                    end.hour * 60 + end.min
                  )
                  originalEventRef.current = null
                  setSelectedEvent(null)
                  resetInteraction()
                }
                
                closeRecurringDialog()
              }
            )
            
            return
          } else {
            // Non-recurring: update directly
            updateEvent(wasDraggingId, {
              title: draggedEvent.title,
              date: dateStr,
              start_time: start.hour * 60 + start.min,
              end_time: end.hour * 60 + end.min,
            })
          }
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
           const end = yToTimeSnapped(resizedEvent.slot + snappedHeight)
          const dateStr = formatDate(selectedDate)
          
          // Check if this is a recurring event INSTANCE (not the base master event)
          // Only show dialog for virtual instances (isRecurringInstance = true)
          const isRecurring = resizedEvent.isRecurringInstance === true
          
          if (isRecurring) {
            // Show recurring dialog - cleanup resize state immediately
            el.style.boxShadow = "none"
            isDraggingRef.current = false
            isResizingRef.current = false
            setDraggingId(null)
            setResizingId(null)
            unlockInteraction()
            dialogShown = true
            
            showRecurringDialog(
              resizedEvent as any,
              "edit",
              async (choice: string) => {
                // Cleanup after dialog closes
                el.style.boxShadow = "none"
                isDraggingRef.current = false
                isResizingRef.current = false
                setDraggingId(null)
                setResizingId(null)
                unlockInteraction()
                
                // Delay resetting recentlyInteracted to prevent stray clicks creating events
                const resetInteraction = () => {
                  setTimeout(() => {
                    recentlyInteractedRef.current = false
                  }, 100)
                }
                
                if (choice === "cancel") {
                  // Restore original position - DOM update is immediate
                  restoreOriginalPosition()
                  // Use flushSync for immediate deselect
                  ReactDOM.flushSync(() => {
                    setSelectedEvent(null)
                  })
                  resetInteraction()
                } else if (choice === "only-this") {
                  // Split the recurring event into 3 events
                  const splitRecurringEvent = useEventsStore.getState().splitRecurringEvent
                  await splitRecurringEvent(
                    resizedEvent as any,
                    dateStr,
                    resizedEvent.startHour * 60 + resizedEvent.startMin,
                    end.hour * 60 + end.min
                  )
                  originalEventRef.current = null
                  setSelectedEvent(null)
                  resetInteraction()
                } else if (choice === "all-events" && resizedEvent.seriesMasterId) {
                  // Update all events in the series
                  const updateAllInSeries = useEventsStore.getState().updateAllInSeries
                  await updateAllInSeries(resizedEvent.seriesMasterId, {
                    end_time: end.hour * 60 + end.min,
                  })
                  originalEventRef.current = null
                  resetInteraction()
                } else if (choice === "this-and-following" && resizedEvent.seriesMasterId && selectedDate) {
                  // Split into 2 recurring series
                  const updateThisAndFollowing = useEventsStore.getState().updateThisAndFollowing
                  await updateThisAndFollowing(
                    resizedEvent as any,
                    dateStr,
                    resizedEvent.startHour * 60 + resizedEvent.startMin,
                    end.hour * 60 + end.min
                  )
                  originalEventRef.current = null
                  setSelectedEvent(null)
                  resetInteraction()
                } else {
                  // Fallback - reset interaction
                  resetInteraction()
                }
                
                closeRecurringDialog()
              }
            )
            
            return
          } else {
            // Non-recurring: update directly
            updateEvent(wasResizingId, {
              title: resizedEvent.title,
              date: dateStr,
              start_time: resizedEvent.startHour * 60 + resizedEvent.startMin,
              end_time: end.hour * 60 + end.min,
            })
          }
        }

        // Cleanup styles
        el.style.boxShadow = "none"
      }
    }

    // Skip final cleanup if dialog was shown - let the dialog callback handle it
    if (dialogShown) {
      setTimeout(() => {
        recentlyInteractedRef.current = false
      }, 100)
      return
    }

    isDraggingRef.current = false
    isResizingRef.current = false
    setDraggingId(null)
    setResizingId(null)
    unlockInteraction()
    setSelectedEvent(null)
    originalEventRef.current = null
    
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
    <>
      <div
        onClick={handleContainerClick}
        className="absolute inset-0 calendar-container"
        style={{ 
          zIndex: 10,
          opacity: containerVisible ? 1 : 0,
          transition: 'opacity 150ms ease-out'
        }}
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
                position={eventPositions[event.id] || { left: "0", width: "100%", zIndex: 10 }}
              />
            )
          })}
      </div>

      {recurringDialogOpen && recurringDialogEvent && recurringDialogActionType && (
        <RecurringActionDialog
          open={recurringDialogOpen}
          onChoice={(choice) => {
            // Get the callback from store and call it
            const callback = useEventsStore.getState().recurringDialogCallback
            if (callback) {
              callback(choice)
            }
          }}
          actionType={recurringDialogActionType}
          eventTitle={recurringDialogEvent?.title || ""}
        />
      )}
    </>
  )
}

export default TimeView
