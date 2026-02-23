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
  reminder?: string
  created_at: string
  updated_at: string
  // For optimistic updates
  isTemp?: boolean
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
  reminder?: string
  // For optimistic updates
  id?: string
}



interface EventsCache {
  [date: string]: Event[]
}

interface EventsState {
  // Cache storage
  eventsCache: EventsCache

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

  // Actions
  fetchEventsWindow: (centerDate: Date) => void
  addEvent: (event: NewEvent) => Event
  addEventOptimistic: (event: NewEvent) => Event
  updateEvent: (id: string, updates: Partial<NewEvent>) => Event | null
  deleteEvent: (id: string) => boolean
  getEventsForDate: (date: Date) => Event[]
  clearCache: () => void
  isEventSyncing: (eventId: string) => boolean
  isAnyEventSyncing: () => boolean
  setSelectedEvent: (id: string | null) => void
  updateEventField: (id: string, field: keyof NewEvent, value: any) => void
}

const CACHE_WINDOW_DAYS = 17 // Days before and after

// Helper to format date as YYYY-MM-DD using local timezone
export const formatDate = (date: Date): string => {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

// Helper to add/subtract days
const addDays = (date: Date, days: number): Date => {
  const result = new Date(date)
  result.setDate(result.getDate() + days)
  return result
}



export const useEventsStore = create<EventsState>()(
  persist(
    (set, get) => ({
      eventsCache: {},
      cacheStartDate: null,
      cacheEndDate: null,
      cachedUserId: null,
      isLoading: false,
      error: null,
      pendingSyncs: new Set<string>(),
      pendingUpdates: new Map<string, Partial<NewEvent>[]>(),
      selectedEventId: null,

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
          console.log('User changed, clearing cache. Old user:', cachedUserId, 'New user:', user.id)
          set({
            eventsCache: {},
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
          return
        }

        set({ isLoading: true, error: null })
        
        // Fetch from database in background
        setTimeout(async () => {
          try {
            const { data, error } = await supabase
              .from('events')
              .select('*')
              .eq('user_id', user.id)  // Filter by current user
              .gte('date', startStr)
              .lte('date', endStr)
              .order('start_time', { ascending: true })

            if (error) {
              console.error('Background: Database fetch failed:', error)
              set({
                error: error.message,
                isLoading: false,
              })
              return
            }

            const newCache: EventsCache = {}
            data?.forEach((event: Event) => {
              if (!newCache[event.date]) {
                newCache[event.date] = []
              }
              newCache[event.date].push(event)
            })

            const { eventsCache: oldCache, pendingSyncs } = get()

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
              cacheStartDate: startStr,
              cacheEndDate: endStr,
              cachedUserId: user.id,
              isLoading: false,
            })
            
            console.log('Background: Fetched events from database for window:', startStr, 'to', endStr)
          } catch (err) {
            console.error('Background: Unexpected error during database fetch:', err)
            set({
              error: err instanceof Error ? err.message : 'Failed to fetch events',
              isLoading: false,
            })
          }
        }, 0)
      },

      addEvent: (event: NewEvent) => {
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
        const { eventsCache } = get()
        const dateKey = event.date
        
        set({
          eventsCache: {
            ...eventsCache,
            [dateKey]: [...(eventsCache[dateKey] || []), localEvent],
          },
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

       addEventOptimistic: (event: NewEvent) => {
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
        }

        // Add to cache immediately
        const { eventsCache } = get()
        const dateKey = event.date

        // Track this event as syncing
        const currentPendingSyncs = new Set(get().pendingSyncs)
        currentPendingSyncs.add(tempId)
        set({
          eventsCache: {
            ...eventsCache,
            [dateKey]: [...(eventsCache[dateKey] || []), tempEvent],
          },
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
            if (currentSelectedId === tempId) {
              newSelectedId = finalEvent.id
            }

            set({
              eventsCache: newCache,
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
                supabase
                  .from('events')
                  .update(filteredUpdates)
                  .eq('id', data.id)
                  .then(({ error }) => {
                    if (error) console.error('Background: Failed to sync queued updates:', error)
                    else console.log('Background: Queued updates synced to database:', data.id)
                  })
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

       updateEvent: (id: string, updates: Partial<NewEvent>) => {
         const { eventsCache, pendingSyncs, pendingUpdates } = get()
         const oldDate = Object.keys(eventsCache).find(date =>
           eventsCache[date].some(e => e.id === id)
         )

         if (oldDate) {
           const newCache = { ...eventsCache }
           
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

             set({ eventsCache: newCache })
             
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
                       // Only include fields that exist in current schema
                       // Note: end_date, is_all_day, description, color, location may not exist until migration is run
                       if (key === 'title' || key === 'date' || key === 'start_time' || key === 'end_time') {
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

      deleteEvent: (id: string) => {
        // Update cache immediately
        const { eventsCache } = get()
        const newCache = { ...eventsCache }
        
        Object.keys(newCache).forEach(date => {
          newCache[date] = newCache[date].filter(e => e.id !== id)
        })

        set({ eventsCache: newCache })
        
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
        return get().eventsCache[dateKey] || []
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

      updateEventField: (id: string, field: keyof NewEvent, value: any) => {
        const { eventsCache, pendingSyncs, pendingUpdates } = get()
        const dateKey = Object.keys(eventsCache).find(date =>
          eventsCache[date].some(e => e.id === id)
        )

        if (!dateKey) return

        const eventIndex = eventsCache[dateKey].findIndex(e => e.id === id)
        if (eventIndex === -1) return

        const updatedEvent = {
          ...eventsCache[dateKey][eventIndex],
          [field]: value,
          updated_at: new Date().toISOString(),
        }

        const newCache = { ...eventsCache }
        newCache[dateKey] = [...newCache[dateKey]]
        newCache[dateKey][eventIndex] = updatedEvent

        set({ eventsCache: newCache })

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
            const { error } = await supabase
              .from('events')
              .update({ [field]: value })
              .eq('id', id)

            if (error) {
              console.error('Background: Database field update failed:', error)
            } else {
              console.log('Background: Event field updated:', id, field)
            }
          } catch (err) {
            console.error('Background: Unexpected error during field update:', err)
          }
        }, 0)
      },

      clearCache: () => {
        set({
          eventsCache: {},
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
