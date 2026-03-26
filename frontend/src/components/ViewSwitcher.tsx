import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { useNavigate, useLocation } from "react-router-dom"

type ViewType = "day" | "week" | "month" | "year"

interface ViewSwitcherProps {
  currentView: ViewType
  onViewChange: (view: ViewType) => void
}

const views: ViewType[] = ["day", "week", "month", "year"]

export function ViewSwitcher({ currentView, onViewChange }: ViewSwitcherProps) {
  const navigate = useNavigate()
  const location = useLocation()
  const isDayRoute = location.pathname.startsWith('/day')

  const handleViewClick = (view: ViewType) => {
    onViewChange(view)
    if (view === "day") {
      const now = new Date()
      navigate(`/day/${now.getFullYear()}/${now.getMonth() + 1}/${now.getDate()}`)
    }
  }

  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50">
      <div className="flex items-center p-2 bg-background border rounded-full shadow-sm">
      {views.map((view, i) => {
  const isActive = currentView === view && (view !== "day" || isDayRoute)
  const nextActive = currentView === views[i + 1] && (views[i + 1] !== "day" || isDayRoute)

  return (
    <div key={view} className="flex items-center">
      <Button
        onClick={() => handleViewClick(view)}
        className={cn(
          "capitalize text-xl font-semibold rounded-full w-[120px] py-6",
          "transition-all duration-200 ease-out",
          "bg-transparent text-neutral-600",
          "hover:bg-neutral-200 hover:scale-105 active:scale-95",
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
