import { useTimeStore } from "@/store/timeStore"
import { useEventsStore, formatDate } from "@/store/eventsStore"
import TimeLine from "./TimeLine"
import TimeView from "./TimeView"
import { useEffect, useRef, useMemo } from "react"
import { TOP_DEAD_ZONE } from "@/lib/eventUtils"

const DayView = () => {
  const dateInfo = useTimeStore((state) => state.dateInfo)
  const selectedDate = useTimeStore((state) => state.selectedDate)
  const eventsCache = useEventsStore((state) => state.eventsCache)
  const setSelectedEvent = useEventsStore((state) => state.setSelectedEvent)
  const scrollRef = useRef<HTMLDivElement>(null)
  const hourHeight = 100

  // Get all-day events for selected date
  const allDayEvents = useMemo(() => {
    if (!selectedDate) return []
    const dateKey = formatDate(selectedDate)
    const events = eventsCache[dateKey] || []
    
    return events.filter(event => {
      const endDate = event.end_date || event.date
      const isMultiDay = endDate > event.date
      
      // Calculate duration
      let durationMinutes: number
      if (event.end_time >= event.start_time) {
        durationMinutes = event.end_time - event.start_time
      } else {
        durationMinutes = (1440 - event.start_time) + event.end_time
      }
      const durationHours = durationMinutes / 60
      const isFullDay = durationHours >= 24

      return event.is_all_day || isMultiDay || isFullDay
    })
  }, [selectedDate, eventsCache])

  const handleAllDayEventClick = (eventId: string) => {
    setSelectedEvent(eventId)
  }

  const prevDateRef = useRef<string | null>(null)

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
      <div className="h-[100%] w-[100%] rounded-l-2xl bg-neutral-800 shadow-xl flex flex-col overflow-hidden">
        {/* HEADER */}
        <div className="px-9 pt-27 pb-3 border-b border-white/20 shrink-0">
          <h1 className="text-6xl pb-7 font-semibold text-neutral-900 tracking-tight">
          <span
  style={{ fontFamily: "SF Pro Display Bold" }}
  className="text-white"
>
              {dateInfo?.monthName} {dateInfo?.day},
            </span>
            <span

  style={{ fontFamily: "SF Pro Display light" }}
            className="font-extralight text-neutral-300"> {dateInfo?.year}</span>
          </h1>
          <p className="mt-2 text-3xl text-neutral-200">{dateInfo?.dayName}</p>
        </div>

        {/* ALL-DAY EVENTS STICKY ROW */}
        {allDayEvents.length > 0 && (
<div className="px-4 py-2 bg-neutral-800 border-b border-white/10 shrink-0">
            <div className="flex flex-wrap gap-2 overflow-x-auto">
              {allDayEvents.map((event) => (
                <div
                  key={event.id}
                  onClick={() => handleAllDayEventClick(eventId)}
                  className="px-3 py-1 bg-pink-500 text-white text-sm font-medium rounded-full cursor-pointer hover:bg-pink-400 transition-colors whitespace-nowrap"
                >
                  {event.title}
                </div>
              ))}
            </div>
          </div>
        )}

{/* SCROLL AREA */}
<div ref={scrollRef} className="flex-1 overflow-y-auto no-scrollbar">
  <div className="bg-neutral-900 px-4 relative">
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
            <span className="text-white text-xl font-space-mono">
              {hour.toString().padStart(2, "0")}
              <span className="text-gray-500 text-lg">:00</span>
            </span>
          </div>
        ))}
      </div>

      {/* 📅 RIGHT COLUMN — GRID + EVENTS */}
<div className="flex-1 relative">
  {/* FIRST LINE (00:00) */}
  <div className="h-[1px] bg-neutral-600 mt-12" />

  {/* Remaining hour lines */}
  {gridLines.map((i) => (
    <div
      key={i}
      className="h-[1px] bg-neutral-600"
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

