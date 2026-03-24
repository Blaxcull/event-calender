import { useTimeStore } from "@/store/timeStore"
import { useEventsStore, formatDate } from "@/store/eventsStore"
import TimeLine from "./TimeLine"
import TimeView from "./TimeView"
import { useEffect, useRef, useMemo, useState } from "react"
import { TOP_DEAD_ZONE } from "@/lib/eventUtils"

const DayView = () => {
  const dateInfo = useTimeStore((state) => state.dateInfo)
  const selectedDate = useTimeStore((state) => state.selectedDate)
  const getEventsForDate = useEventsStore((state) => state.getEventsForDate)
  const setSelectedEvent = useEventsStore((state) => state.setSelectedEvent)
  const selectedEventId = useEventsStore((state) => state.selectedEventId)
  const scrollToEventId = useEventsStore((state) => state.scrollToEventId)
  const scrollToTop = useEventsStore((state) => state.scrollToTop)
  const getEventById = useEventsStore((state) => state.getEventById)
  const setScrollToEventId = useEventsStore((state) => state.setScrollToEventId)
  const setScrollToTop = useEventsStore((state) => state.setScrollToTop)
  // Subscribe to eventsCache to trigger re-renders when events change
  useEventsStore((state) => state.eventsCache)
  const scrollRef = useRef<HTMLDivElement>(null)
  const hourHeight = 100

  // Compute all-day events for selected date
  const allDayEvents = (() => {
    if (!selectedDate) return []
    const events = getEventsForDate(selectedDate)

    const filtered = events.filter(event => {
      const endDate = event.end_date || event.date
      const isMultiDay = endDate > event.date

      let durationMinutes: number
      if (event.end_time >= event.start_time) {
        durationMinutes = event.end_time - event.start_time
      } else {
        durationMinutes = (1440 - event.start_time) + event.end_time
      }
      const isFullDay = durationMinutes / 60 >= 24

      return event.is_all_day || isMultiDay || isFullDay
    })

    // Multi-day events above single-day all-day events
    return filtered.sort((a, b) => {
      const aEnd = a.end_date || a.date
      const bEnd = b.end_date || b.date
      const aIsMultiDay = aEnd > a.date
      const bIsMultiDay = bEnd > b.date
      if (aIsMultiDay && !bIsMultiDay) return -1
      if (!aIsMultiDay && bIsMultiDay) return 1
      return 0
    })
  })()

  const handleAllDayEventClick = (eventId: string) => {
    setScrollToTop(true)
    setSelectedEvent(eventId)
  }

  // Format multi-day event date range (e.g., "Mar 20-22" or "Mar 30 - Apr 1")
  const formatDateRange = (startDate: string, endDate: string): string => {
    const start = new Date(startDate + 'T00:00:00')
    const end = new Date(endDate + 'T00:00:00')
    const startMonth = start.toLocaleDateString('en-US', { month: 'short' })
    const endMonth = end.toLocaleDateString('en-US', { month: 'short' })
    const startDay = start.getDate()
    const endDay = end.getDate()
    if (startMonth === endMonth) {
      return `${startMonth} ${startDay}-${endDay}`
    }
    return `${startMonth} ${startDay} - ${endMonth} ${endDay}`
  }

  const prevDateRef = useRef<string | null>(null)
  const [showAllAllDay, setShowAllAllDay] = useState(false)

  useEffect(() => {
    setShowAllAllDay(false)
  }, [selectedDate])

  useEffect(() => {
    if (!selectedDate || !scrollRef.current) return

    const currentDateStr = selectedDate.toDateString()
    
    if (prevDateRef.current === currentDateStr) return
    prevDateRef.current = currentDateStr

    const isToday = currentDateStr === new Date().toDateString()
    if (!isToday) return

    const now = new Date()
    const totalMinutes = now.getHours() * 60 + now.getMinutes()
    const scrollPosition = TOP_DEAD_ZONE + totalMinutes * (hourHeight / 60) - 200

    scrollRef.current.scrollTop = Math.max(0, scrollPosition)
  }, [selectedDate])

  useEffect(() => {
    if (!scrollToEventId || !scrollRef.current) return
    const event = getEventById(scrollToEventId)
    if (!event) return
    const scrollPosition = TOP_DEAD_ZONE + event.start_time * (hourHeight / 60) - 100
    scrollRef.current.scrollTop = Math.max(0, scrollPosition)
    setScrollToEventId(null)
  }, [scrollToEventId, getEventById, setScrollToEventId])

  useEffect(() => {
    if (!scrollToTop || !scrollRef.current) return
    scrollRef.current.scrollTop = 0
    setScrollToTop(false)
  }, [scrollToTop, setScrollToTop])

  // Memoize hour grid arrays to prevent recreation on every render
  const hourSlots = useMemo(() => 
    Array.from({ length: 24 }, (_, i) => i),
  [])

  const gridLines = useMemo(() => 
    Array.from({ length: 23 }, (_, i) => i),
  [])

  return (
    <div className="h-full w-full bg-white flex items-center justify-center overflow-hidden select-none">
      {/* APP WINDOW */}
      <div className="h-[100%] w-[100%] rounded-l-2xl bg-gray-100 shadow-xl flex flex-col overflow-hidden">
        {/* HEADER */}
        <div className="px-9 pt-32 pb-3 border-b border-white/20 shrink-0">
          <h1 className="text-6xl pb-7 font-semibold text-neutral-800 tracking-tight">
          <span
  style={{ fontFamily: "SF Pro Display Bold" }}
  className="text-black"
>
              {dateInfo?.monthName} {dateInfo?.day},
            </span>
            <span

  style={{ fontFamily: "SF Pro Display light" }}
            className="font-extralight text-neutral-400"> {dateInfo?.year}</span>
          </h1>
          <p className="mt-2 text-3xl text-neutral-700">{dateInfo?.dayName}</p>
        </div>


{/* SCROLL AREA */}
<div ref={scrollRef} className="flex-1 overflow-y-auto no-scrollbar">




  <div className="bg-gray-200 px-4 relative">


        {/* ALL-DAY EVENTS ROW */}
        {allDayEvents.length > 0 && (() => {
          const visibleEvents = showAllAllDay ? allDayEvents : allDayEvents.slice(0, 2)
          return (
          <div className="shrink-0 text-white rounded-l-2xl flex flex-col gap-0.5">
            {visibleEvents.map((event, index) => {
              const endDate = event.end_date || event.date
              const isMultiDay = endDate > event.date
let shapeClass = ''

if (isMultiDay && selectedDate) {
  const currentDate = formatDate(selectedDate)

  if (currentDate === event.date) {
    shapeClass = 'event-start'
  } else if (currentDate === endDate) {
    shapeClass = 'event-end'
  } else {
    shapeClass = 'event-middle'
  }
} else {
  shapeClass = 'event-same-day'
}

              const showArrow = allDayEvents.length > 2 && index === visibleEvents.length - 1
              const isSelected = selectedEventId === event.id

              return (
                <div key={event.id} className="flex items-center">
                  <div className="w-[70px] shrink-0 flex items-center justify-center">
                    {showArrow && (
                      <button
                        onClick={() => setShowAllAllDay(prev => !prev)}
                        className="w-6 h-6 flex items-center justify-center rounded hover:bg-white/20 transition-colors"
                      >
                        <svg className={`w-4 h-4 text-black transition-transform ${showAllAllDay ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </button>
                    )}
                  </div>
                  <div
                    onClick={() => handleAllDayEventClick(event.id)}
                    className={`relative flex-1 px-3 py-1.5 text-s font-medium cursor-pointer  truncate flex items-center gap-2 bg-[#f792bb] box-border ${isSelected ? 'event-same-day outline-2 outline-white' : shapeClass}`}
                  >
                    <span className="truncate">{event.title},</span>
                    {isMultiDay && (
                      <span className="text-s opacity-70 shrink-0">{formatDateRange(event.date, endDate)}</span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
          )
        })()}


    <TimeLine />

    <div className="pb-17 flex relative">
      
      {/* ⏰ LEFT COLUMN — TIME */}
      <div className="w-[72px] shrink-0">
        {hourSlots.map((hour) => (
          <div
            key={hour}
            className="flex items-center justify-end pr-3 "
            style={{ height: `${hourHeight}px` }}
          >
            <span className="text-black text-xl font-space-mono">
              {hour.toString().padStart(2, "0")}
              <span className="text-gray-600 text-lg">:00</span>
            </span>
          </div>
        ))}
      </div>

      {/* 📅 RIGHT COLUMN — GRID + EVENTS */}
<div className="flex-1 relative">
  {/* FIRST LINE (00:00) */}
  <div className="h-[1px] bg-gray-300 mt-12" />

  {/* Remaining hour lines */}
  {gridLines.map((i) => (
    <div
      key={i}
      className="h-[1px] bg-gray-300"
      style={{ marginTop: `${hourHeight - 1}px` }}
    />
  ))}

  <TimeView />

    <div className="h-[10px] w-full" />
</div>
    </div>
  </div>
</div>
      </div>
    </div>
  )
}

export default DayView

