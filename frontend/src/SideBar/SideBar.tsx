"use client"
import { LogOut, Loader2, CheckCircle2 } from "lucide-react"
import { useNavigate } from "react-router-dom"
import ChevronLeft from "@/assets/chevron-left.svg"

import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Card, CardContent } from "@/components/ui/card"
import { useTimeStore } from "@/store/timeStore"
import { useEventsStore } from "@/store/eventsStore"
import { supabase } from "@/lib/supabase"
import EventTitle from "./components/EventTitle"

function navigateToDate(navigate: ReturnType<typeof useNavigate>, date: Date) {
  const year = date.getFullYear()
  const month = date.getMonth() + 1 // 1-indexed for URL
  const day = date.getDate()
  navigate(`/day/${year}/${month}/${day}`)
}

export function SideBar() {
  const navigate = useNavigate()
  const selectedDate = useTimeStore((state) => state.selectedDate)
  const isAnyEventSyncing = useEventsStore((state) => state.isAnyEventSyncing)

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

  return (
      <>
    <Card className="h-full w-[700px] flex flex-col bg-neutral-800 text-slate-100 border border-slate-700 py-4 relative overflow-hidden">
      {/* Sign out button - positioned absolutely to hover over content */}
      <Button
        variant="ghost"
        size="sm"
        onClick={handleSignOut}
        className="absolute top-4 right-4 z-10 text-slate-400 hover:text-slate-100 hover:bg-slate-700"
      >
        <LogOut className="h-4 w-4 mr-2" />
        Sign out
      </Button>

      {/* Sync Status */}
      <div className="px-4 pb-2 shrink-0">
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-700/50 w-fit">
          {isAnyEventSyncing() ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin text-blue-400" />
              <span className="text-sm text-slate-300">Syncing...</span>
            </>
          ) : (
            <>
              <CheckCircle2 className="h-4 w-4 text-green-400" />
              <span className="text-sm text-slate-300">Saved</span>
            </>
          )}
        </div>
      </div>

      {/* Calendar section */}
     <CardContent className="px-30 pb-10 pt-12 shrink-0">
        <div className="flex items-start gap-3">
          {/* Calendar */}
         <div className="w-[150px]  flex items-start justify-center pt-4">
            <div className="origin-top ">
              <Calendar
                mode="single"
                selected={selectedDate || undefined}
                onSelect={handleCalendarSelect}
                className="bg-neutral-800 text-white rounded-md"
              />
            </div>
          </div>

          {/* Date controls */}
          <div className="flex flex-1 justify-start pl-42 pt-5">
            <div className="flex items-center gap-3">
              <Button
                variant="secondary"
                size="icon-xl"
                onClick={goToPreviousDay}
                aria-label="Previous day"
                className="rounded-full"
              >
<img src={ChevronLeft} alt="Previous" className="h-5 w-5" />
              </Button>

              <Button
                variant="secondary"
                size="xl"
                onClick={goToToday}
                className="text-xl text-neutral-600 font-semibold left-0"
              >
                Today
              </Button>

              <Button
                variant="secondary"
                size="icon-xl"
                onClick={goToNextDay}
                aria-label="Next day"
                className="rounded-full"
              >
               <img
                  src={ChevronLeft}
                  alt="Next"
                  className="h-5 w-5 rotate-180"
                />
              </Button>
            </div>
          </div>
        </div>
      </CardContent>


      {/* Event title */}
      <EventTitle />


    </Card>
    </>
  )
}
