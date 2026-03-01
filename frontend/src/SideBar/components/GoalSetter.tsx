import React from "react"
import { useEventsStore, formatDate } from "@/store/eventsStore"
import { useTimeStore } from "@/store/timeStore"
import GoalTypeRow from "./GoalTypeRow"
import GoalRow from "./GoalRow"

const GoalPanel: React.FC = () => {
  const selectedEventId = useEventsStore((state) => state.selectedEventId)
  const eventsCache = useEventsStore((state) => state.eventsCache)
  const updateEventField = useEventsStore((state) => state.updateEventField)
  const selectedDate = useTimeStore((state) => state.selectedDate)

  // Get selected event
  const selectedEvent = React.useMemo(() => {
    if (!selectedEventId || !selectedDate) return null
    const dateKey = formatDate(selectedDate)
    const events = eventsCache[dateKey] || []
    return events.find((e) => e.id === selectedEventId) || null
  }, [selectedEventId, selectedDate, eventsCache])

  // If no event selected → don't render
  if (!selectedEvent) return null

  const handleGoalTypeChange = (value: string) => {
    updateEventField(selectedEvent.id, "goalType", value)
  }

  const handleGoalChange = (value: string) => {
    updateEventField(selectedEvent.id, "goal", value)
  }

  return (
    <div className="shadow-lg border border-neutral-800 w-full bg-neutral-700 rounded-[34px] p-4 border-20 space-y-3 shadow-none">
      <GoalTypeRow
        value={selectedEvent.goalType || "a"}
        onChange={handleGoalTypeChange}
      />

      <hr className="border-neutral-600 border-t-[2px]" />

      <GoalRow
        value={selectedEvent.goal || "dummy"}
        onChange={handleGoalChange}
      />
    </div>
  )
}

export default GoalPanel
