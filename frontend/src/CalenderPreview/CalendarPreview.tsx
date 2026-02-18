"use client"

import ChevronLeft from "@/assets/chevron-left.svg"
import ReminderForm from "@/components/eventDummy"

import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Card, CardContent } from "@/components/ui/card"
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
    <Card className="h-full w-175 flex flex-col bg-neutral-800 text-slate-100 border border-slate-700 py-4">
      <CardContent className="px-0 pt-20">
        
        {/* Top row: Calendar + controls */}
        <div className="flex items-start gap-6">
          
          {/* Calendar */}
          <div className="flex flex-col items-center pt-4">
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
          <div className="flex flex-1 justify-start pt-4">
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
                className="text-2xl"
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

        {/* Reminder form centered */}
        <div className="mt-12 flex justify-center">
          <div className="w-full max-w-3xl">
            <ReminderForm />
          </div>
        </div>

      </CardContent>
    </Card>
  )
}
