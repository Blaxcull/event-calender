import React, { useCallback } from "react"
import { useEventsStore, type CalendarEvent } from "@/store/eventsStore"
import GoalTypeRow from "./GoalTypeRow"
import GoalRow from "./GoalRow"
import RecurringActionDialog from "@/components/RecurringActionDialog"

const GoalPanel: React.FC = () => {
  const selectedEventId = useEventsStore((state) => state.selectedEventId)
  const updateEventField = useEventsStore((state) => state.updateEventField)
  const showRecurringDialog = useEventsStore((state) => state.showRecurringDialog)
  const recurringDialogOpen = useEventsStore((state) => state.recurringDialogOpen)
  const recurringDialogEvent = useEventsStore((state) => state.recurringDialogEvent)
  const recurringDialogActionType = useEventsStore((state) => state.recurringDialogActionType)
  const closeRecurringDialog = useEventsStore((state) => state.closeRecurringDialog)

  // Use selector that subscribes to both caches for reactivity
  const selectedEvent = useEventsStore((state) => {
    if (!selectedEventId) return null
    // Access caches to ensure this selector re-runs when they change
    void state.eventsCache
    void state.computedEventsCache
    // Search through all dates in eventsCache
    for (const dateKey in state.eventsCache) {
      const event = state.eventsCache[dateKey].find(e => e.id === selectedEventId)
      if (event) return event as CalendarEvent
    }
    // Also check computedEventsCache for virtual events
    for (const dateKey in state.computedEventsCache) {
      const event = state.computedEventsCache[dateKey].find(e => e.id === selectedEventId)
      if (event) return event as CalendarEvent
    }
    return null
  })

  const isRecurring = selectedEvent && 
                      !selectedEvent.isTemp &&
                      selectedEvent.title !== "New Event" &&
                      (selectedEvent.isRecurringInstance || 
                       (selectedEvent.repeat && 
                        selectedEvent.repeat !== "None" &&
                        (selectedEvent.series_start_date || selectedEvent.series_end_date)))

  const handlePropertyChange = useCallback((field: string, value: string) => {
    if (!selectedEvent || !selectedEventId) return

    if (isRecurring) {
      // Capture values at this moment
      const eventId = selectedEvent.id

      showRecurringDialog(
        selectedEvent as CalendarEvent,
        "edit",
        async (choice: string) => {
          if (choice === "only-this") {
            // Use splitRecurringEvent to split the series
            const splitRecurringEvent = useEventsStore.getState().splitRecurringEvent
            await splitRecurringEvent(
              selectedEvent as any,
              selectedEvent.date,
              selectedEvent.start_time,
              selectedEvent.end_time,
              { [field]: value } as any
            )
          } else if (choice === "all-events") {
            await updateEventField(eventId, field as any, value)
          }
          closeRecurringDialog()
        }
      )
    } else {
      updateEventField(selectedEventId, field as any, value)
    }
  }, [selectedEvent, selectedEventId, isRecurring, updateEventField, showRecurringDialog, closeRecurringDialog])

  const handleGoalTypeChange = useCallback((value: string) => {
    handlePropertyChange("goalType", value)
  }, [handlePropertyChange])

  const handleGoalChange = useCallback((value: string) => {
    handlePropertyChange("goal", value)
  }, [handlePropertyChange])

  if (!selectedEvent) return null

  return (
    <>
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
    </>
  )
}

export default GoalPanel
