import { useTimeStore } from "@/store/timeStore"
import TimeLine from "./TimeLine"
import TimeView from "./TimeView" // your click-to-add-event component

const DayView = () => {
  const dateInfo = useTimeStore((state) => state.dateInfo)
  const hourHeight = 86 // must match TimeLine

  return (
    <div className="h-screen w-full bg-white flex items-center justify-center overflow-hidden select-none">
      {/* APP WINDOW */}
      <div className="h-[95vh] w-[95%] rounded-2xl bg-neutral-800 shadow-xl flex flex-col">
        {/* HEADER */}
        <div className="px-10 pt-20 pb-4 border-b border-white/20">
          <h1 className="text-6xl pb-8 font-semibold text-neutral-900 tracking-tight">
            <span className="font-bold text-white">
              {dateInfo?.monthName} {dateInfo?.day},
            </span>
            <span className="font-normal text-neutral-300"> {dateInfo?.year}</span>
          </h1>
          <p className="mt-3 text-4xl text-neutral-200">{dateInfo?.dayName}</p>
        </div>

        {/* SCROLL AREA */}
        <div className="flex-1 overflow-y-auto">
          <div className="bg-neutral-900 px-4 pl-13 relative">
            {/* Timeline vertical lines */}
            <TimeLine />

            <div className="pb-12 relative">
              {/* Timeline hours */}
              {Array.from({ length: 24 }, (_, i) => {
                const hour = i
                return (
                  <div
                    key={hour}
                    className="flex items-center gap-3"
                    style={{ height: `${hourHeight}px` }} // exact row height
                  >
                    {/* Hour label */}
                    <span className="text-white text-2xl font-space-mono w-16 text-right ">
                      {hour.toString().padStart(2, "0")}
                      <span className="text-gray-500 text-xl">:00</span>
                    </span>

                    {/* Horizontal line */}
                    <div className="flex-1 h-[1px] bg-neutral-600"></div>
                  </div>
                )
              })}

              {/* 🟢 TimeView overlay */}
              <TimeView />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default DayView

