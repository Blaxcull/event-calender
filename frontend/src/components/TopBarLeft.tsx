import { Button } from "@/components/ui/button"
import { useNavigate, useLocation } from "react-router-dom"
import { useTimeStore } from "@/store/timeStore"
import goalIcon from "@/assets/goal.png"
import calendarIcon from "@/assets/calendar2.png"
import plusIcon from "@/assets/plus.png"

interface TopBarLeftProps {
  onAddClick?: () => void
}

export function TopBarLeft({ onAddClick }: TopBarLeftProps) {
  const navigate = useNavigate()
  const location = useLocation()
  const selectedDate = useTimeStore((state) => state.selectedDate)

  const isGoalSelected = location.pathname === '/goalview'
  const isCalendarSelected =
    location.pathname.startsWith('/day') ||
    location.pathname.startsWith('/week') ||
    location.pathname.startsWith('/month') ||
    location.pathname.startsWith('/year')
  const isDayRoute = /^\/day\/\d+\/\d+\/\d+$/.test(location.pathname)
  const calendarDate = selectedDate || new Date()
  const calendarPath = `/day/${calendarDate.getFullYear()}/${calendarDate.getMonth() + 1}/${calendarDate.getDate()}`

  const isAnySelected = isGoalSelected || isCalendarSelected

  const triggerAddAtCurrentTime = () => {
    if (typeof window !== "undefined") {
      sessionStorage.setItem("pendingAddNowEvent", "1")
      window.dispatchEvent(new CustomEvent("calendar:add-now-event"))
    }
  }

  const handlePlusClick = () => {
    if (onAddClick) {
      onAddClick()
      return
    }

    const now = new Date()
    const todayPath = `/day/${now.getFullYear()}/${now.getMonth() + 1}/${now.getDate()}`

    if (isDayRoute && location.pathname === todayPath) {
      triggerAddAtCurrentTime()
      return
    }

    navigate(todayPath)
    window.setTimeout(() => {
      triggerAddAtCurrentTime()
    }, 140)
  }

  return (
    <div className="fixed top-4 left-4 z-50 flex items-center gap-3">

      <div className="group flex items-center border-[1px] rounded-full shadow-sm bg-[#ececeb]/90 border-black/5 backdrop-blur-sm">

        {/* Goals */}

<div
  onClick={() => navigate('/goalview')}
  className={`
    h-16 w-16 flex items-center justify-center
    cursor-pointer rounded-full

    transition-all duration-200 ease-out
    active:scale-95

    border

    ${isGoalSelected
      ? 'bg-[#dddddd] border-white/80 shadow-inner scale-90 hover:scale-100 hover:bg-[#e7e7e6] hover:shadow-lg'
      : 'border-transparent hover:border-white/40 hover:shadow-lg hover:scale-100'
    }
  `}
>



          <img src={goalIcon} alt="goals" className="w-9 h-9 opacity-80" />
        </div>

        {/* divider */}
        {!isAnySelected && (
          <div className="w-px h-9 bg-gray-300 transition-opacity duration-150 group-hover:opacity-0" />
        )}

        {/* Calendar */}
        <div
          onClick={() => navigate(calendarPath)}
          className={`
            h-16 w-16 flex items-center justify-center
            cursor-pointer rounded-full

            transition-all duration-150
            active:scale-95

            ${isCalendarSelected
      ? 'bg-[#dddddd] border-white/80 shadow-inner scale-90 hover:scale-100 hover:bg-[#e7e7e6] hover:shadow-lg'
      : 'border-transparent hover:border-white/40 hover:shadow-lg hover:scale-100'
            }
          `}
        >
          <img src={calendarIcon} alt="Calendar" className="w-7 h-7 opacity-80" />
        </div>

      </div>

      {/* plus button */}
      <Button
        variant="ghost"
        onClick={handlePlusClick}
        className="
          h-16 w-16
          rounded-full
          shadow-lg
          border-[1px]
          text-slate-600
          transition-all duration-200 ease-out
          hover:text-slate-800
          hover:scale-110
          hover:shadow-xl
          active:scale-95
          flex items-center justify-center
        "
      >
        <img src={plusIcon} alt="Add" className="w-7 h-7 opacity-80" />
      </Button>

    </div>
  )
}
