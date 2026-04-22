/**
 * Primary Zustand store for calendar events.
 *
 * Responsibilities:
 * - Cache events fetched from Supabase for a sliding date window
 * - Generate virtual recurring event instances on-the-fly
 * - Provide optimistic local-first CRUD operations
 * - Manage UI state for event selection and recurring dialogs
 */
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { supabase } from '@/lib/supabase'

import type {
  Event,
  CalendarEvent,
  EventException,
  NewEvent,
  EventFieldValue,
  EventsCache,
  ComputedEventsCache,
} from './types'

import {
  formatDate,
  addDaysToDateStr,
  addYearsToDateStr,
  addDays,
  getMonthRange,
  getMonthKey,
} from './dateUtils'

import {
  generateRecurringDatesForMonth,
  generateRecurringInstances,
  getNextOccurrence,
} from './recurringUtils'

import {
  buildEventForDb,
  filterUpdatesForDb,
  dbRowToEvent,
  generateTempId,
} from './dbHelpers'

// Re-export types and functions so existing imports from '@/store/eventsStore' still work
export type { EventFieldValue, Event, CalendarEvent, EventException, NewEvent }
export { formatDate } from './dateUtils'

// How many days before/after center date to fetch
const CACHE_WINDOW_DAYS = 17

// ---- Store Interface ----

interface EventsState {
  // Cache storage
  eventsCache: EventsCache
  computedEventsCache: ComputedEventsCache
  recurringEventsCache: Record<string, CalendarEvent[]>
  eventExceptionsCache: Record<string, EventException[]>

  // Current cached date window
  cacheStartDate: string | null
  cacheEndDate: string | null
  cachedUserId: string | null

  // Loading / error
  isLoading: boolean
  error: string | null

  // Sync tracking for optimistic updates
  pendingSyncs: Set<string>
  pendingUpdates: Map<string, Partial<NewEvent>[]>
  pendingDeletes: Set<string>

  // UI state
  selectedEventId: string | null
  scrollToEventId: string | null
  scrollToTop: boolean
  saveTrigger: number
  hasEditsEventId: string | null
  liveEventTimes: Record<string, { start_time: number; end_time: number }>

  // Recurring action dialog
  recurringDialogOpen: boolean
  recurringDialogEvent: CalendarEvent | null
  recurringDialogActionType: 'edit' | 'delete' | null
  recurringDialogCallback: ((choice: string) => void) | null

  // Actions
  fetchEventsWindow: (centerDate: Date) => void
  addEvent: (event: NewEvent) => Promise<Event>
  addEventOptimistic: (event: NewEvent) => Promise<Event>
  addEventLocal: (event: NewEvent) => Event
  saveTempEvent: (tempEventId: string) => Promise<void>
  updateEvent: (id: string, updates: Partial<NewEvent>) => Promise<Event | null>
  updateAllInSeries: (seriesMasterId: string, updates: Partial<NewEvent>) => Promise<void>
  deleteEvent: (id: string) => Promise<boolean>
  getEventsForDate: (date: Date) => CalendarEvent[]
  getEventById: (id: string) => CalendarEvent | null
  clearCache: () => void
  isEventSyncing: (eventId: string) => boolean
  isAnyEventSyncing: () => boolean
  setSelectedEvent: (id: string | null) => void
  setScrollToEventId: (id: string | null) => void
  setScrollToTop: (value: boolean) => void
  updateEventField: (id: string, field: keyof NewEvent, value: EventFieldValue) => void
  updateEventFields: (id: string, updates: Partial<NewEvent>) => void
  syncGoalLinkedEvents: (params: {
    columnType: 'week' | 'month' | 'year' | 'life'
    bucketKey: string
    previousGoalText: string
    nextGoalText: string
    color?: string
    icon?: string
  }) => Promise<void>
  saveSelectedEvent: () => Promise<void>
  showRecurringDialog: (event: CalendarEvent, actionType: 'edit' | 'delete', callback: (choice: string) => void) => void
  closeRecurringDialog: () => void
  setHasEditsEventId: (id: string | null) => void
  previewEventTime: (id: string, start_time: number, end_time: number) => void
  setLiveEventTime: (id: string, start_time: number, end_time: number) => void
  clearLiveEventTime: (id?: string) => void
  splitRecurringEvent: (event: CalendarEvent, selectedDate: string, newStartTime?: number, newEndTime?: number, updates?: Partial<NewEvent>) => Promise<void>
  updateThisAndFollowing: (event: CalendarEvent, selectedDate: string, newStartTime?: number, newEndTime?: number, updates?: Partial<NewEvent>) => Promise<void>
  deleteSingleOccurrence: (event: CalendarEvent, selectedDate: string) => Promise<void>
}

// ---- Helpers ----

/** Check if an event ID is for a virtual recurring instance (format: "masterId-YYYY-MM-DD") */
const VIRTUAL_ID_PATTERN = /-(\d{4}-\d{2}-\d{2})$/

function isVirtualEventId(id: string): boolean {
  return VIRTUAL_ID_PATTERN.test(id)
}

function extractMasterId(virtualId: string): string {
  return virtualId.replace(VIRTUAL_ID_PATTERN, '')
}

/** Find an event in the eventsCache by ID, returning [event, dateKey] or null */
function findEventInCache(cache: EventsCache, id: string): { event: Event; dateKey: string } | null {
  let best: { event: Event; dateKey: string } | null = null

  for (const dateKey of Object.keys(cache)) {
    const event = cache[dateKey].find(e => e.id === id)
    if (!event) continue

    if (!best) {
      best = { event, dateKey }
      continue
    }

    const bestEndDate = best.event.end_date || best.event.date
    const eventEndDate = event.end_date || event.date
    const shouldReplace =
      event.date < best.event.date ||
      (event.date === best.event.date && eventEndDate > bestEndDate)

    if (shouldReplace) {
      best = { event, dateKey }
    }
  }

  return best
}

function getClockwiseDurationMinutes(startMinutes: number, endMinutes: number): number {
  if (endMinutes >= startMinutes) return endMinutes - startMinutes
  return (1440 - startMinutes) + endMinutes
}

function getGoalTypeLabel(columnType: 'week' | 'month' | 'year' | 'life'): string {
  switch (columnType) {
    case 'week':
      return 'Weekly'
    case 'month':
      return 'Monthly'
    case 'year':
      return 'Yearly'
    case 'life':
      return 'Lifetime'
  }
}

function getBucketDateRange(bucketKey: string): { start: string; end: string } | null {
  if (bucketKey === 'life') return null

  if (bucketKey.startsWith('week-')) {
    const [, year, month, day] = bucketKey.split('-')
    const start = new Date(Number(year), Number(month), Number(day))
    const end = new Date(start)
    end.setDate(end.getDate() + 6)
    return {
      start: formatDate(start),
      end: formatDate(end),
    }
  }

  if (bucketKey.startsWith('month-')) {
    const [, year, month] = bucketKey.split('-')
    const start = new Date(Number(year), Number(month), 1)
    const end = new Date(Number(year), Number(month) + 1, 0)
    return {
      start: formatDate(start),
      end: formatDate(end),
    }
  }

  if (bucketKey.startsWith('year-')) {
    const [, year] = bucketKey.split('-')
    const start = new Date(Number(year), 0, 1)
    const end = new Date(Number(year), 11, 31)
    return {
      start: formatDate(start),
      end: formatDate(end),
    }
  }

  return null
}

function eventMatchesGoalSyncRange(event: Event, bucketKey: string): boolean {
  const range = getBucketDateRange(bucketKey)
  if (!range) return true
  return event.date >= range.start && event.date <= range.end
}

/** Find a master recurring event by ID across all cache dates */
function findMasterEvent(cache: EventsCache, masterId: string): Event | null {
  for (const events of Object.values(cache)) {
    const found = events.find(e => e.id === masterId)
    if (found) return found
  }
  return null
}

function scheduleIdleStoreWrite(write: () => void) {
  if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
    window.requestIdleCallback(() => write(), { timeout: 120 })
    return
  }

  setTimeout(write, 0)
}

function buildRecurringEventsForMonth(
  monthDate: Date,
  eventsCache: EventsCache,
  recurringEventsCache: Record<string, CalendarEvent[]>,
  eventExceptionsCache: Record<string, EventException[]>
): CalendarEvent[] {
  const monthKey = getMonthKey(monthDate)
  if (recurringEventsCache[monthKey]) {
    return recurringEventsCache[monthKey]
  }

  const { monthStart, monthEnd } = getMonthRange(monthDate)
  const seenMasterIds = new Set<string>()
  const allMasterEvents: Event[] = []

  for (const dayEvents of Object.values(eventsCache)) {
    for (const event of dayEvents) {
      if (
        event.repeat &&
        event.repeat !== 'None' &&
        event.series_start_date &&
        event.series_end_date &&
        event.series_end_date >= monthStart &&
        event.series_start_date <= monthEnd &&
        !seenMasterIds.has(event.id)
      ) {
        seenMasterIds.add(event.id)
        allMasterEvents.push(event)
      }
    }
  }

  const generatedRecurring: CalendarEvent[] = []
  for (const masterEvent of allMasterEvents) {
    const recurringDates = generateRecurringDatesForMonth(
      masterEvent.series_start_date!,
      masterEvent.series_end_date!,
      monthStart,
      monthEnd,
      masterEvent.repeat || 'Daily'
    )

    const seriesExceptions = eventExceptionsCache[masterEvent.id] || []
    const instances = generateRecurringInstances(masterEvent, recurringDates, seriesExceptions)
    generatedRecurring.push(...instances)
  }

  return generatedRecurring
}

function buildCanonicalEventsForDate(
  dateKey: string,
  eventsCache: EventsCache,
  recurringEventsForMonth: CalendarEvent[]
): CalendarEvent[] {
  const realEvents: CalendarEvent[] = (eventsCache[dateKey] || []).map((event) => ({
    ...event,
    isRecurringInstance: false,
  }))

  for (const [otherDateKey, dayEvents] of Object.entries(eventsCache)) {
    if (otherDateKey === dateKey) continue
    for (const event of dayEvents) {
      const eventEndDate = event.end_date || event.date
      if (event.date <= dateKey && eventEndDate >= dateKey) {
        realEvents.push({ ...event, isRecurringInstance: false })
      }
    }
  }

  const recurringEvents = recurringEventsForMonth.filter((event) => event.date === dateKey)
  const canonicalById = new Map<string, CalendarEvent>()
  const allEvents = [...realEvents, ...recurringEvents]

  for (const event of allEvents) {
    const existing = canonicalById.get(event.id)
    if (!existing) {
      canonicalById.set(event.id, event)
      continue
    }

    const existingEndDate = existing.end_date || existing.date
    const eventEndDate = event.end_date || event.date
    const shouldReplace =
      event.date < existing.date ||
      (event.date === existing.date && eventEndDate > existingEndDate)

    if (shouldReplace) {
      canonicalById.set(event.id, event)
    }
  }

  return Array.from(canonicalById.values()).sort((a, b) => a.start_time - b.start_time)
}

export function getEventsForDateSnapshot(
  date: Date,
  eventsCache: EventsCache,
  recurringEventsCache: Record<string, CalendarEvent[]>,
  eventExceptionsCache: Record<string, EventException[]>
): CalendarEvent[] {
  const dateKey = formatDate(date)
  const recurringEventsForMonth = buildRecurringEventsForMonth(
    date,
    eventsCache,
    recurringEventsCache,
    eventExceptionsCache
  )
  return buildCanonicalEventsForDate(dateKey, eventsCache, recurringEventsForMonth)
}

export function getEventsForDatesSnapshot(
  dates: Date[],
  eventsCache: EventsCache,
  recurringEventsCache: Record<string, CalendarEvent[]>,
  eventExceptionsCache: Record<string, EventException[]>
): Record<string, CalendarEvent[]> {
  const eventsByDateKey: Record<string, CalendarEvent[]> = {}
  const recurringByMonthKey = new Map<string, CalendarEvent[]>()

  dates.forEach((date) => {
    const dateKey = formatDate(date)
    const monthKey = getMonthKey(date)
    let recurringEventsForMonth = recurringByMonthKey.get(monthKey)

    if (!recurringEventsForMonth) {
      recurringEventsForMonth = buildRecurringEventsForMonth(
        date,
        eventsCache,
        recurringEventsCache,
        eventExceptionsCache
      )
      recurringByMonthKey.set(monthKey, recurringEventsForMonth)
    }

    eventsByDateKey[dateKey] = buildCanonicalEventsForDate(
      dateKey,
      eventsCache,
      recurringEventsForMonth
    )
  })

  return eventsByDateKey
}

// ---- Store ----

export const useEventsStore = create<EventsState>()(
  persist(
    (set, get) => ({
      eventsCache: {},
      computedEventsCache: {},
      recurringEventsCache: {},
      eventExceptionsCache: {},
      cacheStartDate: null,
      cacheEndDate: null,
      cachedUserId: null,
      isLoading: false,
      error: null,
      pendingSyncs: new Set<string>(),
      pendingUpdates: new Map<string, Partial<NewEvent>[]>(),
      pendingDeletes: new Set<string>(),
      selectedEventId: null,
      scrollToEventId: null,
      scrollToTop: false,
      saveTrigger: 0,
      recurringDialogOpen: false,
      recurringDialogEvent: null,
      recurringDialogActionType: null,
      recurringDialogCallback: null,
      hasEditsEventId: null,
      liveEventTimes: {},

      // ---- Fetch ----

      fetchEventsWindow: async (centerDate: Date) => {
        const startDate = addDays(centerDate, -CACHE_WINDOW_DAYS)
        const endDate = addDays(centerDate, CACHE_WINDOW_DAYS)
        const startStr = formatDate(startDate)
        const endStr = formatDate(endDate)

        const { data: { user } } = await supabase.auth.getUser()
        if (!user) {
          set({ isLoading: false, error: 'User not authenticated', cachedUserId: null })
          return
        }

        // Clear cache if user changed
        const { cachedUserId } = get()
        if (cachedUserId !== user.id) {
          set({
            eventsCache: {},
            computedEventsCache: {},
            cacheStartDate: null,
            cacheEndDate: null,
            cachedUserId: user.id,
          })
        }

        try {
          const { data, error } = await supabase
            .from('events')
            .select('*')
            .eq('user_id', user.id)
            .gte('date', startStr)
            .lte('date', endStr)
            .order('start_time', { ascending: true })

          if (error) {
            set({ error: error.message })
            return
          }

          // Merge fetched data with existing cache
          const { eventsCache: oldCache, pendingSyncs, pendingDeletes } = get()
          const newCache: EventsCache = { ...oldCache }

          // Filter out any events marked as deleted in local cache
          for (const dateKey of Object.keys(newCache)) {
            newCache[dateKey] = newCache[dateKey].filter(e => !(e as any).deleted)
          }

          // Also filter events that are pending delete
          if (pendingDeletes && pendingDeletes.size > 0) {
            for (const dateKey of Object.keys(newCache)) {
              newCache[dateKey] = newCache[dateKey].filter(e => !pendingDeletes.has(e.id))
            }
          }

          data?.forEach((row: Record<string, any>) => {
            const event = dbRowToEvent(row)
            // Skip if this event is pending delete
            if (pendingDeletes && pendingDeletes.has(event.id)) {
              return
            }
            if (!newCache[event.date]) newCache[event.date] = []
            newCache[event.date] = newCache[event.date].filter(e => e.id !== event.id)
            newCache[event.date].push(event)
            newCache[event.date].sort((a, b) => a.start_time - b.start_time)
          })

          // Preserve temp events still syncing
          for (const date of Object.keys(oldCache)) {
            const tempEvents = oldCache[date].filter(e => pendingSyncs.has(e.id) && (!pendingDeletes || !pendingDeletes.has(e.id)))
            if (tempEvents.length > 0) {
              if (!newCache[date]) newCache[date] = []
              for (const tempEvent of tempEvents) {
                if (!newCache[date].some(e => e.id === tempEvent.id)) {
                  newCache[date].push(tempEvent)
                }
              }
              newCache[date].sort((a, b) => a.start_time - b.start_time)
            }
          }

          // Fetch exceptions for all recurring masters currently present in cache.
          // This covers masters that started outside the current fetch window but
          // still generate occurrences inside it.
          const masterIds = new Set<string>()
          Object.values(newCache).forEach((events) => {
            events.forEach((event) => {
              if (
                event.id &&
                event.repeat &&
                event.repeat !== 'None' &&
                event.series_start_date &&
                event.series_end_date
              ) {
                masterIds.add(event.id)
              }
            })
          })

          let newExceptionsCache = { ...get().eventExceptionsCache }

          if (masterIds.size > 0) {
            const { data: exceptionsData, error: excError } = await supabase
              .from('exceptions')
              .select('*')
              .in('series_id', Array.from(masterIds))

            if (!excError && exceptionsData) {
              for (const exc of exceptionsData) {
                const seriesId = exc.series_id
                if (!newExceptionsCache[seriesId]) {
                  newExceptionsCache[seriesId] = []
                }
                newExceptionsCache[seriesId] = newExceptionsCache[seriesId].filter(e => e.date !== exc.date)
                newExceptionsCache[seriesId].push({
                  id: exc.id,
                  series_id: exc.series_id,
                  user_id: exc.user_id,
                  date: exc.date,
                  start_time: exc.start_time,
                  end_time: exc.end_time,
                  title: exc.title,
                  deleted: exc.deleted,
                  created_at: exc.created_at,
                })
              }
            }
          }

          set({
            eventsCache: newCache,
            computedEventsCache: {},
            cacheStartDate: startStr,
            cacheEndDate: endStr,
            cachedUserId: user.id,
            eventExceptionsCache: newExceptionsCache,
          })
        } catch (err) {
          set({ error: err instanceof Error ? err.message : 'Failed to fetch events' })
        }
      },

      // ---- Create ----

      addEvent: async (event: NewEvent) => {
        const tempId = generateTempId()
        const now = new Date().toISOString()
        const localEvent: Event = {
          id: tempId,
          user_id: 'temp-user',
          title: event.title,
          date: event.date,
          end_date: event.end_date || event.date,
          start_time: event.start_time,
          end_time: event.end_time,
          description: event.description,
          notes: event.notes,
          urls: event.urls,
          color: event.color,
          is_all_day: event.is_all_day,
          location: event.location,
          created_at: now,
          updated_at: now,
        }

        const { eventsCache, computedEventsCache } = get()
        const dateKey = event.date
        const newComputedCache = { ...computedEventsCache }
        delete newComputedCache[dateKey]

        set({
          eventsCache: {
            ...eventsCache,
            [dateKey]: [...(eventsCache[dateKey] || []), localEvent]
              .sort((a, b) => a.start_time - b.start_time),
          },
          computedEventsCache: newComputedCache,
        })

        // Background DB save
        setTimeout(async () => {
          try {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) return

            const eventForDb = buildEventForDb(event, user.id)
            const { data, error } = await supabase
              .from('events')
              .insert([eventForDb])
              .select()
              .single()

            if (error || !data) return

            const savedEvent = dbRowToEvent(data)
            const { eventsCache: currentCache } = get()
            const newCache = { ...currentCache }
            if (newCache[dateKey]) {
              newCache[dateKey] = newCache[dateKey].map(e =>
                e.id === tempId ? savedEvent : e
              )
              newCache[dateKey].sort((a, b) => a.start_time - b.start_time)
            }
            set({ eventsCache: newCache })
          } catch { /* background save failed silently */ }
        }, 0)

        return localEvent
      },

      addEventOptimistic: async (event: NewEvent) => {
        const tempId = event.id || `temp-${Date.now()}-${Math.random().toString(36).slice(2)}`
        const now = new Date().toISOString()

        // Calculate series end date for recurring events (10 years from start)
        let seriesEndDate: string | undefined
        if (event.repeat && event.repeat !== 'None' && event.date) {
          const startDate = new Date(event.date + 'T00:00:00')
          startDate.setFullYear(startDate.getFullYear() + 10)
          seriesEndDate = startDate.toISOString().split('T')[0]
        }

        const tempEvent: Event = {
          id: tempId,
          user_id: 'temp-user',
          title: event.title,
          date: event.date,
          end_date: event.end_date || event.date,
          start_time: event.start_time,
          end_time: event.end_time,
          description: event.description,
          notes: event.notes,
          urls: event.urls,
          color: event.color,
          is_all_day: event.is_all_day,
          location: event.location,
          repeat: event.repeat,
          series_start_date: event.repeat && event.repeat !== 'None' ? event.date : undefined,
          series_end_date: seriesEndDate,
          created_at: now,
          updated_at: now,
          isTemp: true,
        }

        const { eventsCache, computedEventsCache } = get()
        const dateKey = event.date
        const currentPendingSyncs = new Set(get().pendingSyncs)
        currentPendingSyncs.add(tempId)
        const newComputedCache = { ...computedEventsCache }
        delete newComputedCache[dateKey]

        set({
          eventsCache: {
            ...eventsCache,
            [dateKey]: [...(eventsCache[dateKey] || []), tempEvent]
              .sort((a, b) => a.start_time - b.start_time),
          },
          computedEventsCache: newComputedCache,
          pendingSyncs: currentPendingSyncs,
        })

        // Background DB save with error rollback
        setTimeout(async () => {
          const rollbackTempEvent = () => {
            const { eventsCache: cc, pendingSyncs: ps, pendingUpdates: pu } = get()
            const nc = { ...cc }
            const nps = new Set(ps)
            const npu = new Map(pu)
            nps.delete(tempId)
            npu.delete(tempId)
            if (nc[dateKey]) nc[dateKey] = nc[dateKey].filter(e => e.id !== tempId)
            set({ eventsCache: nc, pendingSyncs: nps, pendingUpdates: npu })
          }

          try {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) { rollbackTempEvent(); return }

            const eventForDb = buildEventForDb(event, user.id)
            const { data, error } = await supabase
              .from('events')
              .insert([eventForDb])
              .select()
              .single()

            if (error || !data) { rollbackTempEvent(); return }

            // Replace temp event with real data
            const savedEvent = dbRowToEvent(data)
            const { eventsCache: currentCache, pendingSyncs, pendingUpdates } = get()
            const newCache = { ...currentCache }
            const newPendingSyncs = new Set(pendingSyncs)
            newPendingSyncs.delete(tempId)

            const currentSelectedId = get().selectedEventId
            const queuedUpdates = pendingUpdates.get(tempId)
            const newPendingUpdates = new Map(pendingUpdates)
            newPendingUpdates.delete(tempId)

            let finalEvent = { ...savedEvent, isTemp: false }

            if (newCache[dateKey] && queuedUpdates && queuedUpdates.length > 0) {
              for (const update of queuedUpdates) {
                finalEvent = { ...finalEvent, ...update, updated_at: new Date().toISOString() }
              }
            }

            if (newCache[dateKey]) {
              newCache[dateKey] = newCache[dateKey].map(e =>
                e.id === tempId ? finalEvent : e
              )
              newCache[dateKey].sort((a, b) => a.start_time - b.start_time)
            }

            const newSelectedId = currentSelectedId === tempId ? finalEvent.id : currentSelectedId
            const { computedEventsCache: currentComputedCache } = get()
            const newComputedCache = { ...currentComputedCache }
            delete newComputedCache[dateKey]

            set({
              eventsCache: newCache,
              computedEventsCache: newComputedCache,
              pendingSyncs: newPendingSyncs,
              pendingUpdates: newPendingUpdates,
              selectedEventId: newSelectedId,
            })

            // Sync queued updates to DB
            if (queuedUpdates && queuedUpdates.length > 0) {
              const mergedUpdates = filterUpdatesForDb(
                Object.assign({}, ...queuedUpdates)
              )
              if (Object.keys(mergedUpdates).length > 0) {
                await supabase.from('events').update(mergedUpdates).eq('id', data.id)
              }
            }
          } catch {
            rollbackTempEvent()
          }
        }, 0)

        return tempEvent
      },

      addEventLocal: (event: NewEvent): Event => {
        const tempId = event.id || `temp-${Date.now()}-${Math.random().toString(36).slice(2)}`
        const now = new Date().toISOString()

        const tempEvent: Event = {
          id: tempId,
          user_id: 'temp-user',
          title: event.title,
          date: event.date,
          end_date: event.end_date || event.date,
          start_time: event.start_time,
          end_time: event.end_time,
          description: event.description,
          notes: event.notes,
          urls: event.urls,
          color: event.color,
          is_all_day: event.is_all_day,
          location: event.location,
          repeat: event.repeat,
          created_at: now,
          updated_at: now,
          isTemp: true,
        }

        const { eventsCache, computedEventsCache } = get()
        const dateKey = event.date
        const newComputedCache = { ...computedEventsCache }
        delete newComputedCache[dateKey]

        set({
          eventsCache: {
            ...eventsCache,
            [dateKey]: [...(eventsCache[dateKey] || []), tempEvent].sort((a, b) => a.start_time - b.start_time),
          },
          computedEventsCache: newComputedCache,
        })

        return tempEvent
      },

      saveTempEvent: async (tempEventId: string) => {
        const { eventsCache, pendingSyncs, pendingUpdates } = get()
        let tempEvent: Event | null = null
        let dateKey: string | null = null

        for (const key of Object.keys(eventsCache)) {
          const event = eventsCache[key].find(e => e.id === tempEventId)
          if (event) { tempEvent = event; dateKey = key; break }
        }

        if (!tempEvent || !dateKey) return

        // Apply queued updates before saving
        const queuedUpdates = pendingUpdates.get(tempEventId) || []
        let updatedTempEvent = { ...tempEvent }
        for (const update of queuedUpdates) {
          updatedTempEvent = { ...updatedTempEvent, ...update }
        }

        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return

        const eventForDb = buildEventForDb(updatedTempEvent, user.id)
        const { data: rawSavedEvent, error } = await supabase
          .from('events')
          .insert([eventForDb])
          .select()
          .single()

        if (error || !rawSavedEvent) return

        const savedEvent = dbRowToEvent(rawSavedEvent)

        // Replace temp with real event
        const { eventsCache: currentCache } = get()
        const newCache = { ...currentCache }
        if (newCache[dateKey]) {
          newCache[dateKey] = newCache[dateKey].map(e =>
            e.id === tempEventId ? { ...updatedTempEvent, ...savedEvent, id: savedEvent.id, isTemp: false } : e
          )
        }

        const newPendingSyncs = new Set(pendingSyncs)
        newPendingSyncs.delete(tempEventId)
        const newPendingUpdates = new Map(pendingUpdates)
        newPendingUpdates.delete(tempEventId)

        set({
          eventsCache: newCache,
          computedEventsCache: {},
          recurringEventsCache: {},
          pendingSyncs: newPendingSyncs,
          pendingUpdates: newPendingUpdates,
        })
      },

      // ---- Update ----

      updateEvent: async (id: string, updates: Partial<NewEvent>) => {
        const { eventsCache, pendingSyncs, pendingUpdates } = get()
        const found = findEventInCache(eventsCache, id)

        if (!found) return null

        const { event: currentEvent, dateKey: oldDate } = found
        const newCache = { ...eventsCache }

        const updatedEvent = {
          ...currentEvent,
          ...updates,
          updated_at: new Date().toISOString(),
        }

        const newDate = updates.date || oldDate

        // Remove any stale copies of this event from every cached date bucket first.
        for (const cacheDateKey of Object.keys(newCache)) {
          const filtered = newCache[cacheDateKey].filter(e => e.id !== id)
          if (filtered.length === 0) delete newCache[cacheDateKey]
          else newCache[cacheDateKey] = filtered
        }

        if (!newCache[newDate]) newCache[newDate] = []
        newCache[newDate] = [...newCache[newDate], updatedEvent].sort((a, b) => a.start_time - b.start_time)

        set({
          eventsCache: newCache,
          computedEventsCache: {},
          recurringEventsCache: {},
          eventExceptionsCache: {},
        })

        // Queue update for temp events
        if (updatedEvent.isTemp === true || pendingSyncs.has(id)) {
          const newPendingUpdates = new Map(pendingUpdates)
          const existing = newPendingUpdates.get(id) || []
          newPendingUpdates.set(id, [...existing, updates])

          if (updatedEvent.isTemp === true && !pendingSyncs.has(id)) {
            const newPendingSyncs = new Set(pendingSyncs)
            newPendingSyncs.add(id)
            set({ pendingUpdates: newPendingUpdates, pendingSyncs: newPendingSyncs })
            void get().saveTempEvent(id)
          } else {
            set({ pendingUpdates: newPendingUpdates })
          }

          return updatedEvent
        }

        // Background DB update
        setTimeout(async () => {
          try {
            const filteredUpdates = filterUpdatesForDb(updates)
            await supabase.from('events').update(filteredUpdates).eq('id', id)
          } catch { /* background update failed silently */ }
        }, 0)

        return updatedEvent
      },

      updateAllInSeries: async (seriesMasterId: string, updates: Partial<NewEvent>) => {
        const currentEvent = findMasterEvent(get().eventsCache, seriesMasterId)
        if (!currentEvent) return

        const nextSeriesStartDate = updates.series_start_date ?? currentEvent.series_start_date
        const nextSeriesEndDate = updates.series_end_date ?? currentEvent.series_end_date
        const shouldCollapseToSingleEvent =
          !!currentEvent.repeat &&
          currentEvent.repeat !== 'None' &&
          !!nextSeriesStartDate &&
          !!nextSeriesEndDate &&
          nextSeriesEndDate <= nextSeriesStartDate

        const normalizedUpdates = shouldCollapseToSingleEvent
          ? {
              ...updates,
              repeat: 'None',
              series_start_date: undefined,
              series_end_date: undefined,
            }
          : updates

        await get().updateEvent(seriesMasterId, normalizedUpdates)
        set({
          recurringEventsCache: {},
          computedEventsCache: {},
          selectedEventId: null,
        })
      },

      // ---- Delete ----

      deleteEvent: async (id: string) => {
        const { eventsCache, computedEventsCache } = get()
        const newCache = { ...eventsCache }
        const newComputedCache = { ...computedEventsCache }

        const event = Object.values(eventsCache).flat().find(e => e.id === id)
        const isTempEvent = event?.isTemp === true
        const isRecurringEvent = event?.repeat && event.repeat !== 'None'

        const affectedDates: string[] = []
        for (const date of Object.keys(newCache)) {
          if (newCache[date].some(e => e.id === id)) {
            affectedDates.push(date)
            newCache[date] = newCache[date].filter(e => e.id !== id)
          }
        }

        let datesToClearFromComputed: string[] = [...affectedDates]
        if (event && !isRecurringEvent && event.end_date) {
          const startDate = new Date(event.date)
          const endDate = new Date(event.end_date)
          const current = new Date(startDate)
          while (current <= endDate) {
            const dateKey = formatDate(current)
            if (!datesToClearFromComputed.includes(dateKey)) {
              datesToClearFromComputed.push(dateKey)
            }
            current.setDate(current.getDate() + 1)
          }
        }

        if (isRecurringEvent) {
          set({ eventsCache: newCache, computedEventsCache: {}, recurringEventsCache: {}, eventExceptionsCache: {} })
        } else {
          for (const date of datesToClearFromComputed) delete newComputedCache[date]
          set({ eventsCache: newCache, computedEventsCache: newComputedCache, recurringEventsCache: {}, eventExceptionsCache: {} })
        }

        if (isTempEvent) return true

        setTimeout(async () => {
          try {
            await supabase.from('events').delete().eq('id', id)
          } catch { /* background delete failed silently */ }
        }, 0)

        return true
      },

      // ---- Read ----

      getEventsForDate: (date: Date): CalendarEvent[] => {
        const dateKey = formatDate(date)
        const { eventsCache, computedEventsCache, recurringEventsCache, eventExceptionsCache } = get()
        const eventsCacheSnapshot = eventsCache
        const eventExceptionsSnapshot = eventExceptionsCache

        // Return cached computed events if available
        if (computedEventsCache[dateKey]) {
          return computedEventsCache[dateKey]
        }

        const monthKey = getMonthKey(date)
        const recurringEventsForMonth = buildRecurringEventsForMonth(
          date,
          eventsCache,
          recurringEventsCache,
          eventExceptionsCache
        )
        const uniqueEvents = buildCanonicalEventsForDate(dateKey, eventsCache, recurringEventsForMonth)

        scheduleIdleStoreWrite(() => {
          set(state => {
            if (state.eventsCache !== eventsCacheSnapshot || state.eventExceptionsCache !== eventExceptionsSnapshot) {
              return state
            }

            const nextRecurringCache = state.recurringEventsCache[monthKey]
              ? state.recurringEventsCache
              : {
                  ...state.recurringEventsCache,
                  [monthKey]: recurringEventsForMonth,
                }

            if (state.computedEventsCache[dateKey] && nextRecurringCache === state.recurringEventsCache) {
              return state
            }

            return {
              recurringEventsCache: nextRecurringCache,
              computedEventsCache: state.computedEventsCache[dateKey]
                ? state.computedEventsCache
                : {
                    ...state.computedEventsCache,
                    [dateKey]: uniqueEvents,
                  },
            }
          })
        })

        return uniqueEvents
      },

      getEventById: (id: string): CalendarEvent | null => {
        const { eventsCache, computedEventsCache, eventExceptionsCache } = get()

        // Virtual recurring instance IDs
        if (isVirtualEventId(id)) {
          // Check computed cache first
          for (const dateKey of Object.keys(computedEventsCache)) {
            const event = computedEventsCache[dateKey].find(e => e.id === id)
            if (event) return event
          }

          // Generate on-demand from master event
          const virtualDate = id.match(VIRTUAL_ID_PATTERN)![1]
          const masterId = extractMasterId(id)
          const masterEvent = findMasterEvent(eventsCache, masterId)

          if (masterEvent) {
            const hasSeriesBounds =
              !!masterEvent.repeat &&
              masterEvent.repeat !== 'None' &&
              !!masterEvent.series_start_date &&
              !!masterEvent.series_end_date
            if (!hasSeriesBounds) return null
            if (virtualDate < masterEvent.series_start_date! || virtualDate > masterEvent.series_end_date!) return null
            if (virtualDate === masterEvent.date) return null
            const seriesExceptions = eventExceptionsCache[masterId] || []
            const matchingException = seriesExceptions.find((exception) => exception.date === virtualDate)
            if (matchingException?.deleted) return null

            const virtualEvent: CalendarEvent = {
              ...masterEvent,
              id,
              date: virtualDate,
              end_date: virtualDate,
              isRecurringInstance: true,
              seriesMasterId: masterId,
              occurrenceDate: virtualDate,
            }

            // Cache it lazily without putting timer work directly on the current render path.
            scheduleIdleStoreWrite(() => {
              set(state => {
                const existingForDate = state.computedEventsCache[virtualDate] || []
                if (existingForDate.some((event) => event.id === id)) {
                  return state
                }
                const currentExceptions = state.eventExceptionsCache[masterId] || []
                if (currentExceptions.some((exception) => exception.date === virtualDate && exception.deleted)) {
                  return state
                }
                return {
                  computedEventsCache: {
                    ...state.computedEventsCache,
                    [virtualDate]: [...existingForDate, virtualEvent],
                  },
                }
              })
            })

            return virtualEvent
          }
        }

        // Search real events, preferring the canonical earliest-date copy.
        const found = findEventInCache(eventsCache, id)
        if (found) return found.event as CalendarEvent

        return null
      },

      // ---- UI State ----

      isEventSyncing: (eventId: string) => get().pendingSyncs.has(eventId),
      isAnyEventSyncing: () => get().pendingSyncs.size > 0,

      setSelectedEvent: (id) =>
        set((state) => {
          if (state.selectedEventId === id) return state
          if (!state.selectedEventId) return { selectedEventId: id }

          const nextLive = { ...state.liveEventTimes }
          delete nextLive[state.selectedEventId]
          return {
            selectedEventId: id,
            liveEventTimes: id === null ? {} : nextLive,
          }
        }),
      setScrollToEventId: (id) => set({ scrollToEventId: id }),
      setScrollToTop: (value) => set({ scrollToTop: value }),
      setHasEditsEventId: (id) => set({ hasEditsEventId: id }),
      previewEventTime: (id: string, start_time: number, end_time: number) => {
        const { eventsCache, computedEventsCache } = get()
        const found = findEventInCache(eventsCache, id)
        if (!found) return

        const { event: currentEvent, dateKey } = found
        if (currentEvent.start_time === start_time && currentEvent.end_time === end_time) return

        const nextCache = { ...eventsCache }
        const eventIndex = nextCache[dateKey].findIndex((e) => e.id === id)
        if (eventIndex === -1) return

        nextCache[dateKey] = [...nextCache[dateKey]]
        nextCache[dateKey][eventIndex] = {
          ...nextCache[dateKey][eventIndex],
          start_time,
          end_time,
          updated_at: new Date().toISOString(),
        }
        nextCache[dateKey].sort((a, b) => a.start_time - b.start_time)

        const nextComputed = { ...computedEventsCache }
        delete nextComputed[dateKey]

        set({
          eventsCache: nextCache,
          computedEventsCache: nextComputed,
        })
      },
      setLiveEventTime: (id: string, start_time: number, end_time: number) =>
        set((state) => ({
          liveEventTimes: {
            ...state.liveEventTimes,
            [id]: { start_time, end_time },
          },
        })),
      clearLiveEventTime: (id?: string) =>
        set((state) => {
          if (!id) return { liveEventTimes: {} }
          if (!(id in state.liveEventTimes)) return state
          const next = { ...state.liveEventTimes }
          delete next[id]
          return { liveEventTimes: next }
        }),

      updateEventField: (id: string, field: keyof NewEvent, value: EventFieldValue) => {
        if (value === undefined) return

        const { eventsCache, pendingSyncs, pendingUpdates } = get()

        // Virtual recurring instances default to "only-this" semantics.
        if (isVirtualEventId(id)) {
          const virtualEvent = get().getEventById(id)
          const match = id.match(VIRTUAL_ID_PATTERN)
          if (!virtualEvent || !match) return
          const occurrenceDate = match[1]
          void get().splitRecurringEvent(
            virtualEvent,
            occurrenceDate,
            undefined,
            undefined,
            { [field]: value } as Partial<NewEvent>
          )
          return
        }

        const found = findEventInCache(eventsCache, id)
        if (!found) return

        const { event: currentEvent, dateKey } = found
        if (currentEvent[field as keyof Event] === value) return

        const duration = getClockwiseDurationMinutes(currentEvent.start_time, currentEvent.end_time)
        const endTimeValue = field === 'start_time' && typeof value === 'number'
          ? value + duration
          : currentEvent.end_time

        const updatedEvent = {
          ...currentEvent,
          [field]: value,
          ...(field === 'start_time' && typeof value === 'number' && { end_time: endTimeValue }),
          updated_at: new Date().toISOString(),
        }

        const newCache = { ...eventsCache }

        // Handle date changes
        if (field === 'date' && typeof value === 'string' && value !== dateKey) {
          newCache[dateKey] = newCache[dateKey].filter(e => e.id !== id)
          if (newCache[dateKey].length === 0) delete newCache[dateKey]
          if (!newCache[value]) newCache[value] = []
          newCache[value] = [...newCache[value], updatedEvent]
        } else {
          const eventIndex = newCache[dateKey].findIndex(e => e.id === id)
          newCache[dateKey] = [...newCache[dateKey]]
          newCache[dateKey][eventIndex] = updatedEvent
        }

        set({ eventsCache: newCache, computedEventsCache: {}, recurringEventsCache: {}, eventExceptionsCache: {} })

        // Queue update for temp events
        if (currentEvent.isTemp === true || pendingSyncs.has(id)) {
          const newPendingUpdates = new Map(pendingUpdates)
          const existing = newPendingUpdates.get(id) || []
          newPendingUpdates.set(id, [...existing, { [field]: value }])

          if (currentEvent.isTemp === true && !pendingSyncs.has(id)) {
            const newPendingSyncs = new Set(pendingSyncs)
            newPendingSyncs.add(id)
            set({ pendingUpdates: newPendingUpdates, pendingSyncs: newPendingSyncs })
            void get().saveTempEvent(id)
          } else {
            set({ pendingUpdates: newPendingUpdates })
          }

          return
        }

        // Background DB update
        setTimeout(async () => {
          try {
            const updates: Record<string, any> = { [field]: value }
            if (field === 'start_time') updates.end_time = endTimeValue
            await supabase.from('events').update(updates).eq('id', id)
          } catch { /* background field update failed silently */ }
        }, 0)
      },

      updateEventFields: (id: string, updates: Partial<NewEvent>) => {
        const entries = Object.entries(updates).filter(([, value]) => value !== undefined) as [keyof NewEvent, EventFieldValue][]
        if (entries.length === 0) return

        const { eventsCache, pendingSyncs, pendingUpdates } = get()

        if (isVirtualEventId(id)) {
          const virtualEvent = get().getEventById(id)
          const match = id.match(VIRTUAL_ID_PATTERN)
          if (!virtualEvent || !match) return
          const occurrenceDate = match[1]
          void get().splitRecurringEvent(
            virtualEvent,
            occurrenceDate,
            undefined,
            undefined,
            updates
          )
          return
        }

        const found = findEventInCache(eventsCache, id)
        if (!found) return

        const { event: currentEvent, dateKey } = found
        const nextEvent: Event = {
          ...currentEvent,
          ...updates,
          updated_at: new Date().toISOString(),
        }

        const nextDateKey = typeof nextEvent.date === 'string' ? nextEvent.date : dateKey
        const newCache = { ...eventsCache }

        // Remove any stale copies of this event from every cached date bucket first.
        for (const cacheDateKey of Object.keys(newCache)) {
          const filtered = newCache[cacheDateKey].filter(e => e.id !== id)
          if (filtered.length === 0) delete newCache[cacheDateKey]
          else newCache[cacheDateKey] = filtered
        }

        if (!newCache[nextDateKey]) newCache[nextDateKey] = []
        newCache[nextDateKey] = [...newCache[nextDateKey], nextEvent]

        if (newCache[nextDateKey]) {
          newCache[nextDateKey] = [...newCache[nextDateKey]].sort((a, b) => a.start_time - b.start_time)
        }

        set({ eventsCache: newCache, computedEventsCache: {}, recurringEventsCache: {}, eventExceptionsCache: {} })

        if (currentEvent.isTemp === true || pendingSyncs.has(id)) {
          const newPendingUpdates = new Map(pendingUpdates)
          const existing = newPendingUpdates.get(id) || []
          newPendingUpdates.set(id, [...existing, updates])

          if (currentEvent.isTemp === true && !pendingSyncs.has(id)) {
            const newPendingSyncs = new Set(pendingSyncs)
            newPendingSyncs.add(id)
            set({ pendingUpdates: newPendingUpdates, pendingSyncs: newPendingSyncs })
            void get().saveTempEvent(id)
          } else {
            set({ pendingUpdates: newPendingUpdates })
          }

          return
        }

        setTimeout(async () => {
          try {
            await supabase.from('events').update(filterUpdatesForDb(updates)).eq('id', id)
          } catch { /* background field update failed silently */ }
        }, 0)
      },

      syncGoalLinkedEvents: async ({ columnType, bucketKey, previousGoalText, nextGoalText, color, icon }) => {
        const goalType = getGoalTypeLabel(columnType)
        const updates: Partial<NewEvent> = {
          goal: nextGoalText,
          goalColor: color || '',
          goalIcon: icon || '',
        }

        set((state) => {
          const nextCache: EventsCache = {}
          let didChange = false

          for (const [dateKey, events] of Object.entries(state.eventsCache)) {
            nextCache[dateKey] = events.map((event) => {
              if (
                event.goalType !== goalType ||
                event.goal !== previousGoalText ||
                !eventMatchesGoalSyncRange(event, bucketKey)
              ) {
                return event
              }

              didChange = true
              return {
                ...event,
                goal: updates.goal,
                goalColor: updates.goalColor,
                goalIcon: updates.goalIcon,
                updated_at: new Date().toISOString(),
              }
            })
          }

          if (!didChange) return {}

          return {
            eventsCache: nextCache,
            computedEventsCache: {},
            recurringEventsCache: {},
            eventExceptionsCache: {},
          }
        })

        const { data: { user }, error: userError } = await supabase.auth.getUser()
        if (userError || !user) return

        let query = supabase
          .from('events')
          .update(filterUpdatesForDb(updates))
          .eq('user_id', user.id)
          .eq('goal_type', goalType)
          .eq('goal', previousGoalText)

        const range = getBucketDateRange(bucketKey)
        if (range) {
          query = query.gte('date', range.start).lte('date', range.end)
        }

        const { error } = await query
        if (error) {
          console.error('Failed to sync goal-linked events:', error)
        }
      },

      saveSelectedEvent: async () => {
        try {
          const { saveTrigger, selectedEventId: currentSelectedId } = get()
          if (!currentSelectedId) return
          const nextSaveTrigger = saveTrigger + 1
          
          set({ saveTrigger: nextSaveTrigger })

          // Give React a frame to flush sidebar draft state without a fixed 50ms delay.
          await new Promise<void>((resolve) => {
            if (typeof window === "undefined" || typeof window.requestAnimationFrame !== "function") {
              setTimeout(resolve, 0)
              return
            }

            window.requestAnimationFrame(() => resolve())
          })

          // Check if selection hasn't changed
          const { selectedEventId: afterWaitId, eventsCache, saveTrigger: afterTrigger } = get()
          
          // Only proceed if still the same event and same trigger
          if (!afterWaitId || afterWaitId !== currentSelectedId || afterTrigger !== nextSaveTrigger) {
            set({ saveTrigger: 0 })
            return
          }

          const found = findEventInCache(eventsCache, currentSelectedId)
          if (!found) {
            set({ saveTrigger: 0 })
            return
          }

          const { event } = found

          // Close the sidebar as soon as local draft state has been flushed.
          get().setSelectedEvent(null)
          set({ saveTrigger: 0 })

          if (event.isTemp === true) {
            await get().saveTempEvent(currentSelectedId)
          } else {
            const updates: Partial<NewEvent> = {
              title: event.title,
              date: event.date,
              end_date: event.end_date,
              start_time: event.start_time,
              end_time: event.end_time,
              description: event.description,
              notes: event.notes,
              urls: event.urls,
              color: event.color,
              is_all_day: event.is_all_day,
              location: event.location,
              goalType: event.goalType,
              goal: event.goal,
              goalColor: event.goalColor,
              goalIcon: event.goalIcon,
            }

            const filteredUpdates = filterUpdatesForDb(updates)
            const { error } = await supabase
              .from('events')
              .update(filteredUpdates)
              .eq('id', currentSelectedId)

            if (error) {
              throw error
            }
          }
        } catch {
          set({ saveTrigger: 0 })
        }
      },

      showRecurringDialog: (event, actionType, callback) => {
        set({
          recurringDialogOpen: true,
          recurringDialogEvent: event,
          recurringDialogActionType: actionType,
          recurringDialogCallback: callback,
        })
      },

      closeRecurringDialog: () => {
        set({
          recurringDialogOpen: false,
          recurringDialogEvent: null,
          recurringDialogActionType: null,
          recurringDialogCallback: null,
        })
      },

      // ---- Recurring Series Operations ----

      splitRecurringEvent: async (event, selectedDate, newStartTime, newEndTime, updates) => {
        const startTimeForNewEvent = newStartTime ?? updates?.start_time
        const endTimeForNewEvent = newEndTime ?? updates?.end_time
        const { computedEventsCache, eventsCache } = get()

        const masterEventId = event.seriesMasterId || event.id
        const masterEvent = findMasterEvent(eventsCache, masterEventId)

        const originalSeriesEndDate = masterEvent?.series_end_date || event.series_end_date || event.date
        const originalRepeat = masterEvent?.repeat || event.repeat || 'None'
        const originalEventEndDate = masterEvent?.end_date || event.end_date || event.date
        const originalDurationDays = (() => {
          const start = new Date((masterEvent?.date || event.date) + 'T00:00:00')
          const end = new Date(originalEventEndDate + 'T00:00:00')
          return Math.max(0, Math.round((end.getTime() - start.getTime()) / 86400000))
        })()
        const prevDay = (() => {
          const d = new Date(selectedDate + 'T00:00:00')
          d.setDate(d.getDate() - 1)
          return formatDate(d)
        })()

        // Look up original title from master event
        let originalTitle = event.title
        const masterForTitle = findMasterEvent(eventsCache, masterEventId)
          || (() => {
            for (const events of Object.values(computedEventsCache)) {
              const found = events.find(e => e.id === masterEventId)
              if (found) return found
            }
            return null
          })()
        if (masterForTitle) originalTitle = masterForTitle.title

        const isFirstOccurrence = selectedDate === (event.series_start_date || event.date)
        const mergedStandaloneFields: Partial<NewEvent> = {
          title: updates?.title ?? (event.title && event.title !== 'New Event' ? event.title : originalTitle),
          description: updates?.description ?? event.description ?? masterEvent?.description,
          notes: updates?.notes ?? event.notes ?? masterEvent?.notes,
          urls: updates?.urls ?? event.urls ?? masterEvent?.urls,
          date: selectedDate,
          end_date: updates?.end_date ?? event.end_date ?? selectedDate,
          start_time: startTimeForNewEvent ?? event.start_time,
          end_time: endTimeForNewEvent ?? event.end_time,
          color: updates?.color ?? masterEvent?.color ?? event.color,
          is_all_day: updates?.is_all_day ?? masterEvent?.is_all_day ?? event.is_all_day,
          location: updates?.location ?? masterEvent?.location ?? event.location,
          goalType: updates?.goalType ?? masterEvent?.goalType ?? event.goalType,
          goal: updates?.goal ?? masterEvent?.goal ?? event.goal,
          goalColor: updates?.goalColor ?? masterEvent?.goalColor ?? event.goalColor,
          goalIcon: updates?.goalIcon ?? masterEvent?.goalIcon ?? event.goalIcon,
          repeat: 'None',
        }

        // Optimistic update
        if (isFirstOccurrence) {
          // First occurrence: make it non-recurring
          const { eventsCache: currentCache } = get()
          const newCache = { ...currentCache }
          for (const dateKey of Object.keys(newCache)) {
            newCache[dateKey] = newCache[dateKey].map(e => {
              if (e.id === masterEventId) {
                return {
                  ...e,
                  series_end_date: undefined,
                  series_start_date: undefined,
                  repeat: 'None',
                  ...updates,
                  updated_at: new Date().toISOString()
                }
              }
              return e
            })
          }
          set({
            eventsCache: newCache,
            computedEventsCache: {},
            recurringEventsCache: {},
            selectedEventId: masterEventId,
          })
          
          // Fire DB in background
          setTimeout(() => {
            supabase.from('events').update({
              series_end_date: null,
              series_start_date: null,
              repeat: 'None',
              ...filterUpdatesForDb(updates ?? {}),
            }).eq('id', masterEventId).then(({ error }) => {
              if (error) console.error('Failed to update event:', error)
            })
          }, 0)
        } else {
          // Shorten original series and add new standalone event - do optimistically
          const { eventsCache: currentCache, pendingSyncs, pendingUpdates } = get()
          const newCache = { ...currentCache }
          const nextPendingSyncs = new Set(pendingSyncs)
          
          // Shorten master series
          for (const dateKey of Object.keys(newCache)) {
            newCache[dateKey] = newCache[dateKey].map(e => {
              if (e.id === masterEventId) {
                return { ...e, series_end_date: prevDay, updated_at: new Date().toISOString() }
              }
              return e
            })
          }
          
          // Add standalone event at selected date
          const tempId = `temp-${Date.now()}-${Math.random().toString(36).slice(2)}`
          const tempEvent = {
            id: tempId,
            user_id: 'temp',
            title: mergedStandaloneFields.title || 'New Event',
            description: mergedStandaloneFields.description,
            notes: mergedStandaloneFields.notes,
            urls: mergedStandaloneFields.urls,
            date: mergedStandaloneFields.date || selectedDate,
            end_date: mergedStandaloneFields.end_date || selectedDate,
            start_time: mergedStandaloneFields.start_time ?? event.start_time,
            end_time: mergedStandaloneFields.end_time ?? event.end_time,
            color: mergedStandaloneFields.color,
            is_all_day: mergedStandaloneFields.is_all_day,
            location: mergedStandaloneFields.location,
            goalType: mergedStandaloneFields.goalType,
            goal: mergedStandaloneFields.goal,
            goalColor: mergedStandaloneFields.goalColor,
            goalIcon: mergedStandaloneFields.goalIcon,
            repeat: 'None',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            isTemp: true,
          }
          
          if (!newCache[selectedDate]) newCache[selectedDate] = []
          newCache[selectedDate].push(tempEvent)
          nextPendingSyncs.add(tempId)
          
          set({
            eventsCache: newCache,
            computedEventsCache: {},
            recurringEventsCache: {},
            selectedEventId: tempId,
            pendingSyncs: nextPendingSyncs,
          })
          
          // Fire DB in background
          setTimeout(async () => {
            try {
              const { data: { user } } = await supabase.auth.getUser()
              if (!user) return
              
              // Update master series
              await supabase.from('events').update({ series_end_date: prevDay }).eq('id', masterEventId)
              
              // Insert new standalone event
              const queuedUpdates = (get().pendingUpdates.get(tempId) || [])
              const mergedQueuedUpdates = Object.assign({}, ...queuedUpdates)
              const finalStandaloneFields = {
                ...mergedStandaloneFields,
                ...mergedQueuedUpdates,
              }
              const newEventData = buildEventForDb(finalStandaloneFields, user.id)
              
              const { data: result } = await supabase.from('events').insert([newEventData]).select().single()
              
              if (result) {
                const realEvent = dbRowToEvent(result)
                const {
                  eventsCache: finalCache,
                  selectedEventId: currentSelectedId,
                  pendingSyncs: currentPendingSyncs,
                  pendingUpdates: currentPendingUpdates,
                } = get()
                const nextPendingSyncs = new Set(currentPendingSyncs)
                nextPendingSyncs.delete(tempId)
                const nextPendingUpdates = new Map(currentPendingUpdates)
                nextPendingUpdates.delete(tempId)
                set({
                  eventsCache: {
                    ...finalCache,
                    [selectedDate]: (finalCache[selectedDate] || []).map(e => e.id === tempId ? realEvent : e)
                  },
                  selectedEventId: currentSelectedId === tempId ? realEvent.id : currentSelectedId,
                  pendingSyncs: nextPendingSyncs,
                  pendingUpdates: nextPendingUpdates,
                })
              }
            } catch (err) {
              console.error('Failed to save split event:', err)
              const {
                eventsCache: finalCache,
                pendingSyncs: currentPendingSyncs,
                pendingUpdates: currentPendingUpdates,
                selectedEventId: currentSelectedId,
              } = get()
              const nextPendingSyncs = new Set(currentPendingSyncs)
              nextPendingSyncs.delete(tempId)
              const nextPendingUpdates = new Map(currentPendingUpdates)
              nextPendingUpdates.delete(tempId)
              set({
                eventsCache: {
                  ...finalCache,
                  [selectedDate]: (finalCache[selectedDate] || []).filter(e => e.id !== tempId),
                },
                pendingSyncs: nextPendingSyncs,
                pendingUpdates: nextPendingUpdates,
                selectedEventId: currentSelectedId === tempId ? null : currentSelectedId,
              })
            }
          }, 0)
        }

        // Create new recurring series from next occurrence in background
        const getNextDate = () => {
          const d = new Date(selectedDate + 'T00:00:00')
          switch (originalRepeat) {
            case 'Daily': d.setDate(d.getDate() + 1); break
            case 'Weekly': d.setDate(d.getDate() + 7); break
            case 'Monthly': d.setMonth(d.getMonth() + 1); break
            case 'Yearly': d.setFullYear(d.getFullYear() + 1); break
            default: d.setDate(d.getDate() + 1)
          }
          return formatDate(d)
        }

        const nextOccurrence = getNextDate()
        if (nextOccurrence <= originalSeriesEndDate) {
          const nextSeriesEndDate = originalSeriesEndDate
          const tempNextSeriesId = `temp-series-${Date.now()}-${Math.random().toString(36).slice(2)}`
          const tempNextSeriesEvent: Event = {
            id: tempNextSeriesId,
            user_id: 'temp-user',
            title: originalTitle,
            description: masterEvent?.description ?? event.description,
            notes: masterEvent?.notes ?? event.notes,
            urls: masterEvent?.urls ?? event.urls,
            date: nextOccurrence,
            end_date: addDaysToDateStr(nextOccurrence, originalDurationDays),
            start_time: masterEvent?.start_time ?? event.start_time,
            end_time: masterEvent?.end_time ?? event.end_time,
            color: masterEvent?.color ?? event.color,
            is_all_day: masterEvent?.is_all_day ?? event.is_all_day,
            location: masterEvent?.location ?? event.location,
            goalType: masterEvent?.goalType ?? event.goalType,
            goal: masterEvent?.goal ?? event.goal,
            goalColor: masterEvent?.goalColor ?? event.goalColor,
            goalIcon: masterEvent?.goalIcon ?? event.goalIcon,
            repeat: originalRepeat,
            series_start_date: nextOccurrence,
            series_end_date: nextSeriesEndDate,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            isTemp: true,
          }

          const { pendingSyncs } = get()
          const nextPendingSyncs = new Set(pendingSyncs)
          nextPendingSyncs.add(tempNextSeriesId)

          set(state => ({
            eventsCache: {
              ...state.eventsCache,
              [nextOccurrence]: [...(state.eventsCache[nextOccurrence] || []), tempNextSeriesEvent],
            },
            computedEventsCache: {},
            recurringEventsCache: {},
            eventExceptionsCache: {},
            pendingSyncs: nextPendingSyncs,
          }))

          setTimeout(async () => {
            try {
              const { data: { user } } = await supabase.auth.getUser()
              if (!user) return

              const queuedUpdates = (get().pendingUpdates.get(tempNextSeriesId) || [])
              const mergedQueuedUpdates = Object.assign({}, ...queuedUpdates)
              const event3Data = buildEventForDb({
                title: originalTitle,
                description: masterEvent?.description ?? event.description,
                notes: masterEvent?.notes ?? event.notes,
                urls: masterEvent?.urls ?? event.urls,
                date: nextOccurrence,
                end_date: addDaysToDateStr(nextOccurrence, originalDurationDays),
                start_time: masterEvent?.start_time ?? event.start_time,
                end_time: masterEvent?.end_time ?? event.end_time,
                color: masterEvent?.color ?? event.color,
                is_all_day: masterEvent?.is_all_day ?? event.is_all_day,
                location: masterEvent?.location ?? event.location,
                repeat: originalRepeat,
                series_start_date: nextOccurrence,
                series_end_date: nextSeriesEndDate,
                ...mergedQueuedUpdates,
              }, user.id)

              const { data: result, error } = await supabase
                .from('events')
                .insert([event3Data])
                .select()
                .single()

              if (error || !result) throw error

              const realSeriesEvent = dbRowToEvent(result)
              const {
                eventsCache: finalCache,
                pendingSyncs: currentPendingSyncs,
                pendingUpdates: currentPendingUpdates,
                selectedEventId: currentSelectedId,
              } = get()
              const nextPendingSyncs = new Set(currentPendingSyncs)
              nextPendingSyncs.delete(tempNextSeriesId)
              const nextPendingUpdates = new Map(currentPendingUpdates)
              nextPendingUpdates.delete(tempNextSeriesId)
              set({
                eventsCache: {
                  ...finalCache,
                  [nextOccurrence]: (finalCache[nextOccurrence] || []).map(e =>
                    e.id === tempNextSeriesId ? realSeriesEvent : e
                  ),
                },
                computedEventsCache: {},
                recurringEventsCache: {},
                eventExceptionsCache: {},
                pendingSyncs: nextPendingSyncs,
                pendingUpdates: nextPendingUpdates,
                selectedEventId: currentSelectedId === tempNextSeriesId ? realSeriesEvent.id : currentSelectedId,
              })
            } catch {
              const {
                eventsCache: finalCache,
                pendingSyncs: currentPendingSyncs,
                pendingUpdates: currentPendingUpdates,
                selectedEventId: currentSelectedId,
              } = get()
              const nextPendingSyncs = new Set(currentPendingSyncs)
              nextPendingSyncs.delete(tempNextSeriesId)
              const nextPendingUpdates = new Map(currentPendingUpdates)
              nextPendingUpdates.delete(tempNextSeriesId)
              set({
                eventsCache: {
                  ...finalCache,
                  [nextOccurrence]: (finalCache[nextOccurrence] || []).filter(e => e.id !== tempNextSeriesId),
                },
                computedEventsCache: {},
                recurringEventsCache: {},
                eventExceptionsCache: {},
                pendingSyncs: nextPendingSyncs,
                pendingUpdates: nextPendingUpdates,
                selectedEventId: currentSelectedId === tempNextSeriesId ? null : currentSelectedId,
              })
            }
          }, 0)
        }
      },

      updateThisAndFollowing: async (event, selectedDate, newStartTime, newEndTime, updates) => {
        const startTimeForNewEvent = updates?.start_time ?? newStartTime
        const endTimeForNewEvent = updates?.end_time ?? newEndTime
        const { eventsCache } = get()

        const masterEventId = event.seriesMasterId || event.id
        const masterEvent = findMasterEvent(eventsCache, masterEventId)

        const originalSeriesEndDate = masterEvent?.series_end_date || event.series_end_date || event.date
        const originalRepeat = masterEvent?.repeat || event.repeat || 'None'
        const nextSeriesEndDate = originalSeriesEndDate
        const prevDay = (() => {
          const d = new Date(selectedDate + 'T00:00:00')
          d.setDate(d.getDate() - 1)
          return formatDate(d)
        })()

        // Optimistically shorten original series in cache
        const { eventsCache: currentEventsCache } = get()
        const newCache = { ...currentEventsCache }
        for (const dateKey of Object.keys(newCache)) {
          newCache[dateKey] = newCache[dateKey].map(e => {
            if (e.id === masterEventId) {
              return { ...e, series_end_date: prevDay, updated_at: new Date().toISOString() }
            }
            return e
          })
        }
        set({
          eventsCache: newCache,
          computedEventsCache: {},
          recurringEventsCache: {},
          eventExceptionsCache: {},
        })

        // Create new series in cache optimistically
        const tempSeriesId = `temp-series-${Date.now()}-${Math.random().toString(36).slice(2)}`
        const mergedSeriesFields: Partial<NewEvent> = {
          title: updates?.title ?? event.title,
          description: updates?.description ?? masterEvent?.description ?? event.description,
          notes: updates?.notes ?? masterEvent?.notes ?? event.notes,
          urls: updates?.urls ?? masterEvent?.urls ?? event.urls,
          date: selectedDate,
          end_date: updates?.end_date ?? event.end_date ?? selectedDate,
          start_time: startTimeForNewEvent ?? masterEvent?.start_time ?? event.start_time,
          end_time: endTimeForNewEvent ?? masterEvent?.end_time ?? event.end_time,
          color: updates?.color ?? masterEvent?.color ?? event.color,
          is_all_day: updates?.is_all_day ?? masterEvent?.is_all_day ?? event.is_all_day,
          location: updates?.location ?? masterEvent?.location ?? event.location,
          goalType: updates?.goalType ?? masterEvent?.goalType ?? event.goalType,
          goal: updates?.goal ?? masterEvent?.goal ?? event.goal,
          goalColor: updates?.goalColor ?? masterEvent?.goalColor ?? event.goalColor,
          goalIcon: updates?.goalIcon ?? masterEvent?.goalIcon ?? event.goalIcon,
          repeat: originalRepeat,
          series_start_date: selectedDate,
          series_end_date: nextSeriesEndDate,
        }
        const tempSeriesCached: Event = {
          id: tempSeriesId,
          user_id: 'temp-user',
          title: mergedSeriesFields.title || 'New Event',
          description: mergedSeriesFields.description,
          notes: mergedSeriesFields.notes,
          urls: mergedSeriesFields.urls,
          date: mergedSeriesFields.date || selectedDate,
          end_date: mergedSeriesFields.end_date || selectedDate,
          start_time: mergedSeriesFields.start_time ?? event.start_time,
          end_time: mergedSeriesFields.end_time ?? event.end_time,
          color: mergedSeriesFields.color,
          is_all_day: mergedSeriesFields.is_all_day,
          location: mergedSeriesFields.location,
          goalType: mergedSeriesFields.goalType,
          goal: mergedSeriesFields.goal,
          goalColor: mergedSeriesFields.goalColor,
          goalIcon: mergedSeriesFields.goalIcon,
          repeat: originalRepeat,
          series_start_date: selectedDate,
          series_end_date: nextSeriesEndDate,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          isTemp: true,
        }

        const { pendingSyncs } = get()
        const nextPendingSyncs = new Set(pendingSyncs)
        nextPendingSyncs.add(tempSeriesId)

        set(state => ({
          eventsCache: {
            ...state.eventsCache,
            [selectedDate]: [...(state.eventsCache[selectedDate] || []), tempSeriesCached],
          },
          computedEventsCache: {},
          recurringEventsCache: {},
          eventExceptionsCache: {},
          pendingSyncs: nextPendingSyncs,
          selectedEventId: tempSeriesId,
        }))

        // Fire DB operations in background
        setTimeout(async () => {
          try {
            // Update master event series_end_date
            await supabase.from('events').update({ series_end_date: prevDay }).eq('id', masterEventId)

            // Insert new series
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) return

            const queuedUpdates = (get().pendingUpdates.get(tempSeriesId) || [])
            const mergedQueuedUpdates = Object.assign({}, ...queuedUpdates)
            const newSeriesData = buildEventForDb({ ...mergedSeriesFields, ...mergedQueuedUpdates }, user.id)

            const { data: result, error } = await supabase
              .from('events')
              .insert([newSeriesData])
              .select()
              .single()

            if (error || !result) return

            // Replace temp with real event
            const realSeriesCached = dbRowToEvent(result)
            const {
              eventsCache: finalCache,
              pendingSyncs: currentPendingSyncs,
              pendingUpdates: currentPendingUpdates,
              selectedEventId: currentSelectedId,
            } = get()
            const nextPendingSyncs = new Set(currentPendingSyncs)
            nextPendingSyncs.delete(tempSeriesId)
            const nextPendingUpdates = new Map(currentPendingUpdates)
            nextPendingUpdates.delete(tempSeriesId)
            set({
              eventsCache: {
                ...finalCache,
                [selectedDate]: (finalCache[selectedDate] || []).map(e =>
                  e.id === tempSeriesId ? realSeriesCached : e
                ),
              },
              computedEventsCache: {},
              recurringEventsCache: {},
              eventExceptionsCache: {},
              pendingSyncs: nextPendingSyncs,
              pendingUpdates: nextPendingUpdates,
              selectedEventId: currentSelectedId === tempSeriesId ? realSeriesCached.id : currentSelectedId,
            })
          } catch {
            const {
              eventsCache: finalCache,
              pendingSyncs: currentPendingSyncs,
              pendingUpdates: currentPendingUpdates,
              selectedEventId: currentSelectedId,
            } = get()
            const nextPendingSyncs = new Set(currentPendingSyncs)
            nextPendingSyncs.delete(tempSeriesId)
            const nextPendingUpdates = new Map(currentPendingUpdates)
            nextPendingUpdates.delete(tempSeriesId)
            set({
              eventsCache: {
                ...finalCache,
                [selectedDate]: (finalCache[selectedDate] || []).filter(e => e.id !== tempSeriesId),
              },
              computedEventsCache: {},
              recurringEventsCache: {},
              eventExceptionsCache: {},
              pendingSyncs: nextPendingSyncs,
              pendingUpdates: nextPendingUpdates,
              selectedEventId: currentSelectedId === tempSeriesId ? null : currentSelectedId,
            })
          }
        }, 0)
      },

      deleteSingleOccurrence: async (event, selectedDate) => {
        const { eventsCache, eventExceptionsCache } = get()
        const masterEventId = event.seriesMasterId || event.id
        const masterEvent = findMasterEvent(eventsCache, masterEventId)
        if (!masterEvent) return

        const isMasterOccurrence = selectedDate === masterEvent.date
        if (isMasterOccurrence) {
          const repeatType = masterEvent.repeat || event.repeat || 'None'
          const seriesEndDate = masterEvent.series_end_date || event.series_end_date || masterEvent.date
          const nextOccurrence = getNextOccurrence(selectedDate, repeatType)

          if (repeatType === 'None' || nextOccurrence > seriesEndDate) {
            await get().deleteEvent(masterEventId)
            return
          }

          const durationDays = (() => {
            const start = new Date(masterEvent.date + 'T00:00:00')
            const end = new Date((masterEvent.end_date || masterEvent.date) + 'T00:00:00')
            return Math.max(0, Math.round((end.getTime() - start.getTime()) / 86400000))
          })()

          await get().updateEvent(masterEventId, {
            date: nextOccurrence,
            end_date: addDaysToDateStr(nextOccurrence, durationDays),
            series_start_date: nextOccurrence,
          })
          return
        }

        // Optimistically add exception to cache
        const newException: EventException = {
          id: `temp-exception-${Date.now()}`,
          series_id: masterEventId,
          date: selectedDate,
          deleted: true as any,
        }

        const existingExceptions = eventExceptionsCache[masterEventId] || []
        const updatedExceptions = [...existingExceptions, newException]

        set({
          eventExceptionsCache: {
            ...eventExceptionsCache,
            [masterEventId]: updatedExceptions,
          },
          computedEventsCache: {},
          recurringEventsCache: {},
        })

        // Fire DB in background
        setTimeout(async () => {
          try {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) return

            const { data: existingExceptions, error: selectError } = await supabase
              .from('exceptions')
              .select('id')
              .eq('series_id', masterEventId)
              .eq('date', selectedDate)
              .limit(1)

            if (selectError) throw selectError

            const existingExceptionId = existingExceptions?.[0]?.id

            if (existingExceptionId) {
              const { error: updateError } = await supabase
                .from('exceptions')
                .update({ deleted: true })
                .eq('id', existingExceptionId)

              if (updateError) throw updateError
            } else {
              const payloadWithUser = {
                series_id: masterEventId,
                user_id: user.id,
                date: selectedDate,
                deleted: true,
              }

              let insertError: Error | null = null

              const withUserResult = await supabase
                .from('exceptions')
                .insert([payloadWithUser])

              if (withUserResult.error) {
                const message = withUserResult.error.message || ''
                const details = withUserResult.error.details || ''
                const hints = withUserResult.error.hint || ''
                const combined = `${message} ${details} ${hints}`.toLowerCase()

                const unknownUserColumn =
                  combined.includes('user_id') &&
                  (combined.includes('column') || combined.includes('schema cache'))

                if (!unknownUserColumn) {
                  throw withUserResult.error
                }

                const fallbackResult = await supabase
                  .from('exceptions')
                  .insert([{
                    series_id: masterEventId,
                    date: selectedDate,
                    deleted: true,
                  }])

                insertError = fallbackResult.error
              }

              if (insertError) throw insertError
            }
          } catch (error) {
            console.error('Failed to persist deleted recurring occurrence:', error)
            // Rollback on failure
            set({
              eventExceptionsCache: {
                ...eventExceptionsCache,
                [masterEventId]: existingExceptions,
              },
            })
          }
        }, 0)
      },

      clearCache: () => {
        set({
          eventsCache: {},
          computedEventsCache: {},
          recurringEventsCache: {},
          eventExceptionsCache: {},
          cacheStartDate: null,
          cacheEndDate: null,
          cachedUserId: null,
          pendingDeletes: new Set(),
          liveEventTimes: {},
        })
      },
    }),
    {
      name: 'events-storage',
      partialize: (state) => ({
        eventsCache: Object.fromEntries(
          Object.entries(state.eventsCache)
            .map(([dateKey, events]) => [dateKey, events.filter((event) => event.isTemp !== true)])
            .filter(([, events]) => events.length > 0)
        ),
        eventExceptionsCache: state.eventExceptionsCache,
        cacheStartDate: state.cacheStartDate,
        cacheEndDate: state.cacheEndDate,
        cachedUserId: state.cachedUserId,
      }),
    }
  )
)
