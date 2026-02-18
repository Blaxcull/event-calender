import { useTimeStore } from "@/store/timeStore"
import { TOP_DEAD_ZONE } from "@/lib/eventUtils"

export default function TimeLine() {
  const dateInfo = useTimeStore((state) => state.dateInfo)

  if (!dateInfo) return null

  const totalMinutes = 
dateInfo.hours * 60 + dateInfo.minutes + dateInfo.seconds / 60

  const hourHeight = 100 // each hour row height in px
  const correctTop = TOP_DEAD_ZONE + totalMinutes * (hourHeight / 60)

  const formatTime = () => {
    const hrs = dateInfo.hours
    const mins = dateInfo.minutes
    return `${hrs.toString().padStart(2, "0")}:${mins
      .toString()
      .padStart(2, "0")}`
  }

  return (
<div className="relative z-50 w-full h-full">
  <div
    className="absolute -left-2 right-0 h-0.5 bg-red-500 z-10"
    style={{ top: `${correctTop}px` }}
  >

<div className="absolute font-space-mono left-0 -translate-y-1/2 bg-red-500 text-white text-xl px-2 py-1 rounded-2xl">
  {formatTime()}
</div>
</div>
</div>

 )
}

