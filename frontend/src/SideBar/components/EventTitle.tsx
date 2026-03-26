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
  const setScrollToEventId = useEventsStore((state) => state.setScrollToEventId)
  const setScrollToTop = useEventsStore((state) => state.setScrollToTop)
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

  const handleEventClick = (eventId: string) => {
    const event = todaysEvents.find(e => e.id === eventId)
    const isAllDay = event && (
      event.is_all_day ||
      (event.end_date || event.date) > event.date ||
      (event.end_time - event.start_time + (event.end_time < event.start_time ? 1440 : 0)) / 60 >= 24
    )
    if (isAllDay) {
      setScrollToTop(true)
    } else {
      setScrollToEventId(eventId)
    }
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
  const formatTime = (minutes: number): string => {
    const hours = Math.floor(minutes / 60)
    const mins = minutes % 60
    const period = hours >= 12 ? 'PM' : 'AM'
    const displayHours = hours === 0 ? 12 : hours > 12 ? hours - 12 : hours
    return `${displayHours}:${mins.toString().padStart(2, '0')} ${period}`
  }

  const getTimeRange = (start: number, end: number): string => {
    return `${formatTime(start)} - ${formatTime(end)}`
  }

  const getDuration = (start: number, end: number): string => {
    let diff = end - start
    if (diff < 0) diff += 1440
    const hours = Math.floor(diff / 60)
    const mins = diff % 60
    if (hours === 0) return `${mins}m`
    if (mins === 0) return `${hours}h`
    return `${hours}h ${mins}m`
  }

  return (
    <div className="px-6 flex-1 flex flex-col min-h-0">
      <h3 className="text-m px-2 font-semibold text-slate-400 uppercase tracking-wider mb-3 shrink-0">
        {selectedDate ? (
          selectedDate.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
          })
        ) : (
          'Events'
        )}
      </h3>

      {sortedEvents.length === 0 ? (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-slate-400 text-sm">No events</p>
        </div>
      ) : (
        <div className="overflow-y-auto no-scrollbar flex-1">
          <div className="space-y-2 pb-3">
            {sortedEvents.map((event) => {
              const isAllDay = event.is_all_day || (event.end_date || event.date) > event.date
              const isRecurring = (event as any).isRecurringInstance || (event.repeat && event.repeat !== 'None')

              return (
                <div
                  key={event.id}
                  onClick={() => handleEventClick(event.id)}
                  className="group relative rounded-2xl bg-white border border-neutral-100 hover:border-neutral-200 shadow-sm hover:shadow-md cursor-pointer transition-all duration-200 overflow-hidden"
                >
                  <div className="px-4 py-3">
                    {/* Time row */}
                    <div className="flex items-center justify-between mb-1.5">
                      {isAllDay ? (
                        <div className="flex items-center gap-1.5">
                          <svg className="w-4 h-4 text-neutral-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          <span className="text-sm font-medium text-neutral-400 uppercase tracking-wide">All day</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5">
                          <svg className="w-4 h-4 text-neutral-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          <span className="text-sm font-medium text-neutral-500">
                            {getTimeRange(event.start_time, event.end_time)}
                          </span>
                        </div>
                      )}
                      <div className="flex items-center gap-1.5">
                        {isRecurring && (
                          <svg className="w-4 h-4 text-neutral-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                          </svg>
                        )}
                        {!isAllDay && (
                          <span className="text-sm text-neutral-400">
                            {getDuration(event.start_time, event.end_time)}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Title */}
                    <div className="font-semibold text-base text-neutral-800 truncate">
                      {event.title || 'Untitled'}
                    </div>

                    {/* Location */}
                    {event.location && (
                      <div className="flex items-center gap-1.5 mt-1.5">
                        <svg className="w-4 h-4 text-neutral-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                        <span className="text-sm text-neutral-400 truncate">{event.location}</span>
                      </div>
                    )}

                    {/* Notes preview */}
                    {event.notes && (
                      <div className="text-sm text-neutral-400 mt-1.5 truncate">
                        {event.notes}
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

export default EventTitle
