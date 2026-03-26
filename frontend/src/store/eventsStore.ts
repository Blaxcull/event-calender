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
  addDays,
  getMonthRange,
  getMonthKey,
} from './dateUtils'

import {
  generateRecurringDatesForMonth,
  generateRecurringInstances,
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

  // UI state
  selectedEventId: string | null
  scrollToEventId: string | null
  scrollToTop: boolean
  saveTrigger: number
  hasEditsEventId: string | null

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
  saveSelectedEvent: () => Promise<void>
  showRecurringDialog: (event: CalendarEvent, actionType: 'edit' | 'delete', callback: (choice: string) => void) => void
  closeRecurringDialog: () => void
  setHasEditsEventId: (id: string | null) => void
  splitRecurringEvent: (event: CalendarEvent, selectedDate: string, newStartTime?: number, newEndTime?: number, updates?: Partial<NewEvent>) => Promise<void>
  updateThisAndFollowing: (event: CalendarEvent, selectedDate: string, newStartTime?: number, newEndTime?: number, updates?: Partial<NewEvent>) => Promise<void>
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
  for (const dateKey of Object.keys(cache)) {
    const event = cache[dateKey].find(e => e.id === id)
    if (event) return { event, dateKey }
  }
  return null
}

/** Find a master recurring event by ID across all cache dates */
function findMasterEvent(cache: EventsCache, masterId: string): Event | null {
  for (const events of Object.values(cache)) {
    const found = events.find(e => e.id === masterId)
    if (found) return found
  }
  return null
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
      selectedEventId: null,
      scrollToEventId: null,
      scrollToTop: false,
      saveTrigger: 0,
      recurringDialogOpen: false,
      recurringDialogEvent: null,
      recurringDialogActionType: null,
      recurringDialogCallback: null,
      hasEditsEventId: null,

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
          const { eventsCache: oldCache, pendingSyncs } = get()
          const newCache: EventsCache = { ...oldCache }

          data?.forEach((row: Record<string, any>) => {
            const event = dbRowToEvent(row)
            if (!newCache[event.date]) newCache[event.date] = []
            newCache[event.date] = newCache[event.date].filter(e => e.id !== event.id)
            newCache[event.date].push(event)
            newCache[event.date].sort((a, b) => a.start_time - b.start_time)
          })

          // Preserve temp events still syncing
          for (const date of Object.keys(oldCache)) {
            const tempEvents = oldCache[date].filter(e => pendingSyncs.has(e.id))
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

          set({
            eventsCache: newCache,
            computedEventsCache: {},
            cacheStartDate: startStr,
            cacheEndDate: endStr,
            cachedUserId: user.id,
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
        const { eventsCache, computedEventsCache, pendingSyncs, pendingUpdates } = get()
        const found = findEventInCache(eventsCache, id)

        if (!found) return null

        const { event: currentEvent, dateKey: oldDate } = found
        const newCache = { ...eventsCache }
        const newComputedCache = { ...computedEventsCache }

        const updatedEvent = {
          ...currentEvent,
          ...updates,
          updated_at: new Date().toISOString(),
        }

        // Remove from old date
        const eventIndex = newCache[oldDate].findIndex(e => e.id === id)
        const oldEvents = [...newCache[oldDate]]
        oldEvents.splice(eventIndex, 1)

        // Add to new date (or same date)
        const newDate = updates.date || oldDate
        if (!newCache[newDate]) newCache[newDate] = []
        const newDateEvents = newDate === oldDate ? oldEvents : [...newCache[newDate]]
        newDateEvents.push(updatedEvent)
        newDateEvents.sort((a, b) => a.start_time - b.start_time)
        newCache[newDate] = newDateEvents

        if (newDate !== oldDate) {
          newCache[oldDate] = oldEvents
          if (newCache[oldDate].length === 0) delete newCache[oldDate]
        }

        delete newComputedCache[oldDate]
        delete newComputedCache[newDate]

        set({
          eventsCache: newCache,
          computedEventsCache: newComputedCache,
          recurringEventsCache: {},
          eventExceptionsCache: {},
        })

        // Queue update for temp events
        if (updatedEvent.isTemp === true || pendingSyncs.has(id)) {
          const newPendingUpdates = new Map(pendingUpdates)
          const existing = newPendingUpdates.get(id) || []
          newPendingUpdates.set(id, [...existing, updates])
          set({ pendingUpdates: newPendingUpdates })
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
        await get().updateEvent(seriesMasterId, updates)
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

        if (isRecurringEvent) {
          set({ eventsCache: newCache, computedEventsCache: {}, recurringEventsCache: {}, eventExceptionsCache: {} })
        } else {
          for (const date of affectedDates) delete newComputedCache[date]
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

        // Return cached computed events if available
        if (computedEventsCache[dateKey]) {
          return computedEventsCache[dateKey]
        }

        // Real events for this date
        const realEvents: CalendarEvent[] = (eventsCache[dateKey] || []).map(e => ({
          ...e,
          isRecurringInstance: false,
        }))

        // Include multi-day events that span into this date from other cache dates
        for (const [otherDateKey, dayEvents] of Object.entries(eventsCache)) {
          if (otherDateKey === dateKey) continue
          for (const event of dayEvents) {
            const eventEndDate = event.end_date || event.date
            if (event.date <= dateKey && eventEndDate >= dateKey) {
              realEvents.push({ ...event, isRecurringInstance: false })
            }
          }
        }

        // Generate or retrieve recurring instances
        const monthKey = getMonthKey(date)
        let recurringEvents: CalendarEvent[] = []

        if (recurringEventsCache[monthKey]) {
          recurringEvents = recurringEventsCache[monthKey].filter(e => e.date === dateKey)
        } else {
          const { monthStart, monthEnd } = getMonthRange(date)

          // Find all master recurring events
          const seenMasterIds = new Set<string>()
          const allMasterEvents: Event[] = []
          for (const dayEvents of Object.values(eventsCache)) {
            for (const event of dayEvents) {
              if (
                event.repeat && event.repeat !== 'None' &&
                event.series_start_date && event.series_end_date &&
                event.series_end_date >= monthStart &&
                event.series_start_date <= monthEnd &&
                !seenMasterIds.has(event.id)
              ) {
                seenMasterIds.add(event.id)
                allMasterEvents.push(event)
              }
            }
          }

          // Generate instances for each master event
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

          // Cache for the month (deferred to avoid setState during render)
          setTimeout(() => {
            set(state => ({
              recurringEventsCache: {
                ...state.recurringEventsCache,
                [monthKey]: generatedRecurring,
              },
            }))
          }, 0)

          recurringEvents = generatedRecurring.filter(e => e.date === dateKey)
        }

        // Combine and deduplicate
        const allEvents = [...realEvents, ...recurringEvents]
        const seenIds = new Set<string>()
        const uniqueEvents = allEvents.filter(event => {
          if (seenIds.has(event.id)) return false
          seenIds.add(event.id)
          return true
        })
        uniqueEvents.sort((a, b) => a.start_time - b.start_time)

        // Cache computed result (deferred)
        setTimeout(() => {
          set(state => ({
            computedEventsCache: {
              ...state.computedEventsCache,
              [dateKey]: uniqueEvents,
            },
          }))
        }, 0)

        return uniqueEvents
      },

      getEventById: (id: string): CalendarEvent | null => {
        const { eventsCache, computedEventsCache } = get()

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
            const virtualEvent: CalendarEvent = {
              ...masterEvent,
              id,
              date: virtualDate,
              end_date: virtualDate,
              isRecurringInstance: true,
              seriesMasterId: masterId,
              occurrenceDate: virtualDate,
            }

            // Cache it (deferred)
            setTimeout(() => {
              set(state => ({
                computedEventsCache: {
                  ...state.computedEventsCache,
                  [virtualDate]: [...(state.computedEventsCache[virtualDate] || []), virtualEvent],
                },
              }))
            }, 0)

            return virtualEvent
          }
        }

        // Search real events
        for (const dateKey of Object.keys(eventsCache)) {
          const event = eventsCache[dateKey].find(e => e.id === id)
          if (event) return event as CalendarEvent
        }

        return null
      },

      // ---- UI State ----

      isEventSyncing: (eventId: string) => get().pendingSyncs.has(eventId),
      isAnyEventSyncing: () => get().pendingSyncs.size > 0,

      setSelectedEvent: (id) => set({ selectedEventId: id }),
      setScrollToEventId: (id) => set({ scrollToEventId: id }),
      setScrollToTop: (value) => set({ scrollToTop: value }),
      setHasEditsEventId: (id) => set({ hasEditsEventId: id }),

      updateEventField: (id: string, field: keyof NewEvent, value: EventFieldValue) => {
        if (value === undefined) return

        const { eventsCache, pendingSyncs, pendingUpdates } = get()

        // Virtual events redirect to series update
        if (isVirtualEventId(id)) {
          const masterId = extractMasterId(id)
          get().updateAllInSeries(masterId, { [field]: value })
          return
        }

        const found = findEventInCache(eventsCache, id)
        if (!found) return

        const { event: currentEvent, dateKey } = found
        if (currentEvent[field as keyof Event] === value) return

        const duration = currentEvent.end_time - currentEvent.start_time
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
          set({ pendingUpdates: newPendingUpdates })
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

      saveSelectedEvent: async () => {
        try {
          const { saveTrigger } = get()
          set({ saveTrigger: saveTrigger + 1 })

          // Wait for EventEditor to flush local state
          await new Promise(resolve => setTimeout(resolve, 50))

          const { selectedEventId, eventsCache } = get()
          if (!selectedEventId) return

          const found = findEventInCache(eventsCache, selectedEventId)
          if (!found) return

          const { event } = found
          set({ selectedEventId: null, saveTrigger: 0 })

          if (event.isTemp === true) {
            await get().saveTempEvent(selectedEventId)
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
            }

            await get().updateEvent(selectedEventId, updates)

            setTimeout(async () => {
              try {
                await supabase.from('events').update(updates).eq('id', event.id)
              } catch { /* background save failed silently */ }
            }, 0)
          }
        } catch { /* save failed silently */ }
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

        if (isFirstOccurrence) {
          // First occurrence: make it non-recurring
          await get().updateEvent(masterEventId, {
            series_end_date: undefined,
            series_start_date: undefined,
            repeat: 'None',
            ...updates,
          })
        } else {
          // Shorten original series
          await get().updateEvent(masterEventId, { series_end_date: prevDay })

          // Create standalone event at selected date
          const event2Title = updates?.title ?? (event.title && event.title !== 'New Event' ? event.title : originalTitle)
          await get().addEventOptimistic({
            title: event2Title,
            description: updates?.description ?? event.description ?? masterEvent?.description,
            notes: updates?.notes ?? event.notes ?? masterEvent?.notes,
            urls: updates?.urls ?? event.urls ?? masterEvent?.urls,
            date: selectedDate,
            end_date: selectedDate,
            start_time: startTimeForNewEvent ?? event.start_time,
            end_time: endTimeForNewEvent ?? event.end_time,
            color: masterEvent?.color ?? event.color,
            is_all_day: masterEvent?.is_all_day ?? event.is_all_day,
            location: masterEvent?.location ?? event.location,
            repeat: 'None',
          })
        }

        // Create new recurring series from next occurrence
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
          const { data: { user } } = await supabase.auth.getUser()
          if (!user) return

          const event3Data = buildEventForDb({
            title: originalTitle,
            description: masterEvent?.description ?? event.description,
            notes: masterEvent?.notes ?? event.notes,
            urls: masterEvent?.urls ?? event.urls,
            date: nextOccurrence,
            end_date: nextOccurrence,
            start_time: masterEvent?.start_time ?? event.start_time,
            end_time: masterEvent?.end_time ?? event.end_time,
            color: masterEvent?.color ?? event.color,
            is_all_day: masterEvent?.is_all_day ?? event.is_all_day,
            location: masterEvent?.location ?? event.location,
            repeat: originalRepeat,
            series_start_date: nextOccurrence,
            series_end_date: originalSeriesEndDate,
          }, user.id)

          const { data: result, error } = await supabase
            .from('events')
            .insert([event3Data])
            .select()
            .single()

          if (error || !result) return

          const event3Cached = dbRowToEvent(result)
          const { eventsCache: currentEventsCache } = get()
          set({
            eventsCache: {
              ...currentEventsCache,
              [result.date]: [...(currentEventsCache[result.date] || []), event3Cached],
            },
            computedEventsCache: {},
            recurringEventsCache: {},
            eventExceptionsCache: {},
          })
        }
      },

      updateThisAndFollowing: async (event, selectedDate, newStartTime, newEndTime, updates) => {
        const startTimeForNewEvent = newStartTime ?? updates?.start_time
        const endTimeForNewEvent = newEndTime ?? updates?.end_time
        const { eventsCache } = get()

        const masterEventId = event.seriesMasterId || event.id
        const masterEvent = findMasterEvent(eventsCache, masterEventId)

        const originalSeriesEndDate = masterEvent?.series_end_date || event.series_end_date || event.date
        const originalRepeat = masterEvent?.repeat || event.repeat || 'None'
        const prevDay = (() => {
          const d = new Date(selectedDate + 'T00:00:00')
          d.setDate(d.getDate() - 1)
          return formatDate(d)
        })()

        // Shorten original series
        await get().updateEvent(masterEventId, { series_end_date: prevDay })

        // Create new series
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return

        const newSeriesData = buildEventForDb({
          title: updates?.title ?? event.title,
          description: updates?.description ?? masterEvent?.description ?? event.description,
          notes: updates?.notes ?? masterEvent?.notes ?? event.notes,
          urls: updates?.urls ?? masterEvent?.urls ?? event.urls,
          date: selectedDate,
          end_date: selectedDate,
          start_time: startTimeForNewEvent ?? masterEvent?.start_time ?? event.start_time,
          end_time: endTimeForNewEvent ?? masterEvent?.end_time ?? event.end_time,
          color: updates?.color ?? masterEvent?.color ?? event.color,
          is_all_day: updates?.is_all_day ?? masterEvent?.is_all_day ?? event.is_all_day,
          location: updates?.location ?? masterEvent?.location ?? event.location,
          repeat: originalRepeat,
          series_start_date: selectedDate,
          series_end_date: originalSeriesEndDate,
        }, user.id)

        // Optimistic add
        const tempSeriesId = `temp-series-${Date.now()}-${Math.random().toString(36).slice(2)}`
        const { eventsCache: currentEventsCache } = get()
        const tempSeriesCached: Event = {
          id: tempSeriesId,
          user_id: user.id,
          title: newSeriesData.title,
          date: newSeriesData.date,
          end_date: newSeriesData.end_date,
          start_time: newSeriesData.start_time,
          end_time: newSeriesData.end_time,
          description: newSeriesData.description,
          notes: newSeriesData.notes,
          urls: newSeriesData.urls,
          color: newSeriesData.color,
          is_all_day: newSeriesData.is_all_day,
          location: newSeriesData.location,
          repeat: newSeriesData.repeat,
          series_start_date: newSeriesData.series_start_date,
          series_end_date: newSeriesData.series_end_date,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          isTemp: true,
        }

        set({
          eventsCache: {
            ...currentEventsCache,
            [selectedDate]: [...(currentEventsCache[selectedDate] || []), tempSeriesCached],
          },
          computedEventsCache: {},
          recurringEventsCache: {},
          eventExceptionsCache: {},
        })

        // Insert to DB
        const { data: result, error } = await supabase
          .from('events')
          .insert([newSeriesData])
          .select()
          .single()

        if (error || !result) {
          // Rollback on failure
          const { eventsCache: cc } = get()
          set({
            eventsCache: {
              ...cc,
              [selectedDate]: (cc[selectedDate] || []).filter(e => e.id !== tempSeriesId),
            },
            computedEventsCache: {},
            recurringEventsCache: {},
            eventExceptionsCache: {},
          })
          return
        }

        // Replace temp with real event
        const realSeriesCached = dbRowToEvent(result)
        const { eventsCache: finalCache } = get()
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
        })
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
        })
      },
    }),
    {
      name: 'events-storage',
      partialize: (state) => ({
        eventsCache: state.eventsCache,
        cacheStartDate: state.cacheStartDate,
        cacheEndDate: state.cacheEndDate,
        cachedUserId: state.cachedUserId,
      }),
    }
  )
)
