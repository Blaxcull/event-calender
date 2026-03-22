import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { supabase } from '@/lib/supabase'

type EventFieldValue = string | number | boolean | string[] | undefined

export type { EventFieldValue }

export interface Event {
  id: string
  user_id: string
  title: string
  description?: string
  notes?: string
  urls?: string[]
  date: string // ISO date string YYYY-MM-DD
  end_date: string // ISO date string YYYY-MM-DD for multi-day events
  start_time: number // Minutes since midnight
  end_time: number // Minutes since midnight
  color?: string
  is_all_day?: boolean
  location?: string
  repeat?: string // For UI display only (no recurring logic)
  series_start_date?: string // Start date of recurring series
  series_end_date?: string // End date of recurring series
  reminder?: string
  goalType?: string
  goal?: string
  earlyReminder?: string
  allDay?: string
  created_at?: string
  updated_at?: string
  // For optimistic updates
  isTemp?: boolean
}

// CalendarEvent is an Event with additional UI fields for recurring instances
export interface CalendarEvent extends Event {
  // UI-only fields for recurring events (not stored in DB)
  isRecurringInstance?: boolean
  seriesMasterId?: string
  occurrenceDate?: string
}

export interface EventException {
  id: string
  series_id: string
  date: string
  start_time?: number
  end_time?: number
  title?: string
  created_at?: string
}

export interface NewEvent {
  title: string
  description?: string
  notes?: string
  urls?: string[]
  date: string
  end_date: string
  start_time: number
  end_time: number
  color?: string
  is_all_day?: boolean
  location?: string
  repeat?: string // For UI display only (no recurring logic)
  series_start_date?: string // Start date of recurring series
  series_end_date?: string // End date of recurring series
  reminder?: string
  goalType?: string
  goal?: string
  earlyReminder?: string
  allDay?: string
  // For optimistic updates
  id?: string
}



interface EventsCache {
  [date: string]: Event[]
}

interface ComputedEventsCache {
  [date: string]: CalendarEvent[]
}

interface EventsState {
  // Cache storage
  eventsCache: EventsCache

  // Cache for computed events (real + virtual)
  computedEventsCache: ComputedEventsCache

  // Cache for recurring events (keyed by month YYYY-MM)
  recurringEventsCache: Record<string, CalendarEvent[]>

  // Cache for event exceptions (keyed by series_id)
  eventExceptionsCache: Record<string, EventException[]>

  // Current cached window (ISO date strings)
  cacheStartDate: string | null
  cacheEndDate: string | null

  // Track which user's data is cached
  cachedUserId: string | null

  // Loading states
  isLoading: boolean
  error: string | null

  // Sync state - tracks pending operations
  pendingSyncs: Set<string>

  // Queue updates for temp events until they get real IDs
  pendingUpdates: Map<string, Partial<NewEvent>[]>

  // Currently selected event ID for editing
  selectedEventId: string | null

  // Trigger to scroll DayView to a specific event by ID
  scrollToEventId: string | null

  // Trigger to force EventEditor to save local state
  saveTrigger: number

  // Recurring action dialog state
  recurringDialogOpen: boolean
  recurringDialogEvent: CalendarEvent | null
  recurringDialogActionType: "edit" | "delete" | null
  recurringDialogCallback: ((choice: string) => void) | null

  // Track if selected event has unsaved edits
  hasEditsEventId: string | null

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
  updateEventField: (id: string, field: keyof NewEvent, value: EventFieldValue) => void
  saveSelectedEvent: () => Promise<void>
  showRecurringDialog: (event: CalendarEvent, actionType: "edit" | "delete", callback: (choice: string) => void) => void
  closeRecurringDialog: () => void
  setHasEditsEventId: (id: string | null) => void
  splitRecurringEvent: (event: CalendarEvent, selectedDate: string, _newStartTime?: number, _newEndTime?: number, updates?: Partial<NewEvent>) => Promise<void>
  updateThisAndFollowing: (event: CalendarEvent, selectedDate: string, _newStartTime?: number, _newEndTime?: number, updates?: Partial<NewEvent>) => Promise<void>
}

const CACHE_WINDOW_DAYS = 17 // Days before and after

// Helper to format date as YYYY-MM-DD using local timezone
export const formatDate = (date: Date): string => {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

// Helper to add/subtract days to Date object
const addDays = (date: Date, days: number): Date => {
  const result = new Date(date)
  result.setDate(result.getDate() + days)
  return result
}

// Helper to add days to a date string (YYYY-MM-DD)
const addDaysToDateStr = (dateStr: string, days: number): string => {
  const date = new Date(dateStr + 'T00:00:00')
  date.setDate(date.getDate() + days)
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

// Helper to add months to a date string, clamping day to last day of month if needed
const addMonthsToDateStr = (dateStr: string, months: number): string => {
  const date = new Date(dateStr + 'T00:00:00')
  const originalDay = date.getDate()
  date.setMonth(date.getMonth() + months)
  const lastDayOfMonth = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate()
  date.setDate(Math.min(originalDay, lastDayOfMonth))
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

// Helper to add years to a date string, handling Feb 29 -> Feb 28 for non-leap years
const addYearsToDateStr = (dateStr: string, years: number): string => {
  const date = new Date(dateStr + 'T00:00:00')
  date.setFullYear(date.getFullYear() + years)
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

// Generate recurring dates for a month based on series_start_date and series_end_date
const generateRecurringDatesForMonth = (
  seriesStartDate: string,
  seriesEndDate: string,
  monthStart: string, // YYYY-MM-01
  monthEnd: string,   // YYYY-MM-31 (last day of month)
  repeatType: string  // "Daily" | "Weekly" | "Monthly" | "Yearly"
): string[] => {
  const dates: string[] = []
  
  // Determine effective start and end dates for this month
  const effectiveStart = seriesStartDate > monthStart ? seriesStartDate : seriesStartDate
  const effectiveEnd = seriesEndDate < monthEnd ? seriesEndDate : seriesEndDate
  
  if (effectiveStart > effectiveEnd) {
    return dates // Series doesn't cover this month
  }
  
  // Generate recurring dates from effectiveStart to effectiveEnd
  let currentDate = effectiveStart
  while (currentDate <= effectiveEnd) {
    dates.push(currentDate)
    
    // Calculate next occurrence based on repeat type
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

// Get month range (first and last day) from a date
const getMonthRange = (date: Date): { monthStart: string; monthEnd: string } => {
  const year = date.getFullYear()
  const month = date.getMonth()
  const monthStart = `${year}-${String(month + 1).padStart(2, '0')}-01`
  const lastDay = new Date(year, month + 1, 0).getDate()
  const monthEnd = `${year}-${String(month + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`
  return { monthStart, monthEnd }
}

// Get month key from date
const getMonthKey = (date: Date): string => {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}


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
      saveTrigger: 0,
      recurringDialogOpen: false,
      recurringDialogEvent: null,
      recurringDialogActionType: null,
      recurringDialogCallback: null,
      hasEditsEventId: null,

      fetchEventsWindow: async (centerDate: Date) => {
        const startDate = addDays(centerDate, -CACHE_WINDOW_DAYS)
        const endDate = addDays(centerDate, CACHE_WINDOW_DAYS)
        
        const startStr = formatDate(startDate)
        const endStr = formatDate(endDate)

        // Get current user before fetching
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) {
          console.warn('User not authenticated, cannot fetch events')
          set({ isLoading: false, error: 'User not authenticated', cachedUserId: null })
          return
        }

        // Check if we need to clear cache (user changed or no cache)
        const { cacheStartDate, cacheEndDate, cachedUserId } = get()
        
        if (cachedUserId !== user.id) {
          // User changed, clear cache
          set({
            eventsCache: {},
            computedEventsCache: {},
            cacheStartDate: null,
            cacheEndDate: null,
            cachedUserId: user.id,
          })
        } else if (
          cacheStartDate &&
          cacheEndDate &&
          startStr >= cacheStartDate &&
          endStr <= cacheEndDate
        ) {
          // Already have this range cached for this user
          // Don't return - still fetch in background to check for updates
        } else {
          // Don't set isLoading - we show cached data immediately
          // Background fetch will update silently
        }
        
        try {
          const { data, error } = await supabase
            .from('events')
            .select('*')
            .eq('user_id', user.id)  // Filter by current user
            .gte('date', startStr)
            .lte('date', endStr)
            .order('start_time', { ascending: true })

          if (error) {
            console.error('Database fetch failed:', error)
            set({
              error: error.message,
              // Don't touch isLoading - background fetch error shouldn't affect UI
            })
            return
          }

          // Start with existing cache to preserve events outside fetch window
          const { eventsCache: oldCache, pendingSyncs } = get()
          const newCache: EventsCache = { ...oldCache }
          
          // Update cache with fetched data (overwrites old data for fetched dates)
          data?.forEach((event: Event) => {
            if (!newCache[event.date]) {
              newCache[event.date] = []
            }
            // Remove any existing events with same ID (to avoid duplicates)
            newCache[event.date] = newCache[event.date].filter(e => e.id !== event.id)
            newCache[event.date].push(event)
            newCache[event.date].sort((a, b) => a.start_time - b.start_time)
          })
          
          // Preserve temp events that are still syncing
          Object.keys(oldCache).forEach(date => {
            const tempEvents = oldCache[date].filter(e => pendingSyncs.has(e.id))
            if (tempEvents.length > 0) {
              if (!newCache[date]) newCache[date] = []
              tempEvents.forEach(tempEvent => {
                if (!newCache[date].some(e => e.id === tempEvent.id)) {
                  newCache[date].push(tempEvent)
                }
              })
              newCache[date].sort((a, b) => a.start_time - b.start_time)
            }
          })

          set({
            eventsCache: newCache,
            computedEventsCache: {}, // Clear computed cache when events are fetched
            cacheStartDate: startStr,
            cacheEndDate: endStr,
            cachedUserId: user.id,
            // Don't touch isLoading - background fetch shouldn't affect UI state
          })
          
        } catch (err) {
          console.error('Unexpected error during database fetch:', err)
          set({
            error: err instanceof Error ? err.message : 'Failed to fetch events',
            // Don't touch isLoading - background fetch error shouldn't affect UI
          })
        }
      },

      addEvent: async (event: NewEvent) => {
        // Create local event
        const tempId = `local-${Date.now()}-${Math.random().toString(36).slice(2)}`
        const now = new Date().toISOString()
        const endDate = event.end_date || event.date
        const localEvent: Event = {
          id: tempId,
          user_id: 'temp-user', // Will be replaced with real user ID from DB
          title: event.title,
          date: event.date,
          end_date: endDate,
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

        // Update cache
        const { eventsCache, computedEventsCache } = get()
        const dateKey = event.date
        
        // Invalidate computed cache for this date
        const newComputedCache = { ...computedEventsCache }
        delete newComputedCache[dateKey]
        
        set({
          eventsCache: {
            ...eventsCache,
            [dateKey]: [...(eventsCache[dateKey] || []), localEvent]

  .sort((a, b) => a.start_time - b.start_time),

          },
          computedEventsCache: newComputedCache
        })
        
        // Start background database save (non-blocking)
        setTimeout(async () => {
          try {
            // Get current user for database insert
            const { data: { user } } = await supabase.auth.getUser()
            
            if (!user) {
              console.error('User not authenticated for database save')
              return
            }

            // Create event object for DB (without temp id)
            const eventForDb: Record<string, any> = {
              title: event.title,
              date: event.date,
              end_date: event.end_date || event.date,
              start_time: event.start_time,
              end_time: event.end_time,
              user_id: user.id,
            }
            
            // Add optional fields if defined
            if (event.description !== undefined) eventForDb.description = event.description
            if (event.notes !== undefined) eventForDb.notes = event.notes
            if (event.urls !== undefined) eventForDb.urls = event.urls
            if (event.color !== undefined) eventForDb.color = event.color
            if (event.is_all_day !== undefined) eventForDb.is_all_day = event.is_all_day
            if (event.location !== undefined) eventForDb.location = event.location
            if (event.earlyReminder !== undefined) eventForDb.early_reminder = event.earlyReminder


            const { data, error } = await supabase
              .from('events')
              .insert([eventForDb])
              .select()
              .single()

            if (error) {
              console.error('Background: Database save failed:', error)
              return
            }


            const { eventsCache: currentCache } = get()
            const newCache = { ...currentCache }

            if (newCache[dateKey]) {
              newCache[dateKey] = newCache[dateKey].map(e =>
                e.id === tempId ? data : e
              )
              newCache[dateKey].sort((a, b) => a.start_time - b.start_time)
            }

            set({
              eventsCache: newCache,
            })

          } catch (err) {
            console.error('Background: Unexpected error during database save:', err)
          }
        }, 0)

        return localEvent
      },

        addEventOptimistic: async (event: NewEvent) => {
         // Generate temp ID if not provided
         const tempId = event.id || `temp-${Date.now()}-${Math.random().toString(36).slice(2)}`
         
         // Create temp event with placeholder user ID
         const now = new Date().toISOString()
         const endDate = event.end_date || event.date
         
         // Calculate series end date if repeat is set (10 years from start)
         let seriesEndDate: string | undefined
         if (event.repeat && event.repeat !== 'None' && event.date) {
           const startDate = new Date(event.date + 'T00:00:00')
           startDate.setFullYear(startDate.getFullYear() + 10)
           seriesEndDate = startDate.toISOString().split('T')[0]
         }
         
         const tempEvent: Event = {
           id: tempId,
           user_id: 'temp-user', // Will be replaced with real user ID from DB
           title: event.title,
           date: event.date,
           end_date: endDate,
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

        // Add to cache immediately
        const { eventsCache, computedEventsCache } = get()
        const dateKey = event.date

        // Track this event as syncing
        const currentPendingSyncs = new Set(get().pendingSyncs)
        currentPendingSyncs.add(tempId)
        
        // Invalidate computed cache for this date
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

        // Start background database save (non-blocking)
        setTimeout(async () => {
          try {
            // Get current user for database insert
            const { data: { user } } = await supabase.auth.getUser()

            if (!user) {
              console.error('User not authenticated for database save')
              // Remove temp event since we can't save it
              const { eventsCache: currentCache, pendingSyncs, pendingUpdates } = get()
              const newCache = { ...currentCache }
              const newPendingSyncs = new Set(pendingSyncs)
              const newPendingUpdates = new Map(pendingUpdates)
              newPendingSyncs.delete(tempId)
              newPendingUpdates.delete(tempId)
              if (newCache[dateKey]) {
                newCache[dateKey] = newCache[dateKey].filter(e => e.id !== tempId)
              }
              set({ eventsCache: newCache, pendingSyncs: newPendingSyncs, pendingUpdates: newPendingUpdates })
              return
            }

            // Create event object for DB (without temp id)
            const eventForDb: Record<string, any> = {
              title: event.title,
              date: event.date,
              end_date: event.end_date || event.date,
              start_time: event.start_time,
              end_time: event.end_time,
              user_id: user.id,
            }

            // Add optional fields if defined
            if (event.description !== undefined) eventForDb.description = event.description
            if (event.notes !== undefined) eventForDb.notes = event.notes
            if (event.urls !== undefined) eventForDb.urls = event.urls
            if (event.color !== undefined) eventForDb.color = event.color
            if (event.is_all_day !== undefined) eventForDb.is_all_day = event.is_all_day
            if (event.location !== undefined) eventForDb.location = event.location
            if (event.repeat !== undefined) eventForDb.repeat = event.repeat
            if (event.series_start_date !== undefined) eventForDb.series_start_date = event.series_start_date
            if (event.series_end_date !== undefined) eventForDb.series_end_date = event.series_end_date

            const { data, error } = await supabase
              .from('events')
              .insert([eventForDb])
              .select()
              .single()

            if (error) {
              console.error('Background: Database save failed:', error)
              // Remove temp event on failure
              const { eventsCache: currentCache, pendingSyncs, pendingUpdates } = get()
              const newCache = { ...currentCache }
              const newPendingSyncs = new Set(pendingSyncs)
              const newPendingUpdates = new Map(pendingUpdates)
              newPendingSyncs.delete(tempId)
              newPendingUpdates.delete(tempId)
              if (newCache[dateKey]) {
                newCache[dateKey] = newCache[dateKey].filter(e => e.id !== tempId)
              }
              set({ eventsCache: newCache, pendingSyncs: newPendingSyncs, pendingUpdates: newPendingUpdates })
              return
            }


            // Update temp event in place with real data (no remove/add = no jitter!)
            const { eventsCache: currentCache, pendingSyncs, pendingUpdates } = get()
            const newCache = { ...currentCache }
            const newPendingSyncs = new Set(pendingSyncs)
            newPendingSyncs.delete(tempId)
            
            // Check if the saved event is currently selected - update selection to new ID
            const currentSelectedId = get().selectedEventId
            
            // Check for and apply any pending updates for this temp event
            const queuedUpdates = pendingUpdates.get(tempId)
            console.log('Temp event saved! Checking for queued updates:', queuedUpdates)
            const newPendingUpdates = new Map(pendingUpdates)
            newPendingUpdates.delete(tempId)

            let newSelectedId = currentSelectedId
            let finalEvent = { ...data, isTemp: false }
            
            if (newCache[dateKey]) {
              if (queuedUpdates && queuedUpdates.length > 0) {
                queuedUpdates.forEach(update => {
                  finalEvent = { ...finalEvent, ...update, updated_at: new Date().toISOString() }
                })
              }
              
              newCache[dateKey] = newCache[dateKey].map(e =>
                e.id === tempId ? finalEvent : e
              )
              newCache[dateKey].sort((a, b) => a.start_time - b.start_time)
            }
            
            // Update selectedEventId if we replaced the selected event
            if (currentSelectedId === tempId) {
              newSelectedId = finalEvent.id
            } else {
            }

            // Invalidate computed cache since event ID changed (temp -> real)
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
            
            // Now sync the final event state to the database if there were queued updates
            if (queuedUpdates && queuedUpdates.length > 0) {
              console.log('Syncing queued updates to database:', queuedUpdates)
              // Merge ALL queued updates, not just the last one
              const filteredUpdates: Record<string, any> = {}
              queuedUpdates.forEach(update => {
                Object.entries(update).forEach(([key, value]) => {
                  if (value !== undefined && (key === 'title' || key === 'date' || key === 'end_date' || key === 'start_time' || key === 'end_time' || key === 'notes' || key === 'urls' || key === 'description' || key === 'color' || key === 'is_all_day' || key === 'location')) {
                    filteredUpdates[key] = value
                  }
                })
              })
              console.log('Merged filtered updates:', filteredUpdates)
              
              if (Object.keys(filteredUpdates).length > 0) {
                console.log('Updating database with:', filteredUpdates)
                const { error } = await supabase
                  .from('events')
                  .update(filteredUpdates)
                  .eq('id', data.id)
                
                if (error) {
                  console.error('Background: Failed to sync queued updates:', error)
                } else {
                  console.log('Successfully synced queued updates to database!')
                }
              }
            }

          } catch (err) {
            console.error('Background: Unexpected error during database save:', err)
            // Remove temp event on unexpected error
            const { eventsCache: currentCache, pendingSyncs, pendingUpdates } = get()
            const newCache = { ...currentCache }
            const newPendingSyncs = new Set(pendingSyncs)
            const newPendingUpdates = new Map(pendingUpdates)
            newPendingSyncs.delete(tempId)
            newPendingUpdates.delete(tempId)
            if (newCache[dateKey]) {
              newCache[dateKey] = newCache[dateKey].filter(e => e.id !== tempId)
            }
            set({ eventsCache: newCache, pendingSyncs: newPendingSyncs, pendingUpdates: newPendingUpdates })
          }
        }, 0) // Start immediately but asynchronously
        
        return tempEvent
      },

      addEventLocal: (event: NewEvent): Event => {
        const tempId = event.id || `temp-${Date.now()}-${Math.random().toString(36).slice(2)}`
        const now = new Date().toISOString()
        const endDate = event.end_date || event.date
        
        const tempEvent: Event = {
          id: tempId,
          user_id: 'temp-user',
          title: event.title,
          date: event.date,
          end_date: endDate,
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
        console.log('saveTempEvent CALLED:', tempEventId)
        
        // Find the temp event in cache and get pending updates
        const { eventsCache, pendingSyncs, pendingUpdates } = get()
        let tempEvent: Event | null = null
        let dateKey: string | null = null
        
        for (const key in eventsCache) {
          const event = eventsCache[key].find(e => e.id === tempEventId)
          if (event) {
            tempEvent = event
            dateKey = key
            break
          }
        }
        
        if (!tempEvent || !dateKey) {
          console.error('saveTempEvent: Temp event not found')
          return
        }
        
        // Apply pending updates to temp event before saving
        const queuedUpdates = pendingUpdates.get(tempEventId) || []
        console.log('saveTempEvent: Applying', queuedUpdates.length, 'queued updates')
        let updatedTempEvent = { ...tempEvent }
        queuedUpdates.forEach(update => {
          updatedTempEvent = { ...updatedTempEvent, ...update }
        })
        
        // Get current user
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) {
          console.error('saveTempEvent: User not authenticated')
          return
        }
        
        // Create event object for DB with all fields including queued updates
        const eventForDb: Record<string, any> = {
          title: updatedTempEvent.title || 'Untitled',
          date: updatedTempEvent.date,
          end_date: updatedTempEvent.end_date || updatedTempEvent.date,
          start_time: updatedTempEvent.start_time,
          end_time: updatedTempEvent.end_time,
          user_id: user.id,
          description: updatedTempEvent.description,
          notes: updatedTempEvent.notes,
          urls: updatedTempEvent.urls,
          color: updatedTempEvent.color,
          is_all_day: updatedTempEvent.is_all_day,
          location: updatedTempEvent.location,
          repeat: updatedTempEvent.repeat,
          series_start_date: updatedTempEvent.series_start_date,
          series_end_date: updatedTempEvent.series_end_date,
          early_reminder: updatedTempEvent.earlyReminder,
        }
        
        console.log('saveTempEvent: Saving with repeat:', eventForDb.repeat, 'series_start_date:', eventForDb.series_start_date)
        
        // Insert to database
        const { data: savedEvent, error } = await supabase
          .from('events')
          .insert([eventForDb])
          .select()
          .single()
        
        if (error || !savedEvent) {
          console.error('saveTempEvent: Failed to save to DB:', error)
          return
        }
        
        console.log('saveTempEvent: Saved to DB, id:', savedEvent.id)
        
        // Update cache: replace temp event with real event (with applied updates)
        const { eventsCache: currentCache } = get()
        const newCache = { ...currentCache }
        
        if (newCache[dateKey]) {
          newCache[dateKey] = newCache[dateKey].map(e =>
            e.id === tempEventId ? { ...updatedTempEvent, ...savedEvent, id: savedEvent.id, isTemp: false } : e
          )
        }
        
        // Remove from pendingSyncs and pendingUpdates
        const newPendingSyncs = new Set(pendingSyncs)
        newPendingSyncs.delete(tempEventId)
        const newPendingUpdates = new Map(pendingUpdates)
        newPendingUpdates.delete(tempEventId)
        
        // Clear ALL computed cache so virtual events are regenerated with correct data
        set({
          eventsCache: newCache,
          computedEventsCache: {},
          recurringEventsCache: {},
          pendingSyncs: newPendingSyncs,
          pendingUpdates: newPendingUpdates,
        })
        
        console.log('saveTempEvent: Done, temp event replaced with real event, cleared all computed cache')
      },

       updateEvent: async (id: string, updates: Partial<NewEvent>) => {
         const { eventsCache, computedEventsCache, pendingSyncs, pendingUpdates } = get()
         const oldDate = Object.keys(eventsCache).find(date =>
           eventsCache[date].some(e => e.id === id)
         )

          if (oldDate) {
            const newCache = { ...eventsCache }
            const newComputedCache = { ...computedEventsCache }
            
            // Find and update the event
            const eventIndex = newCache[oldDate].findIndex(e => e.id === id)
            if (eventIndex !== -1) {
              const updatedEvent = {
                ...newCache[oldDate][eventIndex],
                ...updates,
                updated_at: new Date().toISOString(),
              }
              
              // Remove from old date - create new array
              const oldEvents = [...newCache[oldDate]]
              oldEvents.splice(eventIndex, 1)
              
              // Add to new date (if date changed) or same date
              const newDate = updates.date || oldDate
              if (!newCache[newDate]) {
                newCache[newDate] = []
              }
              
              // Create new array for new date
              const newDateEvents = newDate === oldDate ? oldEvents : [...newCache[newDate]]
              newDateEvents.push(updatedEvent)
              newDateEvents.sort((a, b) => a.start_time - b.start_time)
              newCache[newDate] = newDateEvents
              
              // If dates are different, update old date too
              if (newDate !== oldDate) {
                newCache[oldDate] = oldEvents
                if (newCache[oldDate].length === 0) {
                  delete newCache[oldDate]
                }
              }

              // Invalidate computed cache for both old and new dates
              delete newComputedCache[oldDate]
              delete newComputedCache[newDate]

              set({ eventsCache: newCache, computedEventsCache: newComputedCache, recurringEventsCache: {}, eventExceptionsCache: {} })
             
             // Check if this is a temp event (not yet saved to DB)
             if (updatedEvent.isTemp === true || pendingSyncs.has(id)) {
               // Queue the update to be applied after sync completes
               const newPendingUpdates = new Map(pendingUpdates)
               const existing = newPendingUpdates.get(id) || []
               newPendingUpdates.set(id, [...existing, updates])
               set({ pendingUpdates: newPendingUpdates })
               return updatedEvent
             }
             
              // Start background database update (non-blocking)
              setTimeout(async () => {
                try {
                   // Filter out undefined values and fields that don't exist in current schema
                    const filteredUpdates: Record<string, any> = {}
                     Object.entries(updates).forEach(([key, value]) => {
                       if (value !== undefined) {
                         if (key === 'title' || key === 'date' || key === 'start_time' || key === 'end_time' || key === 'repeat' || key === 'repeat_end_date' || 
                             key === 'series_id' || key === 'is_series_master' || key === 'series_position' ||
                             key === 'series_start_date' || key === 'series_end_date') {
                           filteredUpdates[key] = value
                         }
                        // Only include end_date and is_all_day if they're explicitly set (not defaults)
                        if ((key === 'end_date' || key === 'is_all_day') && value !== undefined) {
                          filteredUpdates[key] = value
                        }
                        if (key === 'earlyReminder' && value !== undefined) {
                          filteredUpdates['early_reminder'] = value
                        }
                      }
                    })


                   const { error } = await supabase
                     .from('events')
                     .update(filteredUpdates)
                     .eq('id', id)

                   if (error) {
                    console.error('Background: Database update failed:', error)
                    // Note: We don't rollback UI update - user sees their change
                    // In a production app, you might want to show an error notification
                  } else {
                 }
               } catch (err) {
                 console.error('Background: Unexpected error during database update:', err)
               }
             }, 0)
             
              return updatedEvent
            }
          }
          
          return null
        },

        updateAllInSeries: async (seriesMasterId: string, updates: Partial<NewEvent>) => {
          console.log('updateAllInSeries CALLED:', { seriesMasterId, updates })
          
          // 1. Update the master event in cache and database
          await get().updateEvent(seriesMasterId, updates)
          
          // 2. Clear recurring cache so virtual events will be regenerated with new values
          // 3. Clear selectedEventId to close the sidebar
          set({
            recurringEventsCache: {},
            computedEventsCache: {},
            selectedEventId: null,
          })
          
          console.log('updateAllInSeries: Cleared caches and deselected event')
        },

        deleteEvent: async (id: string) => {
         // Update cache immediately
         const { eventsCache, computedEventsCache } = get()
         const newCache = { ...eventsCache }
         const newComputedCache = { ...computedEventsCache }
         
         // Check if this is a temp event (not yet saved to DB)
         const event = Object.values(eventsCache).flat().find(e => e.id === id)
         const isTempEvent = event?.isTemp === true
         
         // Find which dates this event affects
         const affectedDates: string[] = []
         Object.keys(newCache).forEach(date => {
           const hadEvent = newCache[date].some(e => e.id === id)
           newCache[date] = newCache[date].filter(e => e.id !== id)
           if (hadEvent) {
             affectedDates.push(date)
           }
         })

         // Invalidate computed cache for affected dates
         affectedDates.forEach(date => {
           delete newComputedCache[date]
         })

         set({ eventsCache: newCache, computedEventsCache: newComputedCache, recurringEventsCache: {}, eventExceptionsCache: {} })
         
         // Skip database delete for temp events (never saved to DB)
         if (isTempEvent) {
           return true
         }
         
         // Start background database delete (non-blocking)
         setTimeout(async () => {
           try {

             const { error } = await supabase
               .from('events')
               .delete()
               .eq('id', id)

             if (error) {
               console.error('Background: Database delete failed:', error)
             }
           } catch (err) {
             console.error('Background: Unexpected error during database delete:', err)
           }
         }, 0)
        
        return true
      },

      getEventsForDate: (date: Date): CalendarEvent[] => {
        const dateKey = formatDate(date)
        const { eventsCache, computedEventsCache, recurringEventsCache, eventExceptionsCache } = get()
        
        // Check if we have cached computed events for this date
        if (computedEventsCache[dateKey]) {
          return computedEventsCache[dateKey] as CalendarEvent[]
        }
        
        // Get real events for this date
        const realEvents: CalendarEvent[] = (eventsCache[dateKey] || []).map(e => ({
          ...e,
          isRecurringInstance: false
        }))
        
        // Get recurring events for this date
        const monthKey = getMonthKey(date)
        let recurringEvents: CalendarEvent[] = []
        
        // Check if recurring events are cached for this month
        if (recurringEventsCache[monthKey]) {
          recurringEvents = recurringEventsCache[monthKey].filter(e => e.date === dateKey)
          console.log('getEventsForDate:', dateKey, 'Found', recurringEvents.length, 'recurring events from cache')
        } else {
          // Generate recurring events for the entire month
          const { monthStart, monthEnd } = getMonthRange(date)
          
          // Find all master recurring events in cache
          const allMasterEvents: Event[] = []
          Object.values(eventsCache).forEach(dayEvents => {
            dayEvents.forEach(event => {
              if (event.repeat && event.repeat !== 'None' && event.series_start_date && event.series_end_date) {
                // Check if this master event's series covers the current month
                if (event.series_end_date >= monthStart && event.series_start_date <= monthEnd) {
                  // Avoid duplicates
                  if (!allMasterEvents.find(e => e.id === event.id)) {
                    allMasterEvents.push(event)
                    console.log('getEventsForDate: Found master recurring event:', event.id, event.title, event.repeat)
                  }
                }
              }
            })
          })
          
          console.log('getEventsForDate:', dateKey, 'Found', allMasterEvents.length, 'master events')
          
          // Generate recurring dates for each master event
          const generatedRecurring: CalendarEvent[] = []
          allMasterEvents.forEach(masterEvent => {
            const recurringDates = generateRecurringDatesForMonth(
              masterEvent.series_start_date!,
              masterEvent.series_end_date!,
              monthStart,
              monthEnd,
              masterEvent.repeat || 'Daily'
            )
            
            // Get exceptions for this series
            const seriesExceptions = eventExceptionsCache[masterEvent.id] || []
            
            recurringDates.forEach(recDate => {
              // Skip if this is the master event's original date (already in database)
              if (recDate === masterEvent.date) {
                return
              }
              
              // Check if there's an exception for this date
              const exception = seriesExceptions.find(ex => ex.date === recDate)
              
              if (exception) {
                // Use exception data
                const recurringEvent: CalendarEvent = {
                  ...masterEvent,
                  id: `${masterEvent.id}-${recDate}`,
                  date: recDate,
                  end_date: recDate,
                  isRecurringInstance: true,
                  seriesMasterId: masterEvent.id,
                  occurrenceDate: recDate,
                  // Override with exception data
                  start_time: exception.start_time ?? masterEvent.start_time,
                  end_time: exception.end_time ?? masterEvent.end_time,
                  title: exception.title ?? masterEvent.title,
                }
                generatedRecurring.push(recurringEvent)
              } else {
                // Use generated data
                const recurringEvent: CalendarEvent = {
                  ...masterEvent,
                  id: `${masterEvent.id}-${recDate}`,
                  date: recDate,
                  end_date: recDate,
                  isRecurringInstance: true,
                  seriesMasterId: masterEvent.id,
                  occurrenceDate: recDate,
                }
                generatedRecurring.push(recurringEvent)
              }
            })
          })
          
          // Cache recurring events for the month (deferred to avoid setState during render)
          setTimeout(() => {
            set(state => ({
              recurringEventsCache: {
                ...state.recurringEventsCache,
                [monthKey]: generatedRecurring
              }
            }))
          }, 0)
          
          // Filter to only events for this date
          recurringEvents = generatedRecurring.filter(e => e.date === dateKey)
        }
        
        // Combine real and recurring events
        const allEvents = [...realEvents, ...recurringEvents]
        
        // Remove duplicates (in case a real event already exists for this date)
        const uniqueEvents = allEvents.filter((event, index, self) =>
          index === self.findIndex(e => e.id === event.id)
        )
        
        // Sort by start time
        uniqueEvents.sort((a, b) => a.start_time - b.start_time)
        
        // Cache the computed events for this date (deferred to avoid setState during render)
        setTimeout(() => {
          set(state => ({
            computedEventsCache: {
              ...state.computedEventsCache,
              [dateKey]: uniqueEvents
            }
          }))
        }, 0)
        
        return uniqueEvents
      },

      getEventById: (id: string): CalendarEvent | null => {
        const { eventsCache, computedEventsCache } = get()
        
        // Check if this is a virtual event ID (format: "masterEventId-YYYY-MM-DD")
        const datePattern = /-(\d{4}-\d{2}-\d{2})$/
        const isVirtualEventId = datePattern.test(id)
        
        console.log('getEventById called:', { id, isVirtualEventId, eventsCacheKeys: Object.keys(eventsCache) })
        
        if (isVirtualEventId) {
          console.log('getEventById: Searching for virtual event:', id)
          
          // Search through computedEventsCache for virtual events
          for (const dateKey in computedEventsCache) {
            const event = computedEventsCache[dateKey].find(e => e.id === id)
            if (event) {
              console.log('getEventById: Found virtual event in computedEventsCache:', event.isRecurringInstance)
              return event
            }
          }
          
          // Virtual event not in cache - try to generate it on-demand
          const match = id.match(datePattern)
          if (match) {
            const virtualDate = match[1]
            const masterEventId = id.replace(datePattern, '')
            console.log('getEventById: Generating virtual event on-demand:', { virtualDate, masterEventId })
            
            // Find the master event in eventsCache
            let masterEvent: Event | null = null
            for (const dateKey in eventsCache) {
              const found = eventsCache[dateKey].find(e => e.id === masterEventId)
              if (found) {
                masterEvent = found
                break
              }
            }
            
            if (masterEvent) {
              // Generate the virtual event
              const virtualEvent: CalendarEvent = {
                ...masterEvent,
                id: id,
                date: virtualDate,
                end_date: virtualDate,
                isRecurringInstance: true,
                seriesMasterId: masterEventId,
                occurrenceDate: virtualDate,
              }
              console.log('getEventById: Generated virtual event:', virtualEvent.isRecurringInstance)
              
              // Cache it for future lookups (deferred to avoid setState during render)
              setTimeout(() => {
                set(state => ({
                  computedEventsCache: {
                    ...state.computedEventsCache,
                    [virtualDate]: [...(state.computedEventsCache[virtualDate] || []), virtualEvent]
                  }
                }))
              }, 0)
              
              return virtualEvent
            } else {
              console.log('getEventById: Master event not found for:', masterEventId)
            }
          }
        }
        
        // Search through eventsCache for real events
        console.log('getEventById: Searching eventsCache, keys:', Object.keys(eventsCache))
        for (const dateKey in eventsCache) {
          const events = eventsCache[dateKey]
          console.log('getEventById: Checking dateKey:', dateKey, 'events:', events.map(e => ({ id: e.id, title: e.title })))
          const event = events.find(e => e.id === id)
          if (event) {
            console.log('getEventById: Found event:', event.id, event.title)
            return event as CalendarEvent
          }
        }
        
        console.log('getEventById: Event not found:', id)
        return null
      },

      isEventSyncing: (eventId: string): boolean => {
        return get().pendingSyncs.has(eventId)
      },

      isAnyEventSyncing: (): boolean => {
        return get().pendingSyncs.size > 0
      },

      setSelectedEvent: (id: string | null) => {
        set({ selectedEventId: id })
      },

      setScrollToEventId: (id: string | null) => {
        set({ scrollToEventId: id })
      },

      updateEventField: (id: string, field: keyof NewEvent, value: EventFieldValue) => {
        console.log('updateEventField CALLED:', { id, field, value })
        if (value === undefined) {
          console.log('updateEventField: value is undefined, returning')
          return
        }
        
        const { eventsCache, computedEventsCache, pendingSyncs, pendingUpdates } = get()
        console.log('updateEventField: searching for id', id, 'in cache')
        
        // Check if this is a virtual event ID (format: "masterEventId-YYYY-MM-DD")
        const datePattern = /-(\d{4}-\d{2}-\d{2})$/
        const isVirtualEventId = datePattern.test(id)
        
        if (isVirtualEventId) {
          console.log('updateEventField: Virtual event detected, redirecting to updateAllInSeries')
          // For virtual events, we need to update the master event
          // Find the master event ID from the virtual event ID
          const match = id.match(datePattern)
          if (match) {
            const seriesMasterId = id.replace(datePattern, '')
            console.log('updateEventField: Calling updateAllInSeries for master:', seriesMasterId)
            get().updateAllInSeries(seriesMasterId, { [field]: value })
          }
          return
        }
        
        // Real event - search in eventsCache
        const dateKey = Object.keys(eventsCache).find(date =>
          eventsCache[date].some(e => e.id === id)
        )
        console.log('updateEventField: dateKey =', dateKey)

        if (!dateKey) {
          console.log('updateEventField: no dateKey found, returning')
          return
        }

        const eventIndex = eventsCache[dateKey].findIndex(e => e.id === id)
        console.log('updateEventField: eventIndex =', eventIndex)
        if (eventIndex === -1) {
          console.log('updateEventField: event not found at index, returning')
          return
        }

        const currentEvent = eventsCache[dateKey][eventIndex]
        console.log('updateEventField: currentEvent =', currentEvent)
        
        // Check if value is actually changing
        const currentValue = currentEvent[field as keyof Event]
        if (currentValue === value) {
          return
        }
        
        const duration = currentEvent.end_time - currentEvent.start_time

        let endTimeValue = currentEvent.end_time
        if (field === 'start_time' && typeof value === 'number') {
          endTimeValue = value + duration
        }

        const updatedEvent = {
          ...currentEvent,
          [field]: value,
          ...(field === 'start_time' && typeof value === 'number' && { end_time: endTimeValue }),
          updated_at: new Date().toISOString(),
        }

        const newCache = { ...eventsCache }
        const newComputedCache = { ...computedEventsCache }

        // Handle date change - move event to new date key
        if (field === 'date' && typeof value === 'string' && value !== dateKey) {
          // Remove from old date
          newCache[dateKey] = newCache[dateKey].filter(e => e.id !== id)
          if (newCache[dateKey].length === 0) {
            delete newCache[dateKey]
          }
          // Add to new date
          if (!newCache[value]) {
            newCache[value] = []
          }
          newCache[value] = [...newCache[value], updatedEvent]
          
          // Invalidate computed cache for both old and new dates
          delete newComputedCache[dateKey]
          delete newComputedCache[value]
        } else {
          newCache[dateKey] = [...newCache[dateKey]]
          newCache[dateKey][eventIndex] = updatedEvent
          
          // Invalidate computed cache for this date
          delete newComputedCache[dateKey]
        }

        set({ eventsCache: newCache, computedEventsCache: newComputedCache, recurringEventsCache: {}, eventExceptionsCache: {} })

        // Check if this is a temp event (not yet saved to DB)
        if (currentEvent.isTemp === true || pendingSyncs.has(id)) {
          console.log('updateEventField: Event is temp, queueing update for later')
          const newPendingUpdates = new Map(pendingUpdates)
          const existing = newPendingUpdates.get(id) || []
          newPendingUpdates.set(id, [...existing, { [field]: value }])
          set({ pendingUpdates: newPendingUpdates })
          return
        }

        console.log('updateEventField: Event is not temp, updating database')
        // Background database update
        setTimeout(async () => {
          try {
            // When start_time changes, we need to update both start_time and end_time
            const updates: Record<string, any> = { [field]: value }
            if (field === 'start_time') {
              updates.end_time = endTimeValue
            }
            
            const { error } = await supabase
              .from('events')
              .update(updates)
              .eq('id', id)

            if (error) {
              console.error('Background: Database field update failed:', error)
            } else {
              console.log('SUCCESS: Database updated with:', updates)
            }
          } catch (err) {
            console.error('Background: Unexpected error during field update:', err)
          }
        }, 0)
      },

      saveSelectedEvent: async () => {
        console.log('saveSelectedEvent CALLED')
        try {
          // Trigger EventEditor to save its local state to cache first
          const { saveTrigger } = get()
          console.log('saveSelectedEvent: incrementing saveTrigger from', saveTrigger)
          set({ saveTrigger: saveTrigger + 1 })
          
          // Wait for EventEditor to save local state to cache
          await new Promise(resolve => setTimeout(resolve, 50))
          
          const { selectedEventId, eventsCache } = get()
          console.log('saveSelectedEvent: after wait, selectedEventId =', selectedEventId)
          if (!selectedEventId) {
            console.log('saveSelectedEvent: no selectedEventId, returning')
            return
          }

          const dateKey = Object.keys(eventsCache).find(date =>
            eventsCache[date].some(e => e.id === selectedEventId)
          )
          console.log('saveSelectedEvent: dateKey =', dateKey)
          if (!dateKey) {
            console.log('saveSelectedEvent: no dateKey, returning')
            return
          }

          const event = eventsCache[dateKey].find(e => e.id === selectedEventId)
          console.log('saveSelectedEvent: event =', event)
          if (!event) {
            console.log('saveSelectedEvent: no event found, returning')
            return
          }

          // Check if this is a temp (unsaved) event
          const isTempEvent = event.isTemp === true
          
          // Clear selectedEventId FIRST
          set({ selectedEventId: null, saveTrigger: 0 })

          if (isTempEvent) {
            // Save temp event to database - replaces temp event with real event in cache
            console.log('saveSelectedEvent: Saving temp event to database')
            await get().saveTempEvent(selectedEventId)
          } else {
            // Existing event - update it
            const eventIdToUpdate = event.id

            // Prepare updates from the event in cache
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

            // Update frontend cache FIRST (immediate UI update)
            const updatedEvent = await get().updateEvent(selectedEventId, updates)
            
            if (!updatedEvent) {
              console.error('saveSelectedEvent: Failed to update event in cache')
              return
            }

            // Background database update (non-blocking)
            setTimeout(async () => {
              try {
                const { error } = await supabase
                  .from('events')
                  .update(updates)
                  .eq('id', eventIdToUpdate)

                if (error) {
                  console.error('saveSelectedEvent: Background: Database update failed:', error)
                }
              } catch (err) {
                console.error('saveSelectedEvent: Background: Unexpected error during database save:', err)
              }
            }, 0)
          }
        } catch (error) {
          console.error('saveSelectedEvent: Unexpected error:', error)
        }
      },

      showRecurringDialog: (event: CalendarEvent, actionType: "edit" | "delete", callback: (choice: string) => void) => {
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

      setHasEditsEventId: (id: string | null) => {
        set({ hasEditsEventId: id })
      },

      splitRecurringEvent: async (
        event: CalendarEvent, 
        selectedDate: string, 
        newStartTime?: number, 
        newEndTime?: number, 
        updates?: Partial<NewEvent>
      ) => {
        const startTimeForNewEvent = newStartTime ?? updates?.start_time
        const endTimeForNewEvent = newEndTime ?? updates?.end_time
        const { computedEventsCache, eventsCache } = get()
        
        // Determine the master event ID
        let masterEventId: string
        
        if (event.seriesMasterId) {
          masterEventId = event.seriesMasterId
        } else if (event.repeat && event.repeat !== 'None' && (event.series_start_date || event.series_end_date)) {
          masterEventId = event.id
        } else {
          console.error('splitRecurringEvent: Event is not part of a recurring series')
          return
        }
        
        // Find the master event to get original series properties
        let masterEvent: Event | null = null
        for (const dateKey in eventsCache) {
          const found = eventsCache[dateKey].find(e => e.id === masterEventId)
          if (found) {
            masterEvent = found
            break
          }
        }
        
        // Get original series properties from master event (or fall back to event)
        const originalSeriesEndDate = masterEvent?.series_end_date || event.series_end_date || event.date
        const originalRepeat = masterEvent?.repeat || event.repeat || 'None'
        
        const prevDay = addDaysToDateStr(selectedDate, -1)
        
        // Calculate next occurrence based on repeat type
        let nextOccurrence: string
        switch (originalRepeat) {
          case 'Daily':
            nextOccurrence = addDaysToDateStr(selectedDate, 1)
            break
          case 'Weekly':
            nextOccurrence = addDaysToDateStr(selectedDate, 7)
            break
          case 'Monthly':
            nextOccurrence = addMonthsToDateStr(selectedDate, 1)
            break
          case 'Yearly':
            nextOccurrence = addYearsToDateStr(selectedDate, 1)
            break
          default:
            nextOccurrence = addDaysToDateStr(selectedDate, 1)
        }
        
        // Get the ORIGINAL title from the master event in cache
        let originalTitle = event.title
        
        // Try to get original title from eventsCache first
        for (const dateKey in eventsCache) {
          const masterEventForTitle = eventsCache[dateKey].find(e => e.id === masterEventId)
          if (masterEventForTitle) {
            originalTitle = masterEventForTitle.title
            break
          }
        }
        
        // If not found in eventsCache, try computedEventsCache
        if (originalTitle === event.title) {
          for (const dateKey in computedEventsCache) {
            const masterEventForTitle = computedEventsCache[dateKey].find(e => e.id === masterEventId)
            if (masterEventForTitle) {
              originalTitle = masterEventForTitle.title
              break
            }
          }
        }
        
        const originalEventTitle = originalTitle // ORIGINAL title
        console.log('splitRecurringEvent: originalEventTitle =', originalEventTitle)
        
        // Check if selected date is the first occurrence
        const isFirstOccurrence = selectedDate === (event.series_start_date || event.date)
        
        if (isFirstOccurrence) {
          // If selected date is the first occurrence, make it non-recurring with updates
          await get().updateEvent(masterEventId, {
            series_end_date: undefined,
            series_start_date: undefined,
            repeat: 'None',
            ...updates,
          })
        } else {
          // Normal case: shorten original series (Event 1) - keeps ORIGINAL title
          await get().updateEvent(masterEventId, {
            series_end_date: prevDay,
          })
          
          // Create Event 2: standalone event at selectedDate
          // Use event's current values (which include pendingUpdates) as primary source
          // Only fall back to master/original if event values are undefined
          console.log('splitRecurringEvent: Creating event2 with title =', updates?.title ?? event.title ?? originalEventTitle)
          const event2Data: NewEvent = {
            title: updates?.title ?? event.title ?? originalEventTitle,
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
            repeat: 'None', // Make it standalone
          }
          await get().addEventOptimistic(event2Data)
        }
          
          // Event 3: Create new series from nextOccurrence - uses ORIGINAL title
          if (nextOccurrence <= originalSeriesEndDate) {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) {
              console.error('User not authenticated for database save')
              return
            }
          
          // Insert Event 3 master to database - uses ORIGINAL properties from master event
          const event3MasterData: Record<string, any> = {
            title: originalEventTitle,
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
            user_id: user.id,
          }
          
          const { data: event3MasterResult, error: masterError } = await supabase
            .from('events')
            .insert([event3MasterData])
            .select()
            .single()
          
          if (masterError || !event3MasterResult) {
            console.error('Failed to create Event 3 master:', masterError)
            return
          }
          
          // Add Event 3 master to cache
          const event3Cached: Event = {
            id: event3MasterResult.id,
            user_id: user.id,
            title: event3MasterResult.title,
            date: event3MasterResult.date,
            end_date: event3MasterResult.end_date,
            start_time: event3MasterResult.start_time,
            end_time: event3MasterResult.end_time,
            description: event3MasterResult.description,
            notes: event3MasterResult.notes,
            urls: event3MasterResult.urls,
            color: event3MasterResult.color,
            is_all_day: event3MasterResult.is_all_day,
            location: event3MasterResult.location,
            repeat: event3MasterResult.repeat,
            series_start_date: event3MasterResult.series_start_date,
            series_end_date: event3MasterResult.series_end_date,
            created_at: event3MasterResult.created_at,
            updated_at: event3MasterResult.updated_at,
          }
          
          // Get fresh events cache and add Event 3
          const { eventsCache: currentEventsCache } = get()
          const event3DateKey = event3MasterResult.date
          const updatedEventsCache = {
            ...currentEventsCache,
            [event3DateKey]: [...(currentEventsCache[event3DateKey] || []), event3Cached],
          }
          
          // Clear caches to force fresh rebuild
          set({
            eventsCache: updatedEventsCache,
            computedEventsCache: {},
            recurringEventsCache: {},
            eventExceptionsCache: {},
          })
        }
      },

      updateThisAndFollowing: async (
        event: CalendarEvent,
        selectedDate: string,
        newStartTime?: number,
        newEndTime?: number,
        updates?: Partial<NewEvent>
      ) => {
        const startTimeForNewEvent = newStartTime ?? updates?.start_time
        const endTimeForNewEvent = newEndTime ?? updates?.end_time
        const { computedEventsCache, eventsCache } = get()
        
        // Determine the master event ID
        let masterEventId: string
        
        if (event.seriesMasterId) {
          masterEventId = event.seriesMasterId
        } else if (event.repeat && event.repeat !== 'None' && (event.series_start_date || event.series_end_date)) {
          masterEventId = event.id
        } else {
          console.error('updateThisAndFollowing: Event is not part of a recurring series')
          return
        }
        
        // Find the master event to get original series properties
        let masterEvent: Event | null = null
        for (const dateKey in eventsCache) {
          const found = eventsCache[dateKey].find(e => e.id === masterEventId)
          if (found) {
            masterEvent = found
            break
          }
        }
        
        // Get original series properties from master event (or fall back to event)
        const originalSeriesEndDate = masterEvent?.series_end_date || event.series_end_date || event.date
        const originalRepeat = masterEvent?.repeat || event.repeat || 'None'
        const prevDay = addDaysToDateStr(selectedDate, -1)
        
        // Get the ORIGINAL title from the master event
        let originalTitle = event.title
        for (const dateKey in eventsCache) {
          const masterEventForTitle = eventsCache[dateKey].find(e => e.id === masterEventId)
          if (masterEventForTitle) {
            originalTitle = masterEventForTitle.title
            break
          }
        }
        
        // If not found in eventsCache, try computedEventsCache
        if (originalTitle === event.title) {
          for (const dateKey in computedEventsCache) {
            const masterEventForTitle = computedEventsCache[dateKey].find(e => e.id === masterEventId)
            if (masterEventForTitle) {
              originalTitle = masterEventForTitle.title
              break
            }
          }
        }
        
        // Step 1: Shorten original master series to end before selectedDate
        await get().updateEvent(masterEventId, {
          series_end_date: prevDay,
        })
        
        // Step 2: Create new recurring series from selectedDate to original end
        // Apply updates to this new series
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) {
          console.error('User not authenticated for database save')
          return
        }
        
        const newSeriesData: Record<string, any> = {
          title: updates?.title ?? event.title ?? originalTitle,
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
          user_id: user.id,
        }
        
        console.log('updateThisAndFollowing: event.title =', event.title)
        console.log('updateThisAndFollowing: updates =', JSON.stringify(updates))
        console.log('updateThisAndFollowing: updates?.title =', updates?.title)
        console.log('updateThisAndFollowing: event.title =', event.title)
        console.log('updateThisAndFollowing: originalTitle =', originalTitle)
        console.log('updateThisAndFollowing: newSeriesData.title =', newSeriesData.title)
        
        // Add new series to eventsCache IMMEDIATELY (optimistic update) with temp ID
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
        
        const optimisticEventsCache = {
          ...currentEventsCache,
          [selectedDate]: [...(currentEventsCache[selectedDate] || []), tempSeriesCached],
        }
        
        // Update store immediately for UI
        set({
          eventsCache: optimisticEventsCache,
          computedEventsCache: {},
          recurringEventsCache: {},
          eventExceptionsCache: {},
        })
        
        // Now insert to database
        const { data: newSeriesResult, error: newSeriesError } = await supabase
          .from('events')
          .insert([newSeriesData])
          .select()
          .single()
        
        if (newSeriesError || !newSeriesResult) {
          console.error('Failed to create new series:', newSeriesError)
          // Remove temp event on failure
          const { eventsCache: cacheAfterError } = get()
          const cleanedCache = {
            ...cacheAfterError,
            [selectedDate]: cacheAfterError[selectedDate].filter(e => e.id !== tempSeriesId),
          }
          set({ eventsCache: cleanedCache, computedEventsCache: {}, recurringEventsCache: {}, eventExceptionsCache: {} })
          return
        }
        
        // Replace temp event with real event in cache
        const { eventsCache: finalEventsCache } = get()
        // Use title from newSeriesData (the intended value) as fallback if DB returns unexpected value
        const finalTitle = newSeriesResult.title || newSeriesData.title
        const realSeriesCached: Event = {
          id: newSeriesResult.id,
          user_id: user.id,
          title: finalTitle,
          date: newSeriesResult.date,
          end_date: newSeriesResult.end_date,
          start_time: newSeriesResult.start_time,
          end_time: newSeriesResult.end_time,
          description: newSeriesResult.description,
          notes: newSeriesResult.notes,
          urls: newSeriesResult.urls,
          color: newSeriesResult.color,
          is_all_day: newSeriesResult.is_all_day,
          location: newSeriesResult.location,
          repeat: newSeriesResult.repeat,
          series_start_date: newSeriesResult.series_start_date,
          series_end_date: newSeriesResult.series_end_date,
          created_at: newSeriesResult.created_at,
          updated_at: newSeriesResult.updated_at,
        }
        
        const finalCache = {
          ...finalEventsCache,
          [selectedDate]: finalEventsCache[selectedDate].map(e => 
            e.id === tempSeriesId ? realSeriesCached : e
          ),
        }
        
        set({
          eventsCache: finalCache,
          computedEventsCache: {},
          recurringEventsCache: {},
          eventExceptionsCache: {},
        })
        
        // Log the new series master to verify it's in cache
        console.log('updateThisAndFollowing: New series master in cache:', {
          id: realSeriesCached.id,
          title: realSeriesCached.title,
          date: realSeriesCached.date,
          series_start_date: realSeriesCached.series_start_date,
          series_end_date: realSeriesCached.series_end_date,
          repeat: realSeriesCached.repeat,
        })
        console.log('updateThisAndFollowing: Created new series from', selectedDate, 'to', originalSeriesEndDate)
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
