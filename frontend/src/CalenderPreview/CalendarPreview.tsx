"use client"
import { formatDateRange } from "little-date"
import { PlusIcon, ChevronLeft, ChevronRight } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Card, CardContent, CardFooter } from "@/components/ui/card"
import { useTimeStore } from "@/store/timeStore"

const events = [
  {
    title: "Team Sync Meeting",
    from: "2025-06-12T09:00:00",
    to: "2025-06-12T10:00:00",
  },
  {
    title: "Design Review",
    from: "2025-06-12T11:30:00",
    to: "2025-06-12T12:30:00",
  },
  {
    title: "Client Presentation",
    from: "2025-06-12T14:00:00",
    to: "2025-06-12T15:00:00",
  },
]

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
    <Card className="h-screen w-140 flex flex-col bg-neutral-800 text-slate-100 border border-slate-700 py-4">
      {/* Calendar section */}
      <CardContent className="px-24">
        <div className="flex items-start gap-4">
          {/* FIXED calendar size */}
          <div className="w-[240px] h-[280px] flex items-start justify-center overflow-visible">
            <div className="origin-top-left scale-[0.8]">
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
          <div className="flex flex-1 items-center justify-center">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="icon"
                onClick={goToPreviousDay}
                aria-label="Previous day"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>

              <Button
                variant="secondary"
                size="sm"
                onClick={goToToday}
                className="text-xs px-8"
              >
                Today
              </Button>

              <Button
                variant="ghost"
                size="icon"
                onClick={goToNextDay}
                aria-label="Next day"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </CardContent>

      {/* Events */}
      <CardFooter className="flex flex-1 flex-col items-start gap-3 border-t px-4 pt-4 overflow-y-auto">
        <div className="flex w-full items-center justify-between px-1">
          <div className="text-sm font-medium">
            {selectedDate?.toLocaleDateString("en-US", {
              day: "numeric",
              month: "long",
              year: "numeric",
            })}
          </div>
          <Button variant="ghost" size="icon" className="size-6">
            <PlusIcon />
            <span className="sr-only">Add Event</span>
          </Button>
        </div>

        <div className="flex w-full flex-col gap-1">
          {events.map((event) => (
            <div
              key={event.title}
              className="relative rounded-md bg-slate-300 p-1 pl-6 text-sm after:absolute after:inset-y-2 after:left-2 after:w-1 after:rounded-full after:bg-primary/70"
            >
              <div className="font-medium text-slate-900">{event.title}</div>
              <div className="text-xs text-slate-700">
                {formatDateRange(new Date(event.from), new Date(event.to))}
              </div>
            </div>
          ))}
        </div>
      </CardFooter>
    </Card>
  )
}
