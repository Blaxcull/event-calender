import React, { useCallback } from "react"
import { useEventsStore, type CalendarEvent, type NewEvent, type EventFieldValue } from "@/store/eventsStore"
import RepeatRow from "./RepeatRow"
import EarlyReminderRow from "./EarlyReminderRow"
import AllDayRow from "./AllDayRow"
import RecurringActionDialog from "@/components/RecurringActionDialog"

const REPEAT_OPTIONS = ["None", "Daily", "Weekly", "Monthly", "Yearly"] as const

const addYears = (dateStr: string, years: number): string => {
  const date = new Date(dateStr + 'T00:00:00')
  date.setFullYear(date.getFullYear() + years)
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

const RepeatReminderPanel: React.FC = () => {
  const selectedEventId = useEventsStore((state) => state.selectedEventId)
  const updateEventField = useEventsStore((state) => state.updateEventField)
  const eventsCache = useEventsStore((state) => state.eventsCache)
  const computedEventsCache = useEventsStore((state) => state.computedEventsCache)
  const showRecurringDialog = useEventsStore((state) => state.showRecurringDialog)
  const recurringDialogOpen = useEventsStore((state) => state.recurringDialogOpen)
  const recurringDialogEvent = useEventsStore((state) => state.recurringDialogEvent)
  const recurringDialogActionType = useEventsStore((state) => state.recurringDialogActionType)
  const closeRecurringDialog = useEventsStore((state) => state.closeRecurringDialog)

  // Find event by searching through all dates
  // Priority: eventsCache (real events) > computedEventsCache (virtual instances)
  // This ensures master recurring events return isRecurringInstance: false
  const selectedEvent = React.useMemo(() => {
    if (!selectedEventId) {
      return null
    }
    
    // Check if this is a virtual event ID (format: "masterEventId-YYYY-MM-DD")
    const datePattern = /-(\d{4}-\d{2}-\d{2})$/
    const isVirtualEventId = datePattern.test(selectedEventId)
    
    if (isVirtualEventId) {
      // First check computedEventsCache for virtual events
      if (computedEventsCache) {
        for (const dateKey in computedEventsCache) {
          const event = computedEventsCache[dateKey].find(e => e.id === selectedEventId)
          if (event) {
            console.log('RepeatReminderPanel: Found VIRTUAL event, title =', event.title)
            return event as CalendarEvent
          }
        }
      }
      
      // Not in cache - try to generate it on-demand
      const match = selectedEventId.match(datePattern)
      if (match) {
        const virtualDate = match[1]
        const masterEventId = selectedEventId.replace(datePattern, '')
        
        // Find master event in eventsCache
        for (const events of Object.values(eventsCache)) {
          const masterEvent = events.find(e => e.id === masterEventId)
          if (masterEvent) {
            console.log('RepeatReminderPanel: Generated VIRTUAL from master, master title =', masterEvent.title)
            // Generate virtual event
            return {
              ...masterEvent,
              id: selectedEventId,
              date: virtualDate,
              end_date: virtualDate,
              isRecurringInstance: true,
              seriesMasterId: masterEventId,
              occurrenceDate: virtualDate,
            } as CalendarEvent
          }
        }
      }
      
      return null
    }
    
    // Real event - search in eventsCache
    if (eventsCache) {
      for (const dateKey in eventsCache) {
        const event = eventsCache[dateKey].find(e => e.id === selectedEventId)
        if (event) {
          console.log('RepeatReminderPanel: Found REAL event, title =', event.title)
          return event as CalendarEvent
        }
      }
    }
    
    return null
  }, [selectedEventId, eventsCache, computedEventsCache])

  // Check if this is a recurring event INSTANCE (not the base master event)
  // Only show dialog for virtual instances (isRecurringInstance = true)
  const isRecurring = selectedEvent && 
                      !selectedEvent.isTemp &&
                      selectedEvent.title !== "New Event" &&
                      (selectedEvent as any).isRecurringInstance === true
  console.log('RepeatReminderPanel: isRecurring =', isRecurring, 'selectedEvent =', selectedEvent)

  const handlePropertyChange = useCallback((field: keyof NewEvent, value: EventFieldValue) => {
    if (!selectedEvent || !selectedEventId) return

    if (isRecurring) {
      // Capture values at this moment
      const eventId = selectedEvent.id
      const eventDate = selectedEvent.date

      showRecurringDialog(
        selectedEvent as CalendarEvent,
        "edit",
        async (choice: string) => {
          if (choice === "only-this") {
            // Use splitRecurringEvent to split the series
            const splitRecurringEvent = useEventsStore.getState().splitRecurringEvent
            await splitRecurringEvent(
              selectedEvent as any,
              eventDate,
              selectedEvent.start_time,
              selectedEvent.end_time,
              { [field]: value } as any
            )
          } else if (choice === "all-events") {
            const updateAllInSeries = useEventsStore.getState().updateAllInSeries
            const seriesMasterId = (selectedEvent as any).seriesMasterId || eventId
            await updateAllInSeries(seriesMasterId, { [field]: value } as Partial<NewEvent>)
          } else if (choice === "this-and-following") {
            const updateThisAndFollowing = useEventsStore.getState().updateThisAndFollowing
            await updateThisAndFollowing(
              selectedEvent as any,
              eventDate,
              selectedEvent.start_time,
              selectedEvent.end_time,
              { [field]: value } as any
            )
          }
          closeRecurringDialog()
        }
      )
    } else {
      updateEventField(selectedEventId, field, value)
    }
  }, [selectedEvent, selectedEventId, isRecurring, updateEventField, showRecurringDialog, closeRecurringDialog])

  const handleRepeatChange = useCallback((value: string) => {
    if (!selectedEvent || !selectedEventId) return

    if (isRecurring) {
      // Capture values at this moment
      const eventId = selectedEvent.id

      showRecurringDialog(
        selectedEvent as CalendarEvent,
        "edit",
        async (choice: string) => {
          if (choice === "only-this") {
            // For repeat changes on "only this", just update this occurrence to not repeat
            await updateEventField(eventId, "repeat", value)
            if (value === "None") {
              updateEventField(eventId, "series_start_date", undefined)
              updateEventField(eventId, "series_end_date", undefined)
            }
          } else if (choice === "all-events") {
            const updateAllInSeries = useEventsStore.getState().updateAllInSeries
            const seriesMasterId = (selectedEvent as any).seriesMasterId || eventId
            
            const updates: Partial<NewEvent> = { repeat: value }
            if (value !== "None" && REPEAT_OPTIONS.includes(value as typeof REPEAT_OPTIONS[number])) {
              const eventDate = selectedEvent.date
              const seriesEndDate = addYears(eventDate, 10)
              updates.series_start_date = eventDate
              updates.series_end_date = seriesEndDate
            }
            await updateAllInSeries(seriesMasterId, updates)
          } else if (choice === "this-and-following") {
            const updateThisAndFollowing = useEventsStore.getState().updateThisAndFollowing
            const updates: Partial<NewEvent> = { repeat: value }
            if (value !== "None" && REPEAT_OPTIONS.includes(value as typeof REPEAT_OPTIONS[number])) {
              const eventDate = selectedEvent.date
              const seriesEndDate = addYears(eventDate, 10)
              updates.series_start_date = eventDate
              updates.series_end_date = seriesEndDate
            }
            await updateThisAndFollowing(
              selectedEvent as any,
              selectedEvent.date,
              selectedEvent.start_time,
              selectedEvent.end_time,
              updates
            )
          }
          closeRecurringDialog()
        }
      )
    } else {
      // Just update the repeat field immediately
      // series_start_date and series_end_date will be set when user clicks Save
      updateEventField(selectedEventId, "repeat", value)
    }
  }, [selectedEvent, selectedEventId, isRecurring, updateEventField, showRecurringDialog, closeRecurringDialog])

  const handleEarlyReminderChange = useCallback((value: string) => {
    handlePropertyChange("earlyReminder", value)
  }, [handlePropertyChange])

  const handleAllDayChange = useCallback((value: boolean) => {
    handlePropertyChange("allDay", value ? "Yes" : "No")
  }, [handlePropertyChange])

  if (!selectedEvent) return null

  return (
    <>
      <div className="shadow-lg border border-neutral-100 w-full bg-[#ececec] rounded-[52px] pl-5 pr-6 py-6 border-20 space-y-3 shadow-none">

        <RepeatRow
          value={selectedEvent.repeat || "None"}
          onChange={handleRepeatChange}
        />

        <hr className="border-neutral-300 border-t-[2px]" />

        <EarlyReminderRow
          value={selectedEvent.earlyReminder || "None"}
          onChange={handleEarlyReminderChange}
        />

        <hr className="border-neutral-300 border-t-[2px]" />

        <AllDayRow
          value={selectedEvent.allDay === "Yes"}
          onChange={handleAllDayChange}
        />

      </div>

      {recurringDialogOpen && recurringDialogEvent && recurringDialogActionType && (
        <RecurringActionDialog
          open={recurringDialogOpen}
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

export default RepeatReminderPanel
