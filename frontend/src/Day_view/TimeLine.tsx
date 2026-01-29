import { useTimeStore } from "@/store/timeStore"

export default function TimeLine() {
  const dateInfo = useTimeStore((state) => state.dateInfo)

  if (!dateInfo) return null

  const totalMinutes = 
dateInfo.hours * 60 + dateInfo.minutes + dateInfo.seconds / 60

  const hourHeight = 86 // each hour row height in px
  const topPadding = 43 // corresponds to pt-12
  const correctTop = topPadding + totalMinutes * (hourHeight / 60)

  const formatTime = () => {
    const hrs = dateInfo.hours
    const mins = dateInfo.minutes
    return `${hrs.toString().padStart(2, "0")}:${mins
      .toString()
      .padStart(2, "0")}`
  }

  return (
      <div
  className="absolute left-12 right-4 h-[2px] bg-red-500 z-10"
  style={{ top: `${correctTop}px` }}
>
<div className="absolute font-space-mono left-0 -translate-y-1/2 bg-red-500 text-white text-xl px-2 py-1 rounded-2xl">
  {formatTime()}
</div>
</div>

 )
}

