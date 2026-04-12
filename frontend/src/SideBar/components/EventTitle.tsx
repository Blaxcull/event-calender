import React, { useRef, useEffect } from 'react'
import { useEventsStore } from '@/store/eventsStore'
import { useTimeStore } from '@/store/timeStore'
import { useGoalsStore, resolveGoalColorForEvent, resolveGoalIconForEvent } from '@/store/goalsStore'
import { getGoalIcon } from '@/Goal_view/goal'
import EventEditor from './EventEditor'
import DateTimeEditor from './DateTimeEditor'
import GoalPanel from './GoalSetter'
import RepeatReminderPanel from './RepeatReminderPanel'
import { getEventDurationMinutes } from '@/lib/eventUtils'

const EventTitle: React.FC = () => {
  const selectedEventId = useEventsStore((state) => state.selectedEventId)
  const setSelectedEvent = useEventsStore((state) => state.setSelectedEvent)
  const setScrollToEventId = useEventsStore((state) => state.setScrollToEventId)
  const setScrollToTop = useEventsStore((state) => state.setScrollToTop)
  const getEventsForDate = useEventsStore((state) => state.getEventsForDate)
  const liveEventTimes = useEventsStore((state) => state.liveEventTimes)
  const eventsCache = useEventsStore((state) => state.eventsCache)
  const computedEventsCache = useEventsStore((state) => state.computedEventsCache)
  const selectedDate = useTimeStore((state) => state.selectedDate)
  const goalsStore = useGoalsStore((state) => state.store)
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  
  // Scroll to top when a new event is selected
  useEffect(() => {
    if (selectedEventId && scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = 0
    }
  }, [selectedEventId])

  const todaysEvents = selectedDate ? getEventsForDate(selectedDate) : []
  const eventsWithLiveTimes = todaysEvents.map((event) => {
    const live = liveEventTimes[event.id]
    if (!live) return event
    return {
      ...event,
      start_time: live.start_time,
      end_time: live.end_time,
    }
  })
  const sortedEvents = [...eventsWithLiveTimes].sort((a, b) => {
    const aEndDate = a.end_date || a.date
    const bEndDate = b.end_date || b.date
    const aIsMultiDay = aEndDate > a.date
    const bIsMultiDay = bEndDate > b.date
    const aIsAllDay = a.is_all_day || getEventDurationMinutes(a) >= 1440
    const bIsAllDay = b.is_all_day || getEventDurationMinutes(b) >= 1440

    const rank = (isMultiDay: boolean, isAllDay: boolean) => {
      if (isMultiDay) return 0
      if (isAllDay) return 1
      return 2
    }

    const rankDiff = rank(aIsMultiDay, aIsAllDay) - rank(bIsMultiDay, bIsAllDay)
    if (rankDiff !== 0) return rankDiff
    return a.start_time - b.start_time
  })

  const handleEventClick = (eventId: string) => {
    const event = eventsWithLiveTimes.find(e => e.id === eventId)
    const isAllDay = event && (
      event.is_all_day ||
      getEventDurationMinutes(event) >= 1440
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

  const formatShortDate = (dateStr: string): string => {
    const d = new Date(`${dateStr}T00:00:00`)
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
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
          <div className="w-full max-w-[420px] rounded-[30px] border border-neutral-200 bg-gradient-to-br from-white via-[#f5f4f2] to-[#ece9e4] px-7 py-8 shadow-[0_18px_40px_rgba(0,0,0,0.05)]">
            <div className="flex items-start gap-4">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-white/80 shadow-sm ring-1 ring-black/5">
                <svg className="h-7 w-7 text-neutral-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M8 7V3m8 4V3m-9 8h10m-11 9h12a2 2 0 002-2V7a2 2 0 00-2-2H6a2 2 0 00-2 2v11a2 2 0 002 2z" />
                </svg>
              </div>
              <div className="min-w-0">
                <p className="text-base font-semibold text-neutral-800">No events for this day</p>
                <p className="mt-1 text-sm leading-6 text-neutral-500">
                  Your schedule is clear here. Add an event in day view and it will show up in this panel.
                </p>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="overflow-y-auto no-scrollbar flex-1">
          <div className="pb-3 space-y-2.5">
            {sortedEvents.map((event) => {
              const endDate = event.end_date || event.date
              const isMultiDay = endDate > event.date
              const isAllDay = event.is_all_day || getEventDurationMinutes(event) >= 1440
              const isRecurring = (event as any).isRecurringInstance || (event.repeat && event.repeat !== 'None')
              const resolvedGoalColor = resolveGoalColorForEvent(goalsStore, event)
              const resolvedGoalIcon = resolveGoalIconForEvent(goalsStore, event)
              const eventGoalIcon = event.goalIcon || resolvedGoalIcon
              const goalIconEntry = eventGoalIcon ? getGoalIcon(eventGoalIcon) : null
              const GoalIcon = goalIconEntry?.icon
              const startLabel = isMultiDay
                ? 'Multi Day'
                : isAllDay
                ? 'All Day'
                : formatTime(event.start_time)
              const endLabel = isAllDay || isMultiDay
                ? ''
                : formatTime(event.end_time)
              const multiDayRangeLabel = `${formatShortDate(event.date)} - ${formatShortDate(endDate)}`

              return (
                <div
                  key={event.id}
                  onClick={() => handleEventClick(event.id)}
                  className="group cursor-pointer rounded-[28px] border border-neutral-200/70 bg-[#f7f5f1] px-4 py-3.5 transition-all duration-200 hover:border-neutral-300 hover:bg-[#fbfaf7] hover:shadow-[0_10px_24px_rgba(0,0,0,0.04)]"
                >
                  <div className="grid grid-cols-[84px_minmax(0,1fr)] items-start gap-4">
                    <div className="flex flex-col items-start justify-start rounded-[20px] bg-white/90 px-3 py-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.7)] ring-1 ring-black/[0.04]">
                      <div className="text-[14px] font-semibold text-neutral-900 leading-none">
                        {startLabel}
                      </div>
                      {!isAllDay && (
                        <div className="mt-1.5 text-[10px] uppercase tracking-[0.16em] text-neutral-400">
                          {endLabel}
                        </div>
                      )}
                    </div>

                    <div className="min-w-0 flex flex-col justify-center pt-0.5">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2.5 min-w-0">
                            {GoalIcon ? (
                              <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-[14px] bg-white text-neutral-600 ring-1 ring-black/[0.05]">
                                <GoalIcon className="h-3.5 w-3.5" />
                              </div>
                            ) : null}
                            <div className="truncate text-[16px] font-semibold tracking-[-0.01em] text-neutral-900">
                              {event.title || 'Untitled'}
                            </div>
                          </div>

                          <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs text-neutral-500">
                            {!isAllDay && (
                              <span className="rounded-full bg-white/95 px-2.5 py-1 font-medium ring-1 ring-black/[0.05]">
                                {getDuration(event.start_time, event.end_time)}
                              </span>
                            )}
                            {isMultiDay && (
                              <span className="rounded-full bg-white/95 px-2.5 py-1 font-medium ring-1 ring-black/[0.05]">
                                {multiDayRangeLabel}
                              </span>
                            )}
                            {isRecurring && (
                              <span className="inline-flex items-center gap-1 rounded-full bg-white/95 px-2.5 py-1 font-medium ring-1 ring-black/[0.05]">
                                <svg className="h-3.5 w-3.5 text-neutral-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                </svg>
                                Repeat
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {event.location && (
                        <div className="mt-2.5 flex items-center gap-1.5 text-[13px] text-neutral-500">
                          <svg className="h-4 w-4 shrink-0 text-neutral-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                          </svg>
                          <span className="truncate">{event.location}</span>
                        </div>
                      )}

                    </div>
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
