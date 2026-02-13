"use client"
import {  ChevronLeft, ChevronRight } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Card, CardContent} from "@/components/ui/card"
import { useTimeStore } from "@/store/timeStore"


export function CalendarPreview() {
  const setDateInStore = useTimeStore((state) => state.setDate)
  const selectedDate = useTimeStore((state) => state.selectedDate)

  const goToToday = () => setDateInStore(new Date())

  const goToPreviousDay = () => {
    if (!selectedDate) return
    const prev = new Date(selectedDate)
    prev.setDate(prev.getDate() - 1)
    setDateInStore(prev)
  }

  const goToNextDay = () => {
    if (!selectedDate) return
    const next = new Date(selectedDate)
    next.setDate(next.getDate() + 1)
    setDateInStore(next)
  }

  return (
    <Card className="h-full w-[700px] flex flex-col bg-neutral-800 text-slate-100 border border-slate-700 py-4">
      {/* Calendar section */}
      <CardContent className="px-30 pt-20">
        <div className="flex items-start gap-3">
          {/* Calendar */}
          <div className="w-[150px] h-[150px] flex items-start justify-center pt-4">
            <div className="origin-top scale-[0.8]">
              <Calendar
                mode="single"
                selected={selectedDate || undefined}
                onSelect={(date: Date | undefined) => {
                  if (!date) return
                  setDateInStore(date)
                }}
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
