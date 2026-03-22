import React, { useRef, useEffect } from 'react'
import { useEventsStore } from '@/store/eventsStore'
import { useTimeStore } from '@/store/timeStore'
import EventEditor from './EventEditor'
import DateTimeEditor from './DateTimeEditor'
import GoalPanel from './GoalSetter'
import RepeatReminderPanel from './RepeatReminderPanel'

const EventTitle: React.FC = () => {
  const selectedEventId = useEventsStore((state) => state.selectedEventId)
  const setSelectedEvent = useEventsStore((state) => state.setSelectedEvent)
  const selectedDate = useTimeStore((state) => state.selectedDate)
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  
  // Subscribe to the entire store state to ensure reactivity
  const storeState = useEventsStore()
  
  // Scroll to top when a new event is selected
  useEffect(() => {
    if (selectedEventId && scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = 0
    }
  }, [selectedEventId])

  // Get events for selected date - use useMemo with selectedDate as key
  const todaysEvents = React.useMemo(() => {
    if (!selectedDate) return []
    return storeState.getEventsForDate(selectedDate)
  }, [selectedDate, storeState.eventsCache, storeState.computedEventsCache])

  // Sort events by start time
  const sortedEvents = [...todaysEvents].sort((a, b) => a.start_time - b.start_time)

  const formatTime = (minutes: number): string => {
    const hours = Math.floor(minutes / 60)
    const mins = minutes % 60
    const period = hours >= 12 ? 'PM' : 'AM'
    const displayHours = hours === 0 ? 12 : hours > 12 ? hours - 12 : hours
    return `${displayHours}:${mins.toString().padStart(2, '0')} ${period}`
  }

  const handleEventClick = (eventId: string) => {
    setSelectedEvent(eventId)
  }

  // If an event is selected, show the editor
  if (selectedEventId) {
    return (
      <div ref={scrollContainerRef} className="px-0 flex-1 overflow-y-auto no-scrollbar">
        <EventEditor />
        <DateTimeEditor />
        <GoalPanel />
        <RepeatReminderPanel />
      </div>
    )
  }

  // Otherwise, show list of today's events
  return (
    <div className="px-4 flex-1 flex flex-col min-h-0">
      <h3 className="text-lg font-semibold text-slate-800 mb-3 shrink-0">
        {selectedDate ? (
          <>
            Events for{' '}
            {selectedDate.toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
            })}
          </>
        ) : (
          'Events'
        )}
      </h3>

      {sortedEvents.length === 0 ? (
        <p className="text-slate-600 text-sm">No events for this day</p>
      ) : (
        <div className="overflow-y-auto no-scrollbar flex-1">
          <div className="space-y-2 pb-3">
            {sortedEvents.map((event) => (
              <div
                key={event.id}
                onClick={() => handleEventClick(event.id)}
                className="p-2.5 bg-gray-200/50 hover:bg-gray-200 rounded-lg cursor-pointer transition-colors"
              >
                <div className="font-medium text-slate-800 text-sm">{event.title}</div>
                <div className="text-xs text-slate-600 mt-1">
                  {formatTime(event.start_time)} - {formatTime(event.end_time)}
                </div>
                {event.notes && (
                  <div className="text-xs text-slate-500 mt-1 truncate">{event.notes}</div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export default EventTitle
