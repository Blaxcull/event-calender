"use client"
import React from "react"
import { LogOut } from "lucide-react"
import { useNavigate } from "react-router-dom"
import ChevronLeft from "@/assets/chevron-left.svg"
import SearchIcon from "@/assets/search.svg"

import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/sidebarCalendar"
import { Card, CardContent } from "@/components/ui/card"
import { useTimeStore } from "@/store/timeStore"
import { useEventsStore, type CalendarEvent } from "@/store/eventsStore"
import { supabase } from "@/lib/supabase"
import EventTitle from "./components/EventTitle"
import RecurringActionDialog from "@/components/RecurringActionDialog"

function navigateToDate(navigate: ReturnType<typeof useNavigate>, date: Date) {
  const year = date.getFullYear()
  const month = date.getMonth() + 1 // 1-indexed for URL
  const day = date.getDate()
  navigate(`/day/${year}/${month}/${day}`)
}

export function SideBar() {
  const navigate = useNavigate()
  const selectedDate = useTimeStore((state) => state.selectedDate)
  const selectedEventId = useEventsStore((state) => state.selectedEventId)
  const setSelectedEvent = useEventsStore((state) => state.setSelectedEvent)
  
  // Track if the event was already recurring when selected
  const wasRecurringWhenSelectedRef = React.useRef(false)
  const previousEventIdRef = React.useRef<string | null>(null)

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    navigate('/login')
  }

  const goToToday = () => {
    const today = new Date()
    navigateToDate(navigate, today)
  }

  const goToPreviousDay = () => {
    if (!selectedDate) return
    const prev = new Date(selectedDate)
    prev.setDate(prev.getDate() - 1)
    navigateToDate(navigate, prev)
  }

  const goToNextDay = () => {
    if (!selectedDate) return
    const next = new Date(selectedDate)
    next.setDate(next.getDate() + 1)
    navigateToDate(navigate, next)
  }

  const handleCalendarSelect = (date: Date | undefined) => {
    if (!date) return
    navigateToDate(navigate, date)
  }

  const saveSelectedEvent = useEventsStore((state) => state.saveSelectedEvent)
  const showRecurringDialog = useEventsStore((state) => state.showRecurringDialog)
  const recurringDialogOpen = useEventsStore((state) => state.recurringDialogOpen)
  const recurringDialogEvent = useEventsStore((state) => state.recurringDialogEvent)
  const recurringDialogActionType = useEventsStore((state) => state.recurringDialogActionType)
  const closeRecurringDialog = useEventsStore((state) => state.closeRecurringDialog)
  const getEventById = useEventsStore((state) => state.getEventById)
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
          wasRecurring = !!(event.isRecurringInstance || 
            (event.repeat && event.repeat !== "None" && (event.series_start_date || event.series_end_date)))
          break
        }
      }
      // Check computedEventsCache if not found
      if (!wasRecurring) {
        for (const dateKey in computedEventsCache) {
          const event = computedEventsCache[dateKey].find(e => e.id === selectedEventId)
          if (event) {
            wasRecurring = !!(event.isRecurringInstance || 
              (event.repeat && event.repeat !== "None" && (event.series_start_date || event.series_end_date)))
            break
          }
        }
      }
      wasRecurringWhenSelectedRef.current = wasRecurring
      console.log('Event selected:', { id: selectedEventId, wasRecurringWhenSelected: wasRecurring })
    }
  }, [selectedEventId, eventsCache, computedEventsCache])

  const handleSave = React.useCallback(async () => {
    if (!selectedEventId) return
    
    const selectedEvent = getEventById(selectedEventId)
    
    // Only show recurring dialog if the event was ALREADY recurring when selected
    // Don't show if it's just being made recurring (changing from None to Daily/Weekly/etc.)
    const shouldShowDialog = wasRecurringWhenSelectedRef.current

    if (shouldShowDialog) {
      showRecurringDialog(
        selectedEvent as CalendarEvent,
        "edit",
        async (choice: string) => {
          console.log(`Save clicked, choice: ${choice}`)
          closeRecurringDialog()
          try {
            await saveSelectedEvent()
          } catch (error) {
            console.error('Error in handleSave:', error)
          }
        }
      )
    } else {
      try {
        await saveSelectedEvent()
      } catch (error) {
        console.error('Error in handleSave:', error)
      }
    }
  }, [selectedEventId, getEventById, showRecurringDialog, closeRecurringDialog, saveSelectedEvent, setSelectedEvent])

  return (
      <>
    <Card className="h-full w-[630px] flex flex-col bg-neutral-100 text-slate-800 border border-gray-300 py-3 relative overflow-y-auto">
      {/* Search button */}
      <Button
        variant="ghost"
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

      {/* Sign out button */}
      <div className="px-4 pb-2 shrink-0">
        <Button
          variant="ghost"
          size="sm"
          onClick={handleSignOut}
          className="text-slate-600 hover:text-slate-800 hover:bg-gray-200"
        >
          <LogOut className="h-4 w-4 mr-2" />
          Sign out
        </Button>
      </div>

      {/* Calendar section */}
     <CardContent className="px-30 pb-9 pt-16 shrink-0">
        <div className="flex items-start gap-3">
          {/* Calendar */}
         <div className="w-[135px]  flex items-start justify-center pt-3">
            <div className="origin-top ">
              <Calendar
                mode="single"
                selected={selectedDate || undefined}
                onSelect={handleCalendarSelect}
                className="bg-neutral-100 text-white rounded-md"
              />
            </div>
          </div>

          {/* Date controls */}
          <div className="flex flex-1 justify-start pl-35 pt-5">
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
      <img src={ChevronLeft} alt="Previous" className="h-5 w-5 transition-transform duration-200 group-hover:-translate-x-0.5" />
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
        src={ChevronLeft}
        alt="Next"
        className="h-5 w-5 rotate-180 transition-transform duration-200"
      />
    </Button>

  </div>
</div>
        </div>
      </CardContent>


      {/* Event title */}
      <EventTitle />

      {/* Save button */}
      {selectedEventId && (
      <div className="mt-auto pt-4 px-4 pb-4 flex justify-end">
        <Button
          variant="secondary"
          onClick={handleSave}
          className="bg-red-600 text-white hover:bg-red-700 px-8 py-6 text-lg rounded-full"
        >
          Save
        </Button>
      </div>
      )}

      {recurringDialogOpen && recurringDialogEvent && recurringDialogActionType && (
        <RecurringActionDialog
          open={recurringDialogOpen}
          onClose={closeRecurringDialog}
          onChoice={(choice) => {
            const callback = useEventsStore.getState().recurringDialogCallback
            if (callback) callback(choice)
          }}
          actionType={recurringDialogActionType}
          eventTitle={recurringDialogEvent?.title || ""}
        />
      )}

    </Card>
    </>
  )
}
