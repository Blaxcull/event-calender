import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { useNavigate, useLocation } from "react-router-dom"
import { useTimeStore } from "@/store/timeStore"

type ViewType = "day" | "week" | "month" | "year"

interface ViewSwitcherProps {
  currentView: ViewType
  onViewChange: (view: ViewType) => void
}

const views: ViewType[] = ["day", "week", "month", "year"]

export function ViewSwitcher({ currentView, onViewChange }: ViewSwitcherProps) {
  const navigate = useNavigate()
  const location = useLocation()
  const selectedDate = useTimeStore((state) => state.selectedDate)
  const isDayRoute = location.pathname.startsWith('/day')
  const isWeekRoute = location.pathname.startsWith('/week')
  const isMonthRoute = location.pathname.startsWith('/month')

  const handleViewClick = (view: ViewType) => {
    onViewChange(view)
    const targetDate = selectedDate || new Date()
    const year = targetDate.getFullYear()
    const month = targetDate.getMonth() + 1
    const day = targetDate.getDate()

    if (view === "day") {
      navigate(`/day/${year}/${month}/${day}`)
      return
    }
    if (view === "week") {
      navigate(`/week/${year}/${month}/${day}`)
      return
    }
    if (view === "month") {
      navigate(`/month/${year}/${month}/${day}`)
    }
  }

  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50">
      <div className="flex items-center p-2 bg-[#ececeb] border border-black/5 rounded-full shadow-sm">
      {views.map((view, i) => {
  const routeMatched =
    (view === "day" && isDayRoute) ||
    (view === "week" && isWeekRoute) ||
    (view === "month" && isMonthRoute) ||
    (view !== "day" && view !== "week" && currentView === view)

  const nextView = views[i + 1]
  const nextRouteMatched =
    (nextView === "day" && isDayRoute) ||
    (nextView === "week" && isWeekRoute) ||
    (nextView === "month" && isMonthRoute) ||
    (nextView !== "day" && nextView !== "week" && currentView === nextView)

  const isActive = routeMatched
  const nextActive = nextRouteMatched

  return (
    <div key={view} className="flex items-center">
      <Button
        onClick={() => handleViewClick(view)}
        className={cn(
          "capitalize text-xl font-semibold rounded-full w-[120px] py-6",
          "transition-all duration-200 ease-out",
          "bg-transparent text-neutral-600",
          "hover:bg-[#e3e3e1] hover:scale-105 active:scale-95",
          isActive && "bg-[#dddddd] shadow-sm"
        )}
      >
        {view}
      </Button>

      {/* divider */}
      {i < views.length - 1 && (
        <div
          className={cn(
            "w-px h-8 bg-gray-300 mx-1 transition-opacity duration-200",
            (isActive || nextActive) ? "opacity-0" : "opacity-100"
          )}
        />
      )}
    </div>
  )
})}
    </div>
    </div>
  )
  }
