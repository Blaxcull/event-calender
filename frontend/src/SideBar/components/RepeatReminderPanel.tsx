import React from "react"
import { useEventsStore } from "@/store/eventsStore"
import { useTimeStore } from "@/store/timeStore"
import RepeatRow from "./RepeatRow"
import EarlyReminderRow from "./EarlyReminderRow"
import AllDayRow from "./AllDayRow"
import { useRecurringEvents } from "@/hooks/useRecurringEvents"
import RecurringEditDialog from "@/components/RecurringEditDialog"
import RepeatChangeDialog from "@/components/RepeatChangeDialog"

const RepeatReminderPanel: React.FC = () => {
  const selectedEventId = useEventsStore((state) => state.selectedEventId)
  const getEventsForDate = useEventsStore((state) => state.getEventsForDate)
  const updateEventField = useEventsStore((state) => state.updateEventField)
  const addEventOptimistic = useEventsStore((state) => state.addEventOptimistic)
  const selectedDate = useTimeStore((state) => state.selectedDate)

  const {
    showEditDialog,
    showRepeatDialog,
    pendingEdit,
    pendingRepeatChange,
    getMasterEventId,
    handleFieldChange,
    handleRepeatChange,
    cancelDialog
  } = useRecurringEvents()

  const selectedEvent = React.useMemo(() => {
    if (!selectedEventId || !selectedDate) return null
    const events = getEventsForDate(selectedDate)
    return events.find((e) => e.id === selectedEventId) || null
  }, [selectedEventId, selectedDate, getEventsForDate])

  // Wrap updateEventField to match the expected signature
  const wrappedUpdateEventField = React.useCallback((id: string, field: string, value: any) => {
    updateEventField(id, field as any, value)
  }, [updateEventField])

  const handleEditChoice = (choice: 'only-this' | 'all-events' | 'this-and-following') => {
    if (!pendingEdit) return

    const { event, field, newValue } = pendingEdit
    const isVirtual = event.isRecurringInstance

    switch (choice) {
      case 'only-this':
        if (isVirtual) {
          // For virtual events, create a standalone copy
          const standaloneEvent = {
            ...event,
            id: crypto.randomUUID(),
            series_id: undefined,
            is_series_master: true,
            series_position: 0,
            isRecurringInstance: false,
            repeat: 'None'
          }
          addEventOptimistic(standaloneEvent as any)
          updateEventField(standaloneEvent.id, field as any, newValue)
        } else {
          // For master events, create a break in the series
          const breakEvent = {
            ...event,
            id: crypto.randomUUID(),
            series_id: undefined,
            is_series_master: true,
            series_position: 0,
            isRecurringInstance: false,
            repeat: 'None'
          }
          addEventOptimistic(breakEvent as any)
          updateEventField(breakEvent.id, field as any, newValue)
        }
        break

      case 'all-events':
        // Update the master event
        const masterId = getMasterEventId(event)
        updateEventField(masterId, field as any, newValue)
        break

      case 'this-and-following':
        // Split the series at this point
        const newMasterId = crypto.randomUUID()
        const splitEvent = {
          ...event,
          id: newMasterId,
          series_id: newMasterId,
          is_series_master: true,
          series_position: 0,
          isRecurringInstance: false
        }
        addEventOptimistic(splitEvent as any)
        updateEventField(newMasterId, field as any, newValue)
        break
    }

    cancelDialog()
  }

  const handleRepeatChoice = (choice: 'only-this' | 'this-and-following') => {
    if (!pendingRepeatChange || !selectedEvent) return

    const { event } = pendingRepeatChange
    const isVirtual = event.isRecurringInstance

    switch (choice) {
      case 'only-this':
        if (isVirtual) {
          // Create standalone event
          const standaloneEvent = {
            ...event,
            id: crypto.randomUUID(),
            series_id: undefined,
            is_series_master: true,
            series_position: 0,
            isRecurringInstance: false,
            repeat: 'None'
          }
          addEventOptimistic(standaloneEvent as any)
        } else {
          // Break the series at this point
          const breakEvent = {
            ...event,
            id: crypto.randomUUID(),
            series_id: undefined,
            is_series_master: true,
            series_position: 0,
            isRecurringInstance: false,
            repeat: 'None'
          }
          addEventOptimistic(breakEvent as any)
        }
        break

      case 'this-and-following':
        // Split series and stop recurrence from this point
        const newMasterId = crypto.randomUUID()
        const splitEvent = {
          ...event,
          id: newMasterId,
          series_id: newMasterId,
          is_series_master: true,
          series_position: 0,
          isRecurringInstance: false,
          repeat: 'None'
        }
        addEventOptimistic(splitEvent as any)
        break
    }

    cancelDialog()
  }

  const handleRepeatChangeWrapper = (value: string) => {
    console.log('RepeatReminderPanel: handleRepeatChangeWrapper called with value=', value, 'selectedEvent.repeat=', selectedEvent?.repeat)
    if (!selectedEvent) return
    handleRepeatChange(selectedEvent as any, value, wrappedUpdateEventField)
  }

  const handleEarlyReminderChange = (value: string) => {
    if (!selectedEvent) return
    handleFieldChange(
      selectedEvent as any,
      "earlyReminder",
      value,
      wrappedUpdateEventField
    )
  }

  const handleAllDayChange = (value: boolean) => {
    if (!selectedEvent) return
    handleFieldChange(
      selectedEvent as any,
      "allDay",
      value ? "Yes" : "No",
      wrappedUpdateEventField
    )
  }

  if (!selectedEvent) return null

  return (
    <>
      <div className="shadow-lg border border-neutral-100 w-full bg-[#ececec] rounded-[52px] p-4 border-20 space-y-3 shadow-none">
        <RepeatRow
          value={selectedEvent.repeat || "None"}
          onChange={handleRepeatChangeWrapper}
        />

        <hr className="border-neutral-300 border-t-[2px]" />

        <EarlyReminderRow
          value={selectedEvent.earlyReminder || "dummy"}
          onChange={handleEarlyReminderChange}
        />

        <hr className="border-neutral-300 border-t-[2px]" />

        <AllDayRow
          value={selectedEvent.allDay === "Yes"}
          onChange={handleAllDayChange}
        />
      </div>

      {showEditDialog && pendingEdit && (
        <RecurringEditDialog
          open={showEditDialog}
          onClose={cancelDialog}
          onChoice={handleEditChoice}
          event={pendingEdit.event}
          field={pendingEdit.field}
          newValue={pendingEdit.newValue}
          oldValue={pendingEdit.oldValue}
        />
      )}

      {showRepeatDialog && pendingRepeatChange && (
        <RepeatChangeDialog
          open={showRepeatDialog}
          onClose={cancelDialog}
          onChoice={handleRepeatChoice}
          event={pendingRepeatChange.event}
          newRepeat={pendingRepeatChange.newRepeat}
        />
      )}
    </>
  )
}

export default RepeatReminderPanel
