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

  // Trigger to force EventEditor to save local state
  saveTrigger: number

  // Recurring action dialog state
  recurringDialogOpen: boolean
  recurringDialogEvent: CalendarEvent | null
  recurringDialogActionType: "edit" | "delete" | null
  recurringDialogCallback: ((choice: string) => void) | null

  // Actions
  fetchEventsWindow: (centerDate: Date) => void
  addEvent: (event: NewEvent) => Promise<Event>
  addEventOptimistic: (event: NewEvent) => Promise<Event>
  updateEvent: (id: string, updates: Partial<NewEvent>) => Promise<Event | null>
  deleteEvent: (id: string) => Promise<boolean>
  getEventsForDate: (date: Date) => CalendarEvent[]
  getEventById: (id: string) => CalendarEvent | null
  clearCache: () => void
  isEventSyncing: (eventId: string) => boolean
  isAnyEventSyncing: () => boolean
  setSelectedEvent: (id: string | null) => void
  updateEventField: (id: string, field: keyof NewEvent, value: EventFieldValue) => void
  saveSelectedEvent: () => Promise<void>
  showRecurringDialog: (event: CalendarEvent, actionType: "edit" | "delete", callback: (choice: string) => void) => void
  closeRecurringDialog: () => void
  splitRecurringEvent: (event: CalendarEvent, selectedDate: string, newStartTime?: number, newEndTime?: number, updates?: Partial<NewEvent>) => Promise<void>
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

// Generate recurring dates for a month based on series_start_date and series_end_date
const generateRecurringDatesForMonth = (
  seriesStartDate: string,
  seriesEndDate: string,
  monthStart: string, // YYYY-MM-01
  monthEnd: string    // YYYY-MM-31 (last day of month)
): string[] => {
  const dates: string[] = []
  
  // Determine effective start and end dates for this month
  const effectiveStart = seriesStartDate > monthStart ? seriesStartDate : seriesStartDate
  const effectiveEnd = seriesEndDate < monthEnd ? seriesEndDate : seriesEndDate
  
  if (effectiveStart > effectiveEnd) {
    return dates // Series doesn't cover this month
  }
  
  // Generate all dates from effectiveStart to effectiveEnd (Daily)
  let currentDate = effectiveStart
  while (currentDate <= effectiveEnd) {
    dates.push(currentDate)
    currentDate = addDaysToDateStr(currentDate, 1)
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
      saveTrigger: 0,
      recurringDialogOpen: false,
      recurringDialogEvent: null,
      recurringDialogActionType: null,
      recurringDialogCallback: null,

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
              const lastUpdate = queuedUpdates[queuedUpdates.length - 1]
              const filteredUpdates: Record<string, any> = {}
              Object.entries(lastUpdate).forEach(([key, value]) => {
                if (value !== undefined && (key === 'title' || key === 'date' || key === 'end_date' || key === 'start_time' || key === 'end_time')) {
                  filteredUpdates[key] = value
                }
              })
              
              if (Object.keys(filteredUpdates).length > 0) {
                const { error } = await supabase
                  .from('events')
                  .update(filteredUpdates)
                  .eq('id', data.id)
                
                if (error) console.error('Background: Failed to sync queued updates:', error)
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
             
             // Check if this is a temp event still syncing
             if (pendingSyncs.has(id)) {
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

       deleteEvent: async (id: string) => {
         // Update cache immediately
         const { eventsCache, computedEventsCache } = get()
         const newCache = { ...eventsCache }
         const newComputedCache = { ...computedEventsCache }
         
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
        
        // Start background database delete (non-blocking)
        setTimeout(async () => {
          try {

            const { error } = await supabase
              .from('events')
              .delete()
              .eq('id', id)

            if (error) {
              console.error('Background: Database delete failed:', error)
              // Note: We don't restore the event - user sees it as deleted
              // In a production app, you might want to show an error notification
            } else {
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
                  }
                }
              }
            })
          })
          
          // Generate recurring dates for each master event
          const generatedRecurring: CalendarEvent[] = []
          allMasterEvents.forEach(masterEvent => {
            const recurringDates = generateRecurringDatesForMonth(
              masterEvent.series_start_date!,
              masterEvent.series_end_date!,
              monthStart,
              monthEnd
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
          
          // Cache recurring events for the month
          set(state => ({
            recurringEventsCache: {
              ...state.recurringEventsCache,
              [monthKey]: generatedRecurring
            }
          }))
          
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
        
        // Cache the computed events for this date
        set(state => ({
          computedEventsCache: {
            ...state.computedEventsCache,
            [dateKey]: uniqueEvents
          }
        }))
        
        return uniqueEvents
      },

      getEventById: (id: string): CalendarEvent | null => {
        const { eventsCache, computedEventsCache } = get()
        
        // First search through all dates in eventsCache (real events)
        for (const dateKey in eventsCache) {
          const event = eventsCache[dateKey].find(e => e.id === id)
          if (event) {
            return event as CalendarEvent
          }
        }
        
        // Also search through computedEventsCache (includes virtual events)
        for (const dateKey in computedEventsCache) {
          const event = computedEventsCache[dateKey].find(e => e.id === id)
          if (event) {
            return event
          }
        }
        
        // Virtual event not in cache - try to generate it on-demand
        // Virtual event IDs look like: "masterEventId-YYYY-MM-DD"
        const datePattern = /-(\d{4}-\d{2}-\d{2})$/
        const match = id.match(datePattern)
        
        if (match) {
          const virtualDate = match[1]
          const masterEventId = id.replace(datePattern, '')
          
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
            
            // Cache it for future lookups
            set(state => ({
              computedEventsCache: {
                ...state.computedEventsCache,
                [virtualDate]: [...(state.computedEventsCache[virtualDate] || []), virtualEvent]
              }
            }))
            
            return virtualEvent
          }
        }
        
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

      updateEventField: (id: string, field: keyof NewEvent, value: EventFieldValue) => {
        if (value === undefined) return
        
        const { eventsCache, computedEventsCache, pendingSyncs, pendingUpdates } = get()
        const dateKey = Object.keys(eventsCache).find(date =>
          eventsCache[date].some(e => e.id === id)
        )

        if (!dateKey) {
          return
        }

        const eventIndex = eventsCache[dateKey].findIndex(e => e.id === id)
        if (eventIndex === -1) {
          return
        }

        const currentEvent = eventsCache[dateKey][eventIndex]
        
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

        // Check if this is a temp event still syncing
        if (pendingSyncs.has(id)) {
          const newPendingUpdates = new Map(pendingUpdates)
          const existing = newPendingUpdates.get(id) || []
          newPendingUpdates.set(id, [...existing, { [field]: value }])
          set({ pendingUpdates: newPendingUpdates })
          return
        }

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
            }
          } catch (err) {
            console.error('Background: Unexpected error during field update:', err)
          }
        }, 0)
      },

      saveSelectedEvent: async () => {
        try {
          // Trigger EventEditor to save its local state to cache first
          const { saveTrigger } = get()
          set({ saveTrigger: saveTrigger + 1 })
          
          // Wait for EventEditor to save local state to cache
          await new Promise(resolve => setTimeout(resolve, 50))
          
          const { selectedEventId, eventsCache } = get()
          if (!selectedEventId) {
            return
          }

          const dateKey = Object.keys(eventsCache).find(date =>
            eventsCache[date].some(e => e.id === selectedEventId)
          )
          if (!dateKey) {
            return
          }

          const event = eventsCache[dateKey].find(e => e.id === selectedEventId)
          if (!event) {
            return
          }

          // Use the event's actual ID (could be real ID even if selectedEventId is stale temp ID)
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

          // Clear selectedEventId FIRST, then do DB update
          set({ selectedEventId: null, saveTrigger: 0 })

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

      splitRecurringEvent: async (
        event: CalendarEvent, 
        selectedDate: string, 
        newStartTime?: number, 
        newEndTime?: number, 
        updates?: Partial<NewEvent>
      ) => {
        const originalSeriesEndDate = event.series_end_date || event.date
        const originalRepeat = event.repeat || 'None'
        
        const prevDay = addDaysToDateStr(selectedDate, -1)
        const nextDay = addDaysToDateStr(selectedDate, 1)
        
        const startTime = newStartTime ?? event.start_time
        const endTime = newEndTime ?? event.end_time
        
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
        
        // Get the ORIGINAL title from the master event in cache
        let originalTitle = event.title
        
        // Try to get original title from eventsCache first
        for (const dateKey in eventsCache) {
          const masterEvent = eventsCache[dateKey].find(e => e.id === masterEventId)
          if (masterEvent) {
            originalTitle = masterEvent.title
            break
          }
        }
        
        // If not found in eventsCache, try computedEventsCache
        if (originalTitle === event.title) {
          for (const dateKey in computedEventsCache) {
            const masterEvent = computedEventsCache[dateKey].find(e => e.id === masterEventId)
            if (masterEvent) {
              originalTitle = masterEvent.title
              break
            }
          }
        }
        
        // Titles for the split
        const event2Title = updates?.title ?? event.title // NEW title (from updates) or original
        const originalEventTitle = originalTitle // ORIGINAL title
        
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
          
          // Create Event 2 (standalone on selected date) - uses NEW title and updates
          const event2Data: NewEvent = {
            title: event2Title,
            description: event.description,
            notes: event.notes,
            urls: event.urls,
            date: selectedDate,
            end_date: selectedDate,
            start_time: startTime,
            end_time: endTime,
            color: event.color,
            is_all_day: event.is_all_day,
            location: event.location,
            repeat: 'None',
            goal: event.goal,
            goalType: event.goalType,
            reminder: event.reminder,
            earlyReminder: event.earlyReminder,
            allDay: event.allDay,
            // Apply any additional updates (except title, date, start_time, end_time which are set above)
            ...updates,
            // Ensure these are always set for Event 2
            title: event2Title,
            date: selectedDate,
            end_date: selectedDate,
            start_time: startTime,
            end_time: endTime,
          }
          await get().addEventOptimistic(event2Data)
        }
        
        // Event 3: Create new series from nextDay - uses ORIGINAL title
        if (nextDay <= originalSeriesEndDate) {
          const { data: { user } } = await supabase.auth.getUser()
          if (!user) {
            console.error('User not authenticated for database save')
            return
          }
          
          // Insert Event 3 master to database
          const event3MasterData: Record<string, any> = {
            title: originalEventTitle,
            description: event.description,
            notes: event.notes,
            urls: event.urls,
            date: nextDay,
            end_date: nextDay,
            start_time: startTime,
            end_time: endTime,
            color: event.color,
            is_all_day: event.is_all_day,
            location: event.location,
            repeat: originalRepeat,
            series_start_date: nextDay,
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
