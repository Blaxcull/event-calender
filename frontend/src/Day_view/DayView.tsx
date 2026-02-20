import { useTimeStore } from "@/store/timeStore"
import TimeLine from "./TimeLine"
import TimeView from "./TimeView"
import { useEffect, useRef, useMemo } from "react"
import { TOP_DEAD_ZONE } from "@/lib/eventUtils"

const DayView = () => {
  const dateInfo = useTimeStore((state) => state.dateInfo)
  const selectedDate = useTimeStore((state) => state.selectedDate)
  const scrollRef = useRef<HTMLDivElement>(null)
  const hourHeight = 100

  useEffect(() => {
    if (!selectedDate || !scrollRef.current) return

    const isToday = selectedDate.toDateString() === new Date().toDateString()
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
        <div className="px-10 pt-30 pb-4 border-b border-white/20 shrink-0">
          <h1 className="text-7xl pb-8 font-semibold text-neutral-900 tracking-tight">
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
          <p className="mt-3 text-4xl text-neutral-200">{dateInfo?.dayName}</p>
        </div>

{/* SCROLL AREA */}
<div ref={scrollRef} className="flex-1 overflow-y-auto no-scrollbar">
  <div className="bg-neutral-900 px-4 relative">
    <TimeLine />

    <div className="pb-17 flex relative">
      
      {/* ⏰ LEFT COLUMN — TIME */}
      <div className="w-20 shrink-0">
        {hourSlots.map((hour) => (
          <div
            key={hour}
            className="flex items-center justify-end pr-3 "
            style={{ height: `${hourHeight}px` }}
          >
            <span className="text-white text-2xl font-space-mono">
              {hour.toString().padStart(2, "0")}
              <span className="text-gray-500 text-xl">:00</span>
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

