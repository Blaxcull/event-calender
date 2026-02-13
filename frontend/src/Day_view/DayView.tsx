import { useTimeStore } from "@/store/timeStore"
import TimeLine from "./TimeLine"
import TimeView from "./TimeView" // your click-to-add-event component
import type { EventType } from "@/lib/eventUtils"

interface DayViewProps {
  initialEvents?: EventType[]
}

const DayView = ({ initialEvents = [] }: DayViewProps) => {
  const dateInfo = useTimeStore((state) => state.dateInfo)
  const hourHeight = 100// must match TimeLine

  
  return (
    <div className="h-full w-full bg-white flex items-center justify-center overflow-hidden select-none ">
      {/* APP WINDOW */}
      <div className="h-[100%] w-[100%] rounded-l-2xl bg-neutral-800 shadow-xl flex flex-col">
        {/* HEADER */}
        <div className="px-10 pt-30 pb-4 border-b border-white/20 ">
          <h1 className="text-6xl pb-8 font-semibold text-neutral-900 tracking-tight">
            <span className="font-bold text-white">
              {dateInfo?.monthName} {dateInfo?.day},
            </span>
            <span className="font-normal text-neutral-300"> {dateInfo?.year}</span>
          </h1>
          <p className="mt-3 text-4xl text-neutral-200">{dateInfo?.dayName}</p>
        </div>

{/* SCROLL AREA */}
{/* SCROLL AREA */}
<div className="flex-1 overflow-y-auto no-scrollbar">
  <div className="bg-neutral-900 px-4 relative">
    <TimeLine />

    <div className="pb-17 flex relative">
      
      {/* ⏰ LEFT COLUMN — TIME */}
      <div className="w-20 shrink-0">
        {Array.from({ length: 24 }, (_, i) => {
          const hour = i
          return (
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
          )
        })}
      </div>

      {/* 📅 RIGHT COLUMN — GRID + EVENTS */}
<div className="flex-1 relative">
  {/* FIRST LINE (00:00) */}
  <div className="h-[1px] bg-neutral-600 mt-12" />

  {/* Remaining hour lines */}
  {Array.from({ length: 23 }, (_, i) => (
    <div
      key={i}
      className="h-[1px] bg-neutral-600"
      style={{ marginTop: `${hourHeight - 1}px` }}
    />
  ))}

  <TimeView initialEvents={initialEvents} />

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

