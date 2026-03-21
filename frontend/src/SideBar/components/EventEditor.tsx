import React, { useState, useEffect, useRef, useCallback } from 'react'
import { useEventsStore, type NewEvent, type EventFieldValue, type CalendarEvent } from '@/store/eventsStore'
import { Input } from '@/components/ui/input'
import RecurringActionDialog from '@/components/RecurringActionDialog'

interface URLChip {
  url: string
  id: string
}
const EventEditor: React.FC = () => {
  const selectedEventId = useEventsStore((state) => state.selectedEventId)
  const updateEventField = useEventsStore((state) => state.updateEventField)
  const saveTrigger = useEventsStore((state) => state.saveTrigger)
  const showRecurringDialog = useEventsStore((state) => state.showRecurringDialog)
  const recurringDialogOpen = useEventsStore((state) => state.recurringDialogOpen)
  const recurringDialogEvent = useEventsStore((state) => state.recurringDialogEvent)
  const recurringDialogActionType = useEventsStore((state) => state.recurringDialogActionType)
  const closeRecurringDialog = useEventsStore((state) => state.closeRecurringDialog)
  const setHasEditsEventId = useEventsStore((state) => state.setHasEditsEventId)

  const [title, setTitle] = useState('')
  const [notes, setNotes] = useState('')
  const [urlInput, setUrlInput] = useState('')
  const [urlChips, setUrlChips] = useState<URLChip[]>([])
  const [hasEdits, setHasEdits] = useState(false)
  const urlInputRef = useRef<HTMLInputElement>(null)
  const prevSelectedEventIdRef = useRef<string | null>(null)
  const editorRef = useRef<HTMLDivElement>(null)
  const urlSectionRef = useRef<HTMLDivElement>(null)

  // Subscribe to cache changes and trigger re-render
  const [, setEventVersion] = useState(0)
  const getEventById = useEventsStore((state) => state.getEventById)
  
  // Get the selected event - this will update when eventVersion changes
  const selectedEvent = selectedEventId ? getEventById(selectedEventId) : null
  
  // Subscribe to cache changes and trigger re-render
  useEffect(() => {
    const unsubscribe = useEventsStore.subscribe(
      () => {
        // Trigger re-render when caches change
        setEventVersion(v => v + 1)
      }
    )
    return unsubscribe
  }, [])

  // Load event data when selected event changes
  useEffect(() => {
    console.log('EventEditor: selected event changed, id =', selectedEvent?.id, 'title =', selectedEvent?.title)
    if (selectedEvent) {
      setTitle(selectedEvent.title === 'New Event' ? '' : selectedEvent.title)
      setNotes(selectedEvent.notes || '')
      const urls = selectedEvent.urls || []
      setUrlChips(urls.map((url: string, index: number) => ({ url, id: `${index}-${url}` })))
      setHasEdits(false)
      setHasEditsEventId(null)
    }
  }, [selectedEvent?.id])

  // Handle property change with recurring dialog
  const handlePropertyChange = useCallback((field: keyof NewEvent, value: EventFieldValue, extraFields?: Partial<Record<keyof NewEvent, EventFieldValue>>) => {
    console.log('handlePropertyChange CALLED:', { field, value, extraFields, stack: new Error().stack })
    // Get current values from store to handle ID changes (temp → real)
    const currentSelectedEventId = useEventsStore.getState().selectedEventId
    const currentEvent = currentSelectedEventId ? useEventsStore.getState().getEventById(currentSelectedEventId) : null
    console.log('handlePropertyChange: currentSelectedEventId =', currentSelectedEventId, 'currentEvent =', currentEvent)
    
    if (!currentEvent || !currentSelectedEventId) {
      console.log('handlePropertyChange: early return - no event or id')
      return
    }
    
    // Check if this is a recurring event INSTANCE using current event data
    // Only show dialog for virtual instances (isRecurringInstance = true)
    const eventIsRecurring = currentEvent && 
                        !currentEvent.isTemp &&
                        currentEvent.title !== "New Event" &&
                        (currentEvent as any).isRecurringInstance === true

    if (eventIsRecurring) {
      // Capture values at this moment
      const eventId = currentEvent.id
      const eventDate = (currentEvent as any).date
      const currentField = field
      const currentValue = value
      const currentExtraFields = extraFields

      showRecurringDialog(
        currentEvent as CalendarEvent,
        "edit",
        async (choice: string) => {
          if (choice === "only-this") {
            // Use splitRecurringEvent to split the series
            const splitRecurringEvent = useEventsStore.getState().splitRecurringEvent
            const setSelectedEvent = useEventsStore.getState().setSelectedEvent
            
            // Build updates object with current field and any extra fields
            const updates: Record<string, EventFieldValue> = {}
            if (currentField && currentValue !== undefined) {
              updates[currentField] = currentValue
            }
            if (currentExtraFields) {
              Object.entries(currentExtraFields).forEach(([key, val]) => {
                if (val !== undefined) {
                  updates[key] = val
                }
              })
            }
            
            await splitRecurringEvent(
              currentEvent as any,
              eventDate,
              (currentEvent as any).start_time,
              (currentEvent as any).end_time,
              updates as any
            )
            // Clear selection to force fresh render
            setSelectedEvent(null)
          } else if (choice === "all-events") {
            const updateAllInSeries = useEventsStore.getState().updateAllInSeries
            const seriesMasterId = (currentEvent as any).seriesMasterId || eventId
            
            // Build updates object with all fields
            const allUpdates: Record<string, EventFieldValue> = {}
            if (currentField && currentValue !== undefined) {
              allUpdates[currentField] = currentValue
            }
            if (currentExtraFields) {
              Object.entries(currentExtraFields).forEach(([key, val]) => {
                if (val !== undefined) {
                  allUpdates[key] = val
                }
              })
            }
            
            await updateAllInSeries(seriesMasterId, allUpdates as Partial<NewEvent>)
          }
          closeRecurringDialog()
        }
      )
    } else {
      updateEventField(currentSelectedEventId, field, value)
      if (extraFields) {
        Object.entries(extraFields).forEach(([key, val]) => {
          if (val !== undefined) {
            updateEventField(currentSelectedEventId, key as keyof NewEvent, val)
          }
        })
      }
    }
  }, [updateEventField, showRecurringDialog, closeRecurringDialog])

  // Save local state to cache when saveTrigger changes
  const titleRef = useRef(title)
  const notesRef = useRef(notes)
  const urlChipsRef = useRef(urlChips)
  
  // Update refs when local state changes
  useEffect(() => {
    titleRef.current = title
  }, [title])
  
  useEffect(() => {
    notesRef.current = notes
  }, [notes])
  
  useEffect(() => {
    urlChipsRef.current = urlChips
  }, [urlChips])
  
  useEffect(() => {
    console.log('saveTrigger useEffect: saveTrigger =', saveTrigger, 'selectedEventId =', selectedEventId)
    if (saveTrigger === 0) {
      console.log('saveTrigger useEffect: saveTrigger is 0, returning')
      return
    }
    
    const currentEventId = selectedEventId
    if (!currentEventId) {
      return
    }
    
    // Check if this is a virtual event ID (format: "masterEventId-YYYY-MM-DD")
    const datePattern = /-(\d{4}-\d{2}-\d{2})$/
    const isVirtualEventId = datePattern.test(currentEventId)
    
    // Get caches
    const { computedEventsCache, eventsCache } = useEventsStore.getState()
    let currentEvent: any = null
    
    if (isVirtualEventId) {
      // First check computedEventsCache for virtual events
      if (computedEventsCache) {
        for (const events of Object.values(computedEventsCache)) {
          const found = events.find((e: any) => e.id === currentEventId)
          if (found) {
            currentEvent = found
            break
          }
        }
      }
      
      // Not in cache - try to generate it on-demand
      if (!currentEvent) {
        const match = currentEventId.match(datePattern)
        if (match) {
          const virtualDate = match[1]
          const masterEventId = currentEventId.replace(datePattern, '')
          
          // Find master event in eventsCache
          for (const events of Object.values(eventsCache)) {
            const found = events.find((e: any) => e.id === masterEventId)
            if (found) {
              currentEvent = {
                ...found,
                id: currentEventId,
                date: virtualDate,
                end_date: virtualDate,
                isRecurringInstance: true,
                seriesMasterId: masterEventId,
                occurrenceDate: virtualDate,
              }
              break
            }
          }
        }
      }
    } else {
      // Real event
      currentEvent = getEventById(currentEventId)
    }
    
    if (!currentEvent) {
      console.log('saveTrigger: Event not found:', currentEventId)
      return
    }
    
    // Check if recurring - virtual instances have isRecurringInstance = true
    const eventIsRecurring = currentEvent.title !== "New Event" &&
                        currentEvent.isRecurringInstance === true
    console.log('saveTrigger useEffect: checking recurring, eventIsRecurring =', eventIsRecurring, 'title =', currentEvent.title, 'isRecurringInstance =', currentEvent.isRecurringInstance)
    
    if (eventIsRecurring) {
      showRecurringDialog(
        currentEvent as CalendarEvent,
        "edit",
        async (choice: string) => {
          if (choice === "only-this") {
            const splitRecurringEvent = useEventsStore.getState().splitRecurringEvent
            await splitRecurringEvent(
              currentEvent as any,
              (currentEvent as any).date,
              (currentEvent as any).start_time,
              (currentEvent as any).end_time,
              {
                title: titleRef.current || 'New Event',
                notes: notesRef.current,
                urls: urlChipsRef.current.map(c => c.url)
              }
            )
          } else if (choice === "all-events" || choice === "this-and-following") {
            const updateAllInSeries = useEventsStore.getState().updateAllInSeries
            const seriesMasterId = (currentEvent as any).seriesMasterId || currentEventId
            
            await updateAllInSeries(seriesMasterId, {
              title: titleRef.current || 'New Event',
              notes: notesRef.current,
              urls: urlChipsRef.current.map(c => c.url)
            })
          }
          setHasEdits(false)
          setHasEditsEventId(null)
          closeRecurringDialog()
        }
      )
    } else {
      updateEventField(currentEventId, 'title', titleRef.current || 'New Event')
      updateEventField(currentEventId, 'notes', notesRef.current)
      updateEventField(currentEventId, 'urls', urlChipsRef.current.map(c => c.url))
      
      // If repeat is set but series dates are missing, add them now
      const repeat = (currentEvent as any).repeat
      if (repeat && repeat !== 'None' && !(currentEvent as any).series_start_date) {
        const eventDate = (currentEvent as any).date
        const addYearsFn = (dateStr: string, years: number): string => {
          const date = new Date(dateStr + 'T00:00:00')
          date.setFullYear(date.getFullYear() + years)
          return date.toISOString().split('T')[0]
        }
        const seriesEndDate = addYearsFn(eventDate, 10)
        updateEventField(currentEventId, 'series_start_date', eventDate)
        updateEventField(currentEventId, 'series_end_date', seriesEndDate)
      }
    }
  }, [saveTrigger, selectedEventId, getEventById, updateEventField, showRecurringDialog, closeRecurringDialog])

  // Clear title on blur without Enter
  useEffect(() => {
    const prevId = prevSelectedEventIdRef.current
    const currentId = selectedEventId

    if (prevId && !currentId) {
      setTitle('')
      setNotes('')
      setUrlChips([])
      setHasEdits(false)
      setHasEditsEventId(null)
    }

    prevSelectedEventIdRef.current = currentId
  }, [selectedEventId])

  const handleContainerBlur = (e: React.FocusEvent) => {
    if (!editorRef.current?.contains(e.relatedTarget as Node)) {
      // Save any URL input that hasn't been added as chip yet
      if (selectedEventId && urlInput.trim()) {
        addUrlChip(urlInput.trim())
      }
      setUrlInput('')
    }
  }

  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newTitle = e.target.value
    setTitle(newTitle)
    titleRef.current = newTitle
    const currentSelectedEventId = useEventsStore.getState().selectedEventId
    if (currentSelectedEventId) {
      setHasEdits(true)
      setHasEditsEventId(currentSelectedEventId)
    }
  }

  const handleTitleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    console.log('handleTitleKeyDown: key =', e.key)
    const currentSelectedEventId = useEventsStore.getState().selectedEventId
    const currentEvent = currentSelectedEventId ? useEventsStore.getState().getEventById(currentSelectedEventId) : null
    console.log('handleTitleKeyDown: currentSelectedEventId =', currentSelectedEventId, 'currentEvent =', currentEvent)
    if (e.key === 'Enter' && currentSelectedEventId && currentEvent) {
      console.log('handleTitleKeyDown: ENTER PRESSED, calling handlePropertyChange with title:', titleRef.current)
      e.preventDefault()
      setHasEdits(false)
      setHasEditsEventId(null)
      handlePropertyChange('title', titleRef.current || 'New Event', {
        notes: notesRef.current,
        urls: urlChipsRef.current.map(c => c.url)
      })
    }
  }

  const handleNotesChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newNotes = e.target.value
    setNotes(newNotes)
    notesRef.current = newNotes
    const currentSelectedEventId = useEventsStore.getState().selectedEventId
    if (currentSelectedEventId) {
      setHasEdits(true)
      setHasEditsEventId(currentSelectedEventId)
    }
  }

  const handleNotesKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    const currentSelectedEventId = useEventsStore.getState().selectedEventId
    const currentEvent = currentSelectedEventId ? useEventsStore.getState().getEventById(currentSelectedEventId) : null
    if (e.key === 'Enter' && currentSelectedEventId && currentEvent) {
      e.preventDefault()
      handlePropertyChange('title', titleRef.current || 'New Event', {
        notes: notesRef.current,
        urls: urlChipsRef.current.map(c => c.url)
      })
    }
  }

  const handleUrlInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value

    if (value.endsWith(' ')) {
      const trimmedUrl = value.trim()
      if (trimmedUrl) {
        addUrlChip(trimmedUrl)
      }
      setUrlInput('')
    } else {
      setUrlInput(value)
    }
  }

  const handleUrlInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && urlInput === '' && urlChips.length > 0) {
      const newChips = urlChips.slice(0, -1)
      setUrlChips(newChips)
    }

    const currentSelectedEventId = useEventsStore.getState().selectedEventId
    const currentEvent = currentSelectedEventId ? useEventsStore.getState().getEventById(currentSelectedEventId) : null
    if (e.key === 'Enter' && currentSelectedEventId && currentEvent) {
      e.preventDefault()
      if (urlInput.trim()) {
        addUrlChip(urlInput.trim())
        setUrlInput('')
      }
      handlePropertyChange('title', titleRef.current || 'New Event', {
        notes: notesRef.current,
        urls: urlChipsRef.current.map(c => c.url)
      })
    }
  }

  const addUrlChip = (url: string) => {
    const newChip: URLChip = {
      url,
      id: `${Date.now()}-${url}`,
    }
    const newChips = [...urlChips, newChip]
    setUrlChips(newChips)
    urlChipsRef.current = newChips
    const currentSelectedEventId = useEventsStore.getState().selectedEventId
    const currentEvent = currentSelectedEventId ? useEventsStore.getState().getEventById(currentSelectedEventId) : null
    if (currentSelectedEventId && currentEvent) {
      setHasEdits(true)
      setHasEditsEventId(currentSelectedEventId)
      handlePropertyChange('urls', newChips.map(c => c.url))
    }
  }

  const removeUrlChip = (chipId: string) => {
    const newChips = urlChips.filter(chip => chip.id !== chipId)
    setUrlChips(newChips)
    urlChipsRef.current = newChips
    const currentSelectedEventId = useEventsStore.getState().selectedEventId
    const currentEvent = currentSelectedEventId ? useEventsStore.getState().getEventById(currentSelectedEventId) : null
    if (currentSelectedEventId && currentEvent) {
      setHasEdits(true)
      setHasEditsEventId(currentSelectedEventId)
      handlePropertyChange('urls', newChips.map(c => c.url))
    }
  }

  if (!selectedEvent) {
    return (
      <div className="px-4 py-4 text-slate-400">
        <p className="text-sm">Click an event to edit</p>
      </div>
    )
  }

  return (
    <>
      <div className="space-y-4">

        {/* Card */}
        <div 
          ref={editorRef}
          onBlur={handleContainerBlur}
          className="
shadow-lg border border-neutral-100

      w-full bg-[#ececec] rounded-[52px] p-5 border-20  space-y-3 shadow-none">


          {/* Title */}
          <Input
            type="text"
            placeholder="Title"
            value={title || ''}
            onChange={handleTitleChange}
            onKeyDown={handleTitleKeyDown}

            className="text-5xl font-bold  bg-transparent border-none
                       focus-visible:ring-0 focus-visible:ring-offset-0
                       px-0 h-14 placeholder:text-neutral-600 text-neutral-600"
          />

          {/* Notes */}
          <Input
            type="text"
            placeholder="Notes"
            value={notes}
            onChange={handleNotesChange}
            onKeyDown={handleNotesKeyDown}
            className="text-xl bg-transparent font-bold border-none
                       focus-visible:ring-0 focus-visible:ring-offset-0
                       px-0 h-6 placeholder:text-neutral-500 text-neutral-500"
          />

          {/* Divider */}
          <hr className="border-neutral-00  border-t-[3px]" />

          {/* URL Chips */}
          <div
            ref={urlSectionRef}
            className="flex flex-wrap items-center gap-2 min-h-[36px] cursor-text"
            onClick={() => urlInputRef.current?.focus()}
          >
{urlChips.map((chip) => (
              <span
                key={chip.id}
                className="inline-flex items-center gap-1 px-2 
               bg-neutral-100  
               border-neutral-300 border-2 border-solid
               text-neutral-400 text-xl
               font-semibold
                          rounded-full"
              >
                <span className="truncate max-w-[150px]">
                  {chip.url}
                </span>
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    removeUrlChip(chip.id)
                  }}
                  className="text-neutral-400 hover:text-neutral-500"
                >
                  ×
                </button>
              </span>
            ))}

            <input
              type="text"
              placeholder={urlChips.length === 0 ? "URL" : ""}
              value={urlInput}
              onChange={handleUrlInputChange}
              onKeyDown={handleUrlInputKeyDown}
              className="flex-1 min-w-[80px] bg-transparent
                          text-xl text-neutral-500
                          placeholder:text-neutral-400
             
                   font-semibold
                          focus:outline-none"
            />
          </div>
        </div>
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

export default EventEditor
