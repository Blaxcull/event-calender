"use client"
import { formatDateRange } from "little-date"
import { PlusIcon } from "lucide-react"

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
    const goToToday = () => {
    setDateInStore(new Date())
  }

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
    <Card className="h-screen w-125 flex flex-col bg-neutral-800 text-slate-100 border-slate-700 py-4">
      {/* Calendar (fixed height) */}
      <CardContent className="px-4">
  <div className="flex items-start gap-4">
    {/* Calendar */}
    <Calendar
      mode="single"
      selected={selectedDate || undefined}
      onSelect={(date) => {
        if (!date) return
        setDateInStore(date)
      }}
      className="bg-neutral-800 text-white rounded-md"
      required
    />

    {/* Right-side date controls */}
    <div className="flex flex-col gap-2 pt-2">
      <Button
        variant="ghost"
        size="icon"
        onClick={goToPreviousDay}
        aria-label="Previous day"
      >
        ←
      </Button>

      <Button
        variant="secondary"
        size="sm"
        onClick={goToToday}
        className="text-xs"
      >
        Today
      </Button>

      <Button
        variant="ghost"
        size="icon"
        onClick={goToNextDay}
        aria-label="Next day"
      >
        →
      </Button>
    </div>
  </div>
</CardContent>


      {/* Footer fills remaining height */}
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

        <div className="flex w-full flex-col gap-2">
          {events.map((event) => (
            <div
              key={event.title}
              className="relative rounded-md bg-muted p-2 pl-6 text-sm after:absolute after:inset-y-2 after:left-2 after:w-1 after:rounded-full after:bg-primary/70"
            >
              <div className="font-medium">{event.title}</div>
              <div className="text-xs text-muted-foreground">
                {formatDateRange(new Date(event.from), new Date(event.to))}
              </div>
            </div>
          ))}
        </div>
      </CardFooter>
    </Card>
  )
}
