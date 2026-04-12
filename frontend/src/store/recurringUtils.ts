/**
 * Utilities for generating recurring event instances from master events.
 */
import type { Event, CalendarEvent, EventException } from './types'
import {
  addDaysToDateStr,
  addMonthsToDateStr,
  addYearsToDateStr,
} from './dateUtils'

/**
 * Generate all recurring occurrence dates for a given month.
 * Returns YYYY-MM-DD strings for each occurrence within the month range.
 */
export function generateRecurringDatesForMonth(
  seriesStartDate: string,
  seriesEndDate: string,
  monthStart: string,
  monthEnd: string,
  repeatType: string
): string[] {
  const dates: string[] = []

  if (seriesStartDate > monthEnd || seriesEndDate < monthStart) {
    return dates // Series doesn't overlap this month
  }

  let currentDate = seriesStartDate
  while (currentDate <= seriesEndDate && currentDate <= monthEnd) {
    if (currentDate >= monthStart) {
      dates.push(currentDate)
    }

    switch (repeatType) {
      case 'Daily':
        currentDate = addDaysToDateStr(currentDate, 1)
        break
      case 'Weekly':
        currentDate = addDaysToDateStr(currentDate, 7)
        break
      case 'Monthly':
        currentDate = addMonthsToDateStr(currentDate, 1)
        break
      case 'Yearly':
        currentDate = addYearsToDateStr(currentDate, 1)
        break
      default:
        currentDate = addDaysToDateStr(currentDate, 1)
    }
  }

  return dates
}

/**
 * Build virtual recurring event instances for a specific date.
 * Skips the master event's original date (already in DB) and applies exceptions.
 */
export function generateRecurringInstances(
  masterEvent: Event,
  recurringDates: string[],
  exceptions: EventException[]
): CalendarEvent[] {
  const instances: CalendarEvent[] = []
  const daySpan = (() => {
    const start = new Date(masterEvent.date + 'T00:00:00')
    const end = new Date((masterEvent.end_date || masterEvent.date) + 'T00:00:00')
    return Math.max(0, Math.round((end.getTime() - start.getTime()) / 86400000))
  })()

  for (const recDate of recurringDates) {
    // Skip the master event's original date - it's a real DB row
    if (recDate === masterEvent.date) continue

    const exception = exceptions.find(ex => ex.date === recDate)

    if (exception && (exception as any).deleted === true) continue

    const instance: CalendarEvent = {
      ...masterEvent,
      id: `${masterEvent.id}-${recDate}`,
      date: recDate,
      end_date: addDaysToDateStr(recDate, daySpan),
      isRecurringInstance: true,
      seriesMasterId: masterEvent.id,
      occurrenceDate: recDate,
    }

    // Apply exception overrides if present
    if (exception) {
      if (exception.start_time !== undefined) instance.start_time = exception.start_time
      if (exception.end_time !== undefined) instance.end_time = exception.end_time
      if (exception.title !== undefined) instance.title = exception.title
    }

    instances.push(instance)
  }

  return instances
}

/**
 * Calculate the next occurrence date based on repeat type.
 */
export function getNextOccurrence(dateStr: string, repeatType: string): string {
  switch (repeatType) {
    case 'Daily':
      return addDaysToDateStr(dateStr, 1)
    case 'Weekly':
      return addDaysToDateStr(dateStr, 7)
    case 'Monthly':
      return addMonthsToDateStr(dateStr, 1)
    case 'Yearly':
      return addYearsToDateStr(dateStr, 1)
    default:
      return addDaysToDateStr(dateStr, 1)
  }
}
