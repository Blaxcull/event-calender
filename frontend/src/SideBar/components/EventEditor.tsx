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

  const [title, setTitle] = useState('')
  const [notes, setNotes] = useState('')
  const [urlInput, setUrlInput] = useState('')
  const [urlChips, setUrlChips] = useState<URLChip[]>([])
  const urlInputRef = useRef<HTMLInputElement>(null)
  const prevSelectedEventIdRef = useRef<string | null>(null)
  const editorRef = useRef<HTMLDivElement>(null)
  const urlSectionRef = useRef<HTMLDivElement>(null)

  // Subscribe to caches to trigger re-renders when events change
  const eventsCache = useEventsStore((state) => state.eventsCache)
  const computedEventsCache = useEventsStore((state) => state.computedEventsCache)

  // Get the selected event - depends on caches to update when events change
  const selectedEvent = useEventsStore((state) => {
    if (!selectedEventId) return null
    // Access caches to ensure this selector re-runs when they change
    void eventsCache
    void computedEventsCache
    return state.getEventById(selectedEventId)
  })

  // Check if this is a recurring event (virtual instance OR master with repeat AND series dates)
  // Don't show dialog for new/temp events
  const isRecurring = selectedEvent && 
                      !selectedEvent.isTemp &&
                      selectedEvent.title !== "New Event" &&
                      (selectedEvent.isRecurringInstance || 
                       (selectedEvent.repeat && 
                        selectedEvent.repeat !== "None" &&
                        (selectedEvent.series_start_date || selectedEvent.series_end_date)))

  // Load event data when selected event changes
  useEffect(() => {
    if (selectedEvent) {
      setTitle(selectedEvent.title === 'New Event' ? '' : selectedEvent.title)
      setNotes(selectedEvent.notes || '')
      const urls = selectedEvent.urls || []
      setUrlChips(urls.map((url, index) => ({ url, id: `${index}-${url}` })))
    }
  }, [selectedEvent?.id])

  // Handle property change with recurring dialog
  const handlePropertyChange = useCallback((field: keyof NewEvent, value: EventFieldValue, extraFields?: Partial<Record<keyof NewEvent, EventFieldValue>>) => {
    if (!selectedEvent || !selectedEventId) return

    if (isRecurring) {
      showRecurringDialog(
        selectedEvent as CalendarEvent,
        "edit",
        (choice: string) => {
          console.log(`Edit ${field}: ${value}, choice: ${choice}`)
          closeRecurringDialog()
        }
      )
    } else {
      updateEventField(selectedEventId, field, value)
      if (extraFields) {
        Object.entries(extraFields).forEach(([key, val]) => {
          if (val !== undefined) {
            updateEventField(selectedEventId, key as keyof NewEvent, val)
          }
        })
      }
    }
  }, [selectedEvent, selectedEventId, isRecurring, updateEventField, showRecurringDialog, closeRecurringDialog])

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
    if (selectedEventId && saveTrigger > 0) {
      // For recurring events, we need to handle through the dialog
      // But for saveTrigger, we'll update directly since user already made choice
      updateEventField(selectedEventId, 'title', titleRef.current || 'New Event')
      updateEventField(selectedEventId, 'notes', notesRef.current)
      updateEventField(selectedEventId, 'urls', urlChipsRef.current.map(c => c.url))
    }
  }, [saveTrigger, updateEventField])

  // Clear title on blur without Enter
  useEffect(() => {
    const prevId = prevSelectedEventIdRef.current
    const currentId = selectedEventId

    if (prevId && !currentId) {
      setTitle('')
      setNotes('')
      setUrlChips([])
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
    setTitle(e.target.value)
  }

  const handleTitleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && selectedEventId && selectedEvent) {
      e.preventDefault()
      handlePropertyChange('title', title || 'New Event', {
        notes,
        urls: urlChips.map(c => c.url)
      })
    }
  }

  const handleNotesChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setNotes(e.target.value)
  }

  const handleNotesKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && selectedEventId && selectedEvent) {
      e.preventDefault()
      handlePropertyChange('title', title || 'New Event', {
        notes,
        urls: urlChips.map(c => c.url)
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

    if (e.key === 'Enter' && selectedEventId && selectedEvent) {
      e.preventDefault()
      if (urlInput.trim()) {
        addUrlChip(urlInput.trim())
        setUrlInput('')
      }
      handlePropertyChange('title', title || 'New Event', {
        notes,
        urls: urlChips.map(c => c.url)
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
    if (selectedEventId && selectedEvent) {
      handlePropertyChange('urls', newChips.map(c => c.url))
    }
  }

  const removeUrlChip = (chipId: string) => {
    const newChips = urlChips.filter(chip => chip.id !== chipId)
    setUrlChips(newChips)
    if (selectedEventId && selectedEvent) {
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
          onClose={closeRecurringDialog}
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
