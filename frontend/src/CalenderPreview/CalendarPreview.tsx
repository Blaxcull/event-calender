"use client"
import { ChevronLeft, ChevronRight, LogOut } from "lucide-react"
import { useNavigate } from "react-router-dom"

import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Card, CardContent } from "@/components/ui/card"
import { useTimeStore } from "@/store/timeStore"
import { supabase } from "@/lib/supabase"

function navigateToDate(navigate: ReturnType<typeof useNavigate>, date: Date) {
  const year = date.getFullYear()
  const month = date.getMonth() + 1 // 1-indexed for URL
  const day = date.getDate()
  navigate(`/day/${year}/${month}/${day}`)
}

export function CalendarPreview() {
  const navigate = useNavigate()
  const selectedDate = useTimeStore((state) => state.selectedDate)

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
    <Card className="h-full w-[700px] flex flex-col bg-neutral-800 text-slate-100 border border-slate-700 py-4">
      {/* Sign out button - small, at top */}
      <div className="flex justify-end px-4 pb-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={handleSignOut}
          className="text-slate-400 hover:text-slate-100 hover:bg-slate-700"
        >
          <LogOut className="h-4 w-4 mr-2" />
          Sign out
        </Button>
      </div>

      {/* Calendar section */}
      <CardContent className="px-30 pt-20">
        <div className="flex items-start gap-3">
          {/* Calendar */}
          <div className="w-[150px] h-[150px] flex items-start justify-center pt-4">
            <div className="origin-top scale-[0.8]">
              <Calendar
                mode="single"
                selected={selectedDate || undefined}
                onSelect={handleCalendarSelect}
                className="bg-neutral-800 text-white rounded-md"
              />
            </div>
          </div>

          {/* Date controls */}
          <div className="flex flex-1 justify-start pl-42 pt-4">
            <div className="flex items-center gap-3">
              <Button
                variant="secondary"
                size="icon-xl"
                onClick={goToPreviousDay}
                aria-label="Previous day"
                className="rounded-full"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>

              <Button
                variant="secondary"
                size="xl"
                onClick={goToToday}
                className="text-2xl left-0"
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
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </CardContent>

      {/* Events */}

    </Card>
  )
}
