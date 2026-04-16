/**
 * Hook that provides a property change handler with automatic recurring dialog support.
 *
 * When updating a property on a recurring event instance, this hook shows the
 * recurring action dialog (only-this / all-events / this-and-following).
 * For non-recurring events, it updates directly.
 */
import { useCallback } from 'react'
import { useLocation } from 'react-router-dom'
import {
  useEventsStore,
  type CalendarEvent,
  type NewEvent,
  type EventFieldValue,
} from '@/store/eventsStore'

/**
 * Returns a function to update event properties with proper recurring dialog handling.
 * The returned function takes (field, value, extraFields?) and handles the rest.
 */
export function useRecurringPropertyChange() {
  const updateEventField = useEventsStore((state) => state.updateEventField)
  const showRecurringDialog = useEventsStore((state) => state.showRecurringDialog)
  const closeRecurringDialog = useEventsStore((state) => state.closeRecurringDialog)
  const location = useLocation()
  const isWeekRoute = location.pathname.startsWith('/week')

  const handlePropertyChange = useCallback(
    (
      event: CalendarEvent,
      field: keyof NewEvent,
      value: EventFieldValue,
      extraFields?: Partial<Record<keyof NewEvent, EventFieldValue>>
    ) => {
      if (!event) return

      const isVirtualRecurring = event.isRecurringInstance === true
      const isSeriesRecurring = !!(event.repeat && event.repeat !== 'None' && ((event as any).series_start_date || (event as any).series_end_date))
      const isRecurring = !!(isVirtualRecurring || isSeriesRecurring)

      if (isRecurring) {
        const eventId = event.id
        const buildUpdates = (): Record<string, EventFieldValue> => {
          const updates: Record<string, EventFieldValue> = {}
          if (field && value !== undefined) {
            updates[field] = value
          }
          if (extraFields) {
            for (const [key, val] of Object.entries(extraFields)) {
              if (val !== undefined) {
                updates[key] = val
              }
            }
          }
          return updates
        }

        // In week view, editing the real/master recurring event applies to the whole series directly.
        if (isWeekRoute && !isVirtualRecurring) {
          const updateAllInSeries = useEventsStore.getState().updateAllInSeries
          const seriesMasterId = (event as any).seriesMasterId || eventId
          void updateAllInSeries(seriesMasterId, buildUpdates() as Partial<NewEvent>)
          return
        }

        showRecurringDialog(event, 'edit', async (choice: string) => {
          if (choice === 'only-this') {
            const splitRecurringEvent = useEventsStore.getState().splitRecurringEvent
            await splitRecurringEvent(
              event as any,
              event.date,
              event.start_time,
              event.end_time,
              buildUpdates() as any
            )
          } else if (choice === 'all-events') {
            const updateAllInSeries = useEventsStore.getState().updateAllInSeries
            const seriesMasterId = (event as any).seriesMasterId || eventId
            await updateAllInSeries(seriesMasterId, buildUpdates() as Partial<NewEvent>)
          } else if (choice === 'this-and-following') {
            const updateThisAndFollowing = useEventsStore.getState().updateThisAndFollowing
            await updateThisAndFollowing(
              event as any,
              event.date,
              event.start_time,
              event.end_time,
              buildUpdates() as Partial<NewEvent>
            )
          }

          closeRecurringDialog()
        })
      } else {
        // Non-recurring: update directly
        updateEventField(event.id, field, value)
        if (extraFields) {
          for (const [key, val] of Object.entries(extraFields)) {
            if (val !== undefined) {
              updateEventField(event.id, key as keyof NewEvent, val)
            }
          }
        }
      }
    },
    [updateEventField, showRecurringDialog, closeRecurringDialog, isWeekRoute]
  )

  return handlePropertyChange
}
