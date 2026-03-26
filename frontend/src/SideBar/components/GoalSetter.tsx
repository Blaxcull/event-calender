import React, { useCallback } from "react"
import { useEventsStore } from "@/store/eventsStore"
import GoalTypeRow from "./GoalTypeRow"
import GoalRow from "./GoalRow"
import { useRecurringPropertyChange } from "@/hooks/useRecurringPropertyChange"

const GoalPanel: React.FC = () => {
  const selectedEventId = useEventsStore((state) => state.selectedEventId)
  const getEventById = useEventsStore((state) => state.getEventById)
  const handlePropertyChange = useRecurringPropertyChange()

  const selectedEvent = selectedEventId ? getEventById(selectedEventId) : null

  const handleGoalTypeChange = useCallback(
    (value: string) => {
      if (!selectedEvent) return
      handlePropertyChange(selectedEvent, "goalType", value)
    },
    [selectedEvent, handlePropertyChange]
  )

  const handleGoalChange = useCallback(
    (value: string) => {
      if (!selectedEvent) return
      handlePropertyChange(selectedEvent, "goal", value)
    },
    [selectedEvent, handlePropertyChange]
  )

  if (!selectedEvent) return null

  return (
    <div className="shadow-lg border border-neutral-100 w-full bg-[#ececec] rounded-[52px] pl-5 pr-6 py-6 border-20 space-y-3 shadow-none">
      <GoalTypeRow
        value={selectedEvent.goalType || "None"}
        onChange={handleGoalTypeChange}
      />

      <hr className="border-neutral-300 border-t-[2px]" />

      <GoalRow
        value={selectedEvent.goal || "None"}
        onChange={handleGoalChange}
      />
    </div>
  )
}

export default GoalPanel
