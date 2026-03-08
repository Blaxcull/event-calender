import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { supabase } from '@/lib/supabase'

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
  repeat?: string
  repeat_end_date?: string // ISO date string for when recurring should stop
  reminder?: string
  goalType?: string
  goal?: string
  earlyReminder?: string
  allDay?: string
  created_at?: string
  updated_at?: string
  // For optimistic updates
  isTemp?: boolean
  // For recurring events
  series_id?: string  // UUID to link recurring events together
  is_series_master?: boolean  // true for master, false for instances
  series_position?: number  // 0 for master, 1+ for instances
  isRecurringInstance?: boolean  // true for virtual recurrences (not in DB)
  originalEventId?: string  // For virtual recurrences, points to master
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
  repeat?: string
  repeat_end_date?: string // ISO date string for when recurring should stop
  reminder?: string
  goalType?: string
  goal?: string
  earlyReminder?: string
  allDay?: string
  // For recurring events
  series_id?: string
  is_series_master?: boolean
  series_position?: number
  // For optimistic updates
  id?: string
}



interface EventsCache {
  [date: string]: Event[]
}

interface EventsState {
  // Cache storage
  eventsCache: EventsCache

  // Cache for computed events (real + virtual)
  computedEventsCache: EventsCache

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

  // Recurring event exceptions (dates to skip for specific series)
  recurringExceptions: Record<string, Set<string>>

  // Actions
  fetchEventsWindow: (centerDate: Date) => void
  addEvent: (event: NewEvent) => Promise<Event>
  addEventOptimistic: (event: NewEvent) => Promise<Event>
  updateEvent: (id: string, updates: Partial<NewEvent>) => Promise<Event | null>
  deleteEvent: (id: string) => Promise<boolean>
  getEventsForDate: (date: Date) => Event[]
  getEventById: (id: string) => Event | null
  clearCache: () => void
  isEventSyncing: (eventId: string) => boolean
  isAnyEventSyncing: () => boolean
  setSelectedEvent: (id: string | null) => void
  updateEventField: (id: string, field: keyof NewEvent, value: any) => void
  saveSelectedEvent: () => Promise<void>
  addRecurringException: (seriesId: string, date: string) => void
  removeRecurringException: (seriesId: string, date: string) => void
  hasRecurringException: (seriesId: string, date: string) => boolean
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



// Helper to generate recurring dates based on repeat type
const generateRecurringDates = (startDate: string, repeat: string, endDate?: string): string[] => {
  const dates: string[] = []
  const maxOccurrences = 365 // Generate up to 1 year of events
  
  if (repeat === 'None' || !repeat) {
    return [startDate]
  }

  let currentDate = startDate
  
  for (let i = 0; i < maxOccurrences; i++) {
    if (i > 0) { // Skip the first one since it's the original event
      dates.push(currentDate)
    }
    
    // Check if we've reached the end date
    if (endDate && currentDate >= endDate) {
      break
    }
    
    switch (repeat) {
      case 'Daily':
        currentDate = addDaysToDateStr(currentDate, 1)
        break
      case 'Weekly':
        currentDate = addDaysToDateStr(currentDate, 7)
        break
      case 'Monthly':
        // Add 1 month
        const date = new Date(currentDate + 'T00:00:00')
        date.setMonth(date.getMonth() + 1)
        const year = date.getFullYear()
        const month = String(date.getMonth() + 1).padStart(2, '0')
        const day = String(date.getDate()).padStart(2, '0')
        currentDate = `${year}-${month}-${day}`
        break
      case 'Yearly':
        // Add 1 year
        const d = new Date(currentDate + 'T00:00:00')
        d.setFullYear(d.getFullYear() + 1)
        const y = d.getFullYear()
        const m = String(d.getMonth() + 1).padStart(2, '0')
        const da = String(d.getDate()).padStart(2, '0')
        currentDate = `${y}-${m}-${da}`
        break
      default:
        return [startDate]
    }
  }
  
  return dates
}



export const useEventsStore = create<EventsState>()(
  persist(
    (set, get) => ({
      eventsCache: {},
      computedEventsCache: {},
      cacheStartDate: null,
      cacheEndDate: null,
      cachedUserId: null,
      isLoading: false,
      error: null,
      pendingSyncs: new Set<string>(),
      pendingUpdates: new Map<string, Partial<NewEvent>[]>(),
      selectedEventId: null,
      saveTrigger: 0,
      recurringExceptions: {}, // series_id -> Set of dates to exclude

      fetchEventsWindow: async (centerDate: Date) => {
        console.log('fetchEventsWindow called for date:', centerDate)
        const startDate = addDays(centerDate, -CACHE_WINDOW_DAYS)
        const endDate = addDays(centerDate, CACHE_WINDOW_DAYS)
        
        const startStr = formatDate(startDate)
        const endStr = formatDate(endDate)
        console.log('Fetching window:', startStr, 'to', endStr)

        // Get current user before fetching
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) {
          console.warn('User not authenticated, cannot fetch events')
          set({ isLoading: false, error: 'User not authenticated', cachedUserId: null })
          return
        }
        console.log('User authenticated:', user.id)

        // Check if we need to clear cache (user changed or no cache)
        const { cacheStartDate, cacheEndDate, cachedUserId } = get()
        console.log('Current cache state: cachedUserId:', cachedUserId, 'cacheWindow:', cacheStartDate, 'to', cacheEndDate)
        
        if (cachedUserId !== user.id) {
          // User changed, clear cache
          console.log('User changed, clearing cache. Old user:', cachedUserId, 'New user:', user.id)
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
          console.log('Cache hit: already have data for this window')
          // Don't return - still fetch in background to check for updates
        } else {
          console.log('Cache miss: fetching from database')
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
          
          console.log('Fetched events from database for window:', startStr, 'to', endStr)
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
            [dateKey]: [...(eventsCache[dateKey] || []), localEvent],
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

            console.log('Background: Saving event to database via addEvent:', eventForDb)

            const { data, error } = await supabase
              .from('events')
              .insert([eventForDb])
              .select()
              .single()

            if (error) {
              console.error('Background: Database save failed:', error)
              return
            }

            console.log('Background: Event saved to database:', data)

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
         console.log('addEventOptimistic called with event:', event)
         // Generate temp ID if not provided
         const tempId = event.id || `temp-${Date.now()}-${Math.random().toString(36).slice(2)}`
         
         // Create temp event with placeholder user ID
         const now = new Date().toISOString()
         const endDate = event.end_date || event.date
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
           created_at: now,
           updated_at: now,
           isTemp: true,
           // Set series fields for recurring events
           series_id: event.repeat && event.repeat !== 'None' ? `series-${tempId}` : undefined,
           is_series_master: event.repeat && event.repeat !== 'None' ? true : undefined,
           series_position: event.repeat && event.repeat !== 'None' ? 0 : undefined,
           repeat: event.repeat,
         }
         console.log('Created temp event:', tempEvent)

        // Add to cache immediately
        const { eventsCache, computedEventsCache } = get()
        const dateKey = event.date
        console.log('Adding event to cache for date:', dateKey, 'existing events count:', eventsCache[dateKey]?.length || 0)

        // Track this event as syncing
        const currentPendingSyncs = new Set(get().pendingSyncs)
        currentPendingSyncs.add(tempId)
        
        // Invalidate computed cache for this date
        const newComputedCache = { ...computedEventsCache }
        delete newComputedCache[dateKey]
        console.log('Invalidated computed cache for date:', dateKey)
        
        set({
          eventsCache: {
            ...eventsCache,
            [dateKey]: [...(eventsCache[dateKey] || []), tempEvent],
          },
          computedEventsCache: newComputedCache,
          pendingSyncs: currentPendingSyncs,
        })
        console.log('Event added to cache, store updated')

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
            
            // Add series fields for recurring events
            if (event.repeat && event.repeat !== 'None') {
              // Generate a proper series ID (UUID-like)
              const seriesId = `series-${Date.now()}-${Math.random().toString(36).slice(2)}`
              eventForDb.series_id = seriesId
              eventForDb.is_series_master = true
              eventForDb.series_position = 0
            }

            console.log('Background: Saving event to database:', eventForDb)

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

            console.log('Background: Event saved to database:', data)

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
                console.log('Background: Applying queued updates to event:', queuedUpdates)
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
            console.log('Background: Checking selected event update. currentSelectedId:', currentSelectedId, 'tempId:', tempId, 'finalEvent.id:', finalEvent.id)
            if (currentSelectedId === tempId) {
              newSelectedId = finalEvent.id
              console.log('Background: Updating selectedEventId from temp to real:', tempId, '->', finalEvent.id)
            } else {
              console.log('Background: selectedEventId not updated. currentSelectedId !== tempId')
            }

            console.log('Background: Setting store with selectedEventId:', newSelectedId)
            // Invalidate computed cache since event ID changed (temp -> real)
            const { computedEventsCache: currentComputedCache } = get()
            const newComputedCache = { ...currentComputedCache }
            delete newComputedCache[dateKey]
            console.log('Background: Invalidated computed cache for date:', dateKey)
            
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
                console.log('Background: Syncing queued updates to database:', data.id, filteredUpdates)
                const { error } = await supabase
                  .from('events')
                  .update(filteredUpdates)
                  .eq('id', data.id)
                
                if (error) console.error('Background: Failed to sync queued updates:', error)
                else console.log('Background: Queued updates synced to database:', data.id)
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
             
             // Remove from old date
             newCache[oldDate].splice(eventIndex, 1)
             
             // Add to new date (if date changed) or same date
             const newDate = updates.date || oldDate
             if (!newCache[newDate]) {
               newCache[newDate] = []
             }
             newCache[newDate].push(updatedEvent)
             newCache[newDate].sort((a, b) => a.start_time - b.start_time)

             // Invalidate computed cache for both old and new dates
             delete newComputedCache[oldDate]
             delete newComputedCache[newDate]

             set({ eventsCache: newCache, computedEventsCache: newComputedCache })
             
             // Check if this is a temp event still syncing
             if (pendingSyncs.has(id)) {
               // Queue the update to be applied after sync completes
               const newPendingUpdates = new Map(pendingUpdates)
               const existing = newPendingUpdates.get(id) || []
               newPendingUpdates.set(id, [...existing, updates])
               set({ pendingUpdates: newPendingUpdates })
               console.log('Background: Queued update for temp event:', id, updates)
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
                             key === 'series_id' || key === 'is_series_master' || key === 'series_position') {
                           filteredUpdates[key] = value
                         }
                        // Only include end_date and is_all_day if they're explicitly set (not defaults)
                        if ((key === 'end_date' || key === 'is_all_day') && value !== undefined) {
                          filteredUpdates[key] = value
                        }
                      }
                    })

                   console.log('Background: Updating event in database:', id, 'with:', filteredUpdates)

                   const { error } = await supabase
                     .from('events')
                     .update(filteredUpdates)
                     .eq('id', id)

                   if (error) {
                    console.error('Background: Database update failed:', error)
                    // Note: We don't rollback UI update - user sees their change
                    // In a production app, you might want to show an error notification
                  } else {
                   console.log('Background: Event updated in database:', id)
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

         set({ eventsCache: newCache, computedEventsCache: newComputedCache })
        
        // Start background database delete (non-blocking)
        setTimeout(async () => {
          try {
            console.log('Background: Deleting event from database:', id)

            const { error } = await supabase
              .from('events')
              .delete()
              .eq('id', id)

            if (error) {
              console.error('Background: Database delete failed:', error)
              // Note: We don't restore the event - user sees it as deleted
              // In a production app, you might want to show an error notification
            } else {
              console.log('Background: Event deleted from database:', id)
            }
          } catch (err) {
            console.error('Background: Unexpected error during database delete:', err)
          }
        }, 0)
        
        return true
      },

      getEventsForDate: (date: Date): Event[] => {
        const dateKey = formatDate(date)
        const { eventsCache, computedEventsCache } = get()
        
        // Check if we have cached computed events for this date
        if (computedEventsCache[dateKey]) {
          console.log('getEventsForDate: Returning cached events for', dateKey, 'count:', computedEventsCache[dateKey].length)
          return computedEventsCache[dateKey]
        }
        
        console.log('getEventsForDate: Computing events for', dateKey, 'eventsCache for this date:', eventsCache[dateKey]?.length || 0, 'events')
        
        // Get real events for this date, filtering out those with exceptions
        const rawRealEvents = eventsCache[dateKey] || []
        const realEvents = rawRealEvents.filter(event => {
          // Check if this is a recurring event with an exception for this date
          if (event.repeat && event.repeat !== 'None') {
            const seriesId = event.series_id || event.id
            if (get().hasRecurringException(seriesId, dateKey)) {
              return false // Skip this event, it has an exception
            }
          }
          return true
        })
        
        // Also generate virtual recurring events from master events
        const virtualEvents: Event[] = []
        const today = new Date()
        const cacheWindowDays = 30 // Generate virtual events for 30-day window
        const windowStart = addDays(today, -cacheWindowDays)
        const windowEnd = addDays(today, cacheWindowDays)
        
        // Check if target date is within cache window
        if (date < windowStart || date > windowEnd) {
          // Cache the result
          set(state => ({
            computedEventsCache: {
              ...state.computedEventsCache,
              [dateKey]: realEvents
            }
          }))
          console.log('getEventsForDate: Outside cache window, returning', realEvents.length, 'real events')
          return realEvents // Outside cache window, no virtual events
        }
        
        // Look through all events in cache to find master recurring events
        Object.values(eventsCache).forEach(events => {
          events.forEach(event => {
            // Check if this is a master recurring event
            if (event.repeat && event.repeat !== 'None' && event.is_series_master !== false) {
              // Generate recurring dates for this event
              const recurringDates = generateRecurringDates(event.date, event.repeat, event.repeat_end_date)
              
              // Check if target date is a recurrence of this event
              if (recurringDates.includes(dateKey)) {
                // Check if this date is excluded for this series
                const seriesId = event.series_id || event.id
                const hasException = get().hasRecurringException(seriesId, dateKey)
                
                if (!hasException) {
                  // Create virtual recurrence
                  const virtualEvent: Event = {
                    ...event,
                    id: `${event.id}-${dateKey}`, // masterId-date format
                    date: dateKey,
                    end_date: dateKey, // Single-day recurring events
                    isRecurringInstance: true,
                    originalEventId: event.id,
                    // Inherit series fields
                    series_id: event.series_id,
                    is_series_master: false,
                    series_position: 0, // Will calculate if needed
                  }
                  virtualEvents.push(virtualEvent)
                }
              }
            }
          })
        })
        
        // Combine real and virtual events, remove duplicates
        const allEvents = [...realEvents, ...virtualEvents]
        
        // Remove duplicates (in case a real event already exists for this date)
        const uniqueEvents = allEvents.filter((event, index, self) =>
          index === self.findIndex(e => e.id === event.id)
        )
        
        // Cache the computed result
        set(state => ({
          computedEventsCache: {
            ...state.computedEventsCache,
            [dateKey]: uniqueEvents
          }
        }))
        
        console.log('getEventsForDate: Computed', uniqueEvents.length, 'events for', dateKey, '(real:', realEvents.length, 'virtual:', virtualEvents.length, ')')
        return uniqueEvents
      },

      getEventById: (id: string): Event | null => {
        const { eventsCache, computedEventsCache } = get()
        
        // First search through all dates in eventsCache (real events)
        for (const dateKey in eventsCache) {
          const event = eventsCache[dateKey].find(e => e.id === id)
          if (event) {
            console.log('getEventById: Found real event', id, 'in date', dateKey, 'with times:', { start_time: event.start_time, end_time: event.end_time })
            return event
          }
        }
        
        // Also search through computedEventsCache (includes virtual events)
        for (const dateKey in computedEventsCache) {
          const event = computedEventsCache[dateKey].find(e => e.id === id)
          if (event) {
            console.log('getEventById: Found computed event', id, 'in date', dateKey, 'with times:', { start_time: event.start_time, end_time: event.end_time })
            return event
          }
        }
        
        console.log('getEventById: Event not found', id)
        return null
      },

      isEventSyncing: (eventId: string): boolean => {
        return get().pendingSyncs.has(eventId)
      },

      isAnyEventSyncing: (): boolean => {
        return get().pendingSyncs.size > 0
      },

      setSelectedEvent: (id: string | null) => {
        console.log('setSelectedEvent called with:', id, 'stack:', new Error().stack)
        set({ selectedEventId: id })
      },

      updateEventField: (id: string, field: keyof NewEvent, value: any) => {
        console.log('updateEventField called:', { id, field, value })
        const { eventsCache, computedEventsCache, pendingSyncs, pendingUpdates } = get()
        const dateKey = Object.keys(eventsCache).find(date =>
          eventsCache[date].some(e => e.id === id)
        )

        if (!dateKey) {
          console.log('updateEventField: No dateKey found for event', id)
          return
        }

        const eventIndex = eventsCache[dateKey].findIndex(e => e.id === id)
        if (eventIndex === -1) {
          console.log('updateEventField: Event not found in cache', id)
          return
        }

        const currentEvent = eventsCache[dateKey][eventIndex]
        console.log('updateEventField: Current event:', { 
          id: currentEvent.id, 
          start_time: currentEvent.start_time, 
          end_time: currentEvent.end_time,
          title: currentEvent.title 
        })
        
        // Check if value is actually changing
        const currentValue = currentEvent[field as keyof Event]
        if (currentValue === value) {
          console.log('updateEventField: Value unchanged, skipping update for field:', field)
          return
        }
        
        const duration = currentEvent.end_time - currentEvent.start_time

        let endTimeValue = currentEvent.end_time
        if (field === 'start_time') {
          endTimeValue = value + duration
          console.log('updateEventField: Updating start_time, new end_time:', endTimeValue)
        }

        const updatedEvent = {
          ...currentEvent,
          [field]: value,
          ...(field === 'start_time' && { end_time: endTimeValue }),
          updated_at: new Date().toISOString(),
        }

        const newCache = { ...eventsCache }
        const newComputedCache = { ...computedEventsCache }

        // Handle date change - move event to new date key
        if (field === 'date' && value !== dateKey) {
          console.log('updateEventField: Moving event from', dateKey, 'to', value)
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
          console.log('updateEventField: Updating event in place for date', dateKey)
          newCache[dateKey] = [...newCache[dateKey]]
          newCache[dateKey][eventIndex] = updatedEvent
          
          // Invalidate computed cache for this date
          delete newComputedCache[dateKey]
        }

        console.log('updateEventField: Setting new cache, invalidated computed cache for', dateKey)
        set({ eventsCache: newCache, computedEventsCache: newComputedCache })

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
              console.log('Background: Event field updated:', id, updates)
            }
          } catch (err) {
            console.error('Background: Unexpected error during field update:', err)
          }
        }, 0)
      },

      saveSelectedEvent: async () => {
        console.log('saveSelectedEvent called')
        try {
          // Trigger EventEditor to save its local state to cache first
          const { saveTrigger } = get()
          console.log('saveSelectedEvent: Setting saveTrigger from', saveTrigger, 'to', saveTrigger + 1)
          set({ saveTrigger: saveTrigger + 1 })
          
          // Wait for EventEditor to save local state to cache
          await new Promise(resolve => setTimeout(resolve, 50))
          
          const { selectedEventId, eventsCache } = get()
          console.log('saveSelectedEvent: selectedEventId:', selectedEventId, 'eventsCache keys:', Object.keys(eventsCache))
          if (!selectedEventId) {
            console.log('saveSelectedEvent: No selectedEventId, returning')
            return
          }

          const dateKey = Object.keys(eventsCache).find(date =>
            eventsCache[date].some(e => e.id === selectedEventId)
          )
          console.log('saveSelectedEvent: dateKey found:', dateKey)
          if (!dateKey) {
            console.log('saveSelectedEvent: No dateKey found for event', selectedEventId)
            return
          }

          const event = eventsCache[dateKey].find(e => e.id === selectedEventId)
          console.log('saveSelectedEvent: event found:', event ? { id: event.id, title: event.title } : 'null')
          if (!event) {
            console.log('saveSelectedEvent: Event not found in cache')
            return
          }

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
            repeat: event.repeat,
            repeat_end_date: event.repeat_end_date,
            series_id: event.series_id,
            is_series_master: event.is_series_master,
            series_position: event.series_position,
          }
          console.log('saveSelectedEvent: Prepared updates:', updates)

          // Update frontend cache FIRST (immediate UI update)
          console.log('saveSelectedEvent: Calling updateEvent with id:', selectedEventId)
          const updatedEvent = await get().updateEvent(selectedEventId, updates)
          
          if (!updatedEvent) {
            console.error('saveSelectedEvent: Failed to update event in cache')
            return
          }
          console.log('saveSelectedEvent: Event updated in cache:', updatedEvent.id)

          // Background database update (non-blocking)
          setTimeout(async () => {
            try {
              console.log('saveSelectedEvent: Background database update for', selectedEventId)
              const { error } = await supabase
                .from('events')
                .update(updates)
                .eq('id', selectedEventId)

              if (error) {
                console.error('saveSelectedEvent: Background: Database update failed:', error)
              } else {
                console.log('saveSelectedEvent: Background: Event saved to database:', selectedEventId)
              }
            } catch (err) {
              console.error('saveSelectedEvent: Background: Unexpected error during database save:', err)
            }
          }, 0)
        } catch (error) {
          console.error('saveSelectedEvent: Unexpected error:', error)
        }
      },

        addRecurringException: (seriesId: string, date: string) => {
         const { recurringExceptions, computedEventsCache } = get()
         const newExceptions = { ...recurringExceptions }
         const newComputedCache = { ...computedEventsCache }
         
         if (!newExceptions[seriesId]) {
           newExceptions[seriesId] = new Set<string>()
         }
         newExceptions[seriesId].add(date)
         
         // Invalidate computed cache for this date
         delete newComputedCache[date]
         
         set({ recurringExceptions: newExceptions, computedEventsCache: newComputedCache })
         console.log('Added recurring exception:', seriesId, date)
       },
       
       removeRecurringException: (seriesId: string, date: string) => {
         const { recurringExceptions, computedEventsCache } = get()
         const newExceptions = { ...recurringExceptions }
         const newComputedCache = { ...computedEventsCache }
         
         if (newExceptions[seriesId]) {
           newExceptions[seriesId].delete(date)
           if (newExceptions[seriesId].size === 0) {
             delete newExceptions[seriesId]
           }
         }
         
         // Invalidate computed cache for this date
         delete newComputedCache[date]
         
         set({ recurringExceptions: newExceptions, computedEventsCache: newComputedCache })
         console.log('Removed recurring exception:', seriesId, date)
      },
      
      hasRecurringException: (seriesId: string, date: string) => {
        const { recurringExceptions } = get()
        return !!(recurringExceptions[seriesId] && recurringExceptions[seriesId].has(date))
      },
      
      clearCache: () => {
        set({
          eventsCache: {},
          computedEventsCache: {},
          cacheStartDate: null,
          cacheEndDate: null,
          cachedUserId: null,
          recurringExceptions: {},
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
        recurringExceptions: Object.fromEntries(
          Object.entries(state.recurringExceptions).map(([key, set]) => [key, Array.from(set)])
        ),
      }),
       onRehydrateStorage: () => (state) => {
        console.log('Store rehydrating, state:', state ? 'has state' : 'no state')
        if (state) {
          console.log('Rehydrated eventsCache size:', Object.keys(state.eventsCache || {}).length)
          console.log('Rehydrated cachedUserId:', state.cachedUserId)
          // Convert arrays back to Sets after rehydration
          const convertedExceptions: Record<string, Set<string>> = {}
          Object.entries(state.recurringExceptions || {}).forEach(([key, value]) => {
            if (Array.isArray(value)) {
              convertedExceptions[key] = new Set(value)
            } else if (value instanceof Set) {
              convertedExceptions[key] = value
            }
          })
          state.recurringExceptions = convertedExceptions
          console.log('Store rehydration complete')
        }
      },
    }
  )
)
