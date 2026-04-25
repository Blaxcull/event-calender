import { Button } from "@/components/ui/button"
import { Menu, X } from "lucide-react"
import { useEffect, useState } from "react"
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
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [useCondensedNav, setUseCondensedNav] = useState(false)

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

  useEffect(() => {
    if (typeof window === "undefined") return

    const mediaQuery = window.matchMedia("(max-width: 1200px)")
    const applyNavMode = (matches: boolean) => {
      setUseCondensedNav(matches)
      if (!matches) setMobileMenuOpen(false)
    }

    applyNavMode(mediaQuery.matches)

    const handleChange = (event: MediaQueryListEvent) => applyNavMode(event.matches)
    mediaQuery.addEventListener("change", handleChange)

    return () => mediaQuery.removeEventListener("change", handleChange)
  }, [])

  useEffect(() => {
    if (!mobileMenuOpen) return

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMobileMenuOpen(false)
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [mobileMenuOpen])

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

  const openGoalView = () => {
    setMobileMenuOpen(false)
    navigate('/goalview')
  }

  const openCalendarView = () => {
    setMobileMenuOpen(false)
    navigate(calendarPath)
  }

  return (
    <>
      <div className={`fixed left-4 top-4 z-[20020] items-center gap-3 ${useCondensedNav ? "hidden" : "flex"}`}>

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

      <div className={`fixed left-4 top-4 z-[20020] items-center gap-3 ${useCondensedNav ? "flex" : "hidden"}`}>
        <Button
          type="button"
          variant="ghost"
          onClick={() => setMobileMenuOpen(true)}
          className="h-16 w-16 rounded-full border-[1px] bg-[#ececeb]/95 text-slate-600 shadow-lg backdrop-blur-sm transition-all duration-200 ease-out hover:text-slate-800 hover:scale-110 hover:shadow-xl active:scale-95"
          aria-label="Open navigation menu"
        >
          <Menu className="h-7 w-7 opacity-80" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          onClick={handlePlusClick}
          className="flex h-16 w-16 items-center justify-center rounded-full border-[1px] bg-[#ececeb]/95 text-slate-600 shadow-lg backdrop-blur-sm transition-all duration-200 ease-out hover:text-slate-800 hover:scale-110 hover:shadow-xl active:scale-95"
          aria-label="Add event"
        >
          <img src={plusIcon} alt="Add" className="w-7 h-7 opacity-80" />
        </Button>
      </div>

      {mobileMenuOpen ? (
        <>
          <button
            type="button"
            className="fixed inset-0 z-[20030] bg-black/30 backdrop-blur-[2px]"
            aria-label="Close navigation menu"
            onClick={() => setMobileMenuOpen(false)}
          />
          <div className="fixed left-4 top-4 z-[20040] w-[min(280px,calc(100vw-32px))] rounded-[28px] border border-black/5 bg-[#ececeb]/98 p-3 shadow-[0_24px_60px_rgba(0,0,0,0.22)] backdrop-blur-md">
            <div className="flex items-center justify-between px-2 pb-3">
              <div className="text-xs font-semibold uppercase tracking-[0.18em] text-neutral-500">Navigate</div>
              <Button
                type="button"
                variant="ghost"
                onClick={() => setMobileMenuOpen(false)}
                className="h-10 w-10 rounded-full text-neutral-500 hover:bg-white/70 hover:text-neutral-800"
                aria-label="Close navigation menu"
              >
                <X className="h-5 w-5" />
              </Button>
            </div>
            <button
              type="button"
              onClick={openGoalView}
              className={`flex w-full items-center gap-3 rounded-2xl px-4 py-4 text-left transition-all duration-200 ${
                isGoalSelected ? "bg-[#dddddd] shadow-sm" : "hover:bg-white/70"
              }`}
            >
              <img src={goalIcon} alt="" className="h-8 w-8 opacity-80" />
              <div>
                <div className="text-base font-semibold text-neutral-800">Goals</div>
                <div className="text-sm text-neutral-500">Open your goal view</div>
              </div>
            </button>
            <button
              type="button"
              onClick={openCalendarView}
              className={`mt-2 flex w-full items-center gap-3 rounded-2xl px-4 py-4 text-left transition-all duration-200 ${
                isCalendarSelected ? "bg-[#dddddd] shadow-sm" : "hover:bg-white/70"
              }`}
            >
              <img src={calendarIcon} alt="" className="h-7 w-7 opacity-80" />
              <div>
                <div className="text-base font-semibold text-neutral-800">Calendar</div>
                <div className="text-sm text-neutral-500">Return to your schedule</div>
              </div>
            </button>
          </div>
        </>
      ) : null}
    </>
  )
}
