"use client"
import React from "react"
import { useNavigate, useLocation } from "react-router-dom"
import { X } from "lucide-react"
import ChevronLeftIcon from "@/assets/chevron-left.svg"
import SearchIcon from "@/assets/search.svg"

import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/sidebarCalendar"
import { Card, CardContent } from "@/components/ui/card"
import { useTimeStore } from "@/store/timeStore"
import { useEventsStore } from "@/store/eventsStore"
import EventTitle from "./components/EventTitle"
import RecurringActionDialog from "@/components/RecurringActionDialog"
import { SearchEventsDialog } from "./SearchEventsDialog"

type CalendarRouteView = "day" | "week" | "month" | "year"

function navigateToDate(navigate: ReturnType<typeof useNavigate>, date: Date, view: CalendarRouteView) {
  const year = date.getFullYear()
  const month = date.getMonth() + 1 // 1-indexed for URL
  const day = date.getDate()
  if (view === "week") {
    navigate(`/week/${year}/${month}/${day}`)
    return
  }
  if (view === "month") {
    navigate(`/month/${year}/${month}/${day}`)
    return
  }
  if (view === "year") {
    navigate(`/year/${year}/${month}/${day}`)
    return
  }
  navigate(`/day/${year}/${month}/${day}`)
}

interface SideBarProps {
  compact?: boolean
  onRequestClose?: () => void
}

export function SideBar({
  compact = false,
  onRequestClose
}: SideBarProps) {
  const navigate = useNavigate()
  const location = useLocation()
  const currentCalendarView: CalendarRouteView = location.pathname.startsWith("/week")
    ? "week"
    : location.pathname.startsWith("/month")
      ? "month"
      : location.pathname.startsWith("/year")
        ? "year"
      : "day"
  const selectedDate = useTimeStore((state) => state.selectedDate)
  const setDate = useTimeStore((state) => state.setDate)
  const selectedEventId = useEventsStore((state) => state.selectedEventId)
  const setSelectedEvent = useEventsStore((state) => state.setSelectedEvent)
  const [searchOpen, setSearchOpen] = React.useState(false)
  
  // Track if the event was already recurring when selected
  const wasRecurringWhenSelectedRef = React.useRef(false)
  const previousEventIdRef = React.useRef<string | null>(null)

  const goToToday = () => {
    const today = new Date()
    setDate(today)
    navigateToDate(navigate, today, currentCalendarView)
  }

  const goToPreviousDay = () => {
    if (!selectedDate) return
    const prev = new Date(selectedDate)
    if (currentCalendarView === "week") {
      prev.setDate(prev.getDate() - 7)
    } else if (currentCalendarView === "month") {
      const originalDay = prev.getDate()
      prev.setDate(1)
      prev.setMonth(prev.getMonth() - 1)
      const lastDay = new Date(prev.getFullYear(), prev.getMonth() + 1, 0).getDate()
      prev.setDate(Math.min(originalDay, lastDay))
    } else if (currentCalendarView === "year") {
      prev.setFullYear(prev.getFullYear() - 1)
    } else {
      prev.setDate(prev.getDate() - 1)
    }
    setDate(prev)
    navigateToDate(navigate, prev, currentCalendarView)
  }

  const goToNextDay = () => {
    if (!selectedDate) return
    const next = new Date(selectedDate)
    if (currentCalendarView === "week") {
      next.setDate(next.getDate() + 7)
    } else if (currentCalendarView === "month") {
      const originalDay = next.getDate()
      next.setDate(1)
      next.setMonth(next.getMonth() + 1)
      const lastDay = new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate()
      next.setDate(Math.min(originalDay, lastDay))
    } else if (currentCalendarView === "year") {
      next.setFullYear(next.getFullYear() + 1)
    } else {
      next.setDate(next.getDate() + 1)
    }
    setDate(next)
    navigateToDate(navigate, next, currentCalendarView)
  }

  const handleCalendarSelect = (date: Date | undefined) => {
    if (!date) return
    setDate(date)
    navigateToDate(navigate, date, currentCalendarView)
  }

  const saveSelectedEvent = useEventsStore((state) => state.saveSelectedEvent)
  const recurringDialogOpen = useEventsStore((state) => state.recurringDialogOpen)
  const recurringDialogEvent = useEventsStore((state) => state.recurringDialogEvent)
  const recurringDialogActionType = useEventsStore((state) => state.recurringDialogActionType)
  const eventsCache = useEventsStore((state) => state.eventsCache)
  const computedEventsCache = useEventsStore((state) => state.computedEventsCache)

  // Track when the selected event changes and update the recurring status
  React.useEffect(() => {
    if (selectedEventId && selectedEventId !== previousEventIdRef.current) {
      previousEventIdRef.current = selectedEventId
      // Check if the event was recurring when it was selected
      let wasRecurring = false
      // Check eventsCache
      for (const dateKey in eventsCache) {
        const event = eventsCache[dateKey].find(e => e.id === selectedEventId)
        if (event) {
          wasRecurring = !!((event as any).isRecurringInstance || 
            (event.repeat && event.repeat !== "None" && (event.series_start_date || event.series_end_date)))
          break
        }
      }
      // Check computedEventsCache if not found
      if (!wasRecurring) {
        for (const dateKey in computedEventsCache) {
          const event = computedEventsCache[dateKey].find(e => e.id === selectedEventId)
          if (event) {
            wasRecurring = !!((event as any).isRecurringInstance || 
              (event.repeat && event.repeat !== "None" && (event.series_start_date || event.series_end_date)))
            break
          }
        }
      }
      wasRecurringWhenSelectedRef.current = wasRecurring
    }
  }, [selectedEventId, eventsCache, computedEventsCache])

  const handleSave = React.useCallback(async () => {
    if (!selectedEventId) return
    
    try {
      await saveSelectedEvent()
    } catch (error) {
      // Save failed
    }
  }, [selectedEventId, saveSelectedEvent])

  const sidebarContent = (
    <>
      <Card className={`h-full flex flex-col bg-neutral-100 text-slate-800 border border-gray-300 py-3 relative overflow-y-auto ${compact ? "w-[min(630px,calc(100vw-24px))] rounded-[28px] shadow-[0_20px_60px_rgba(0,0,0,0.18)]" : "w-[630px]"}`}>
        {compact && onRequestClose ? (
          <Button
            type="button"
            variant="ghost"
            onClick={onRequestClose}
            aria-label="Close sidebar"
            className="absolute left-4 top-4 z-20 h-12 w-12 rounded-full border border-gray-300 bg-[#ececeb] text-neutral-600 hover:bg-white hover:text-neutral-800"
          >
            <X className="h-5 w-5" />
          </Button>
        ) : null}
        <Button
          variant="ghost"
          onClick={() => setSearchOpen(true)}
          className="absolute top-4 right-4 z-10
shadow-lg text-slate-600
border-[1px]
hover:text-slate-800 
rounded-full h-16 w-16
transition-all duration-200 ease-out
hover:scale-110 hover:shadow-xl"
        >
          <img src={SearchIcon} alt="Search" className="h-8 w-8 opacity-60" />
        </Button>

        <CardContent className="px-30 pb-9 pt-24 shrink-0">
          <div className="flex items-start gap-3">
            <div className="w-[135px]  flex items-start justify-center pt-6">
              <div className="origin-top ">
                <Calendar
                  mode="single"
                  selected={selectedDate || undefined}
                  onSelect={handleCalendarSelect}
                  className="bg-neutral-100 text-white rounded-md"
                />
              </div>
            </div>

            <div className="flex flex-1 justify-start pl-35 pt-8">
              <div className="flex items-center gap-3">
                <Button
                  variant="secondary"
                  size="icon-xl"
                  onClick={goToPreviousDay}
                  aria-label="Previous day"
                  className="rounded-full text-[#404040] bg-[#e2e2e1] hover:bg-[#d6d6d5]
      transition-all duration-200 ease-out
      hover:scale-110 hover:shadow-md
      active:scale-95"
                >
                  <img src={ChevronLeftIcon} alt="Previous" className="h-5 w-5 transition-transform duration-200 group-hover:-translate-x-0.5" />
                </Button>

                <Button
                  variant="secondary"
                  size="xl"
                  onClick={goToToday}
                  className="text-xl text-[#404040] font-semibold bg-[#e2e2e1] hover:bg-[#d6d6d5]
      transition-all duration-200 ease-out
      hover:scale-105 hover:shadow-md
      active:scale-95"
                >
                  Today
                </Button>

                <Button
                  variant="secondary"
                  size="icon-xl"
                  onClick={goToNextDay}
                  aria-label="Next day"
                  className="rounded-full bg-[#e2e2e1] hover:bg-[#d6d6d5]
      transition-all duration-200 ease-out
      hover:scale-110 hover:shadow-md
      active:scale-95"
                >
                  <img
                    src={ChevronLeftIcon}
                    alt="Next"
                    className="h-5 w-5 rotate-180 transition-transform duration-200"
                  />
                </Button>
              </div>
            </div>
          </div>
        </CardContent>

        <EventTitle />

        {selectedEventId && (
          <div className="mt-auto pt-4 px-4 pb-4 flex justify-end">
            <Button
              variant="secondary"
              onClick={handleSave}
              className="bg-red-600 text-white hover:bg-red-700 px-8 py-6 text-lg rounded-full disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              Save
            </Button>
          </div>
        )}

        {recurringDialogOpen && recurringDialogEvent && recurringDialogActionType && (
          <RecurringActionDialog
            open={recurringDialogOpen}
            onChoice={(choice) => {
              const callback = useEventsStore.getState().recurringDialogCallback
              if (callback) callback(choice)
            }}
            actionType={recurringDialogActionType}
            eventTitle={recurringDialogEvent?.title || ""}
          />
        )}
      </Card>
      <SearchEventsDialog open={searchOpen} onOpenChange={setSearchOpen} />
    </>
  )

  return (
    <>{sidebarContent}</>
  )
}
