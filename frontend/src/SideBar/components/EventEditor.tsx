import React, { useState, useEffect, useRef, useCallback } from 'react'
import { useEventsStore } from '@/store/eventsStore'
import { Input } from '@/components/ui/input'
import { useRecurringEvents } from '@/hooks/useRecurringEvents'
import RecurringEditDialog from '@/components/RecurringEditDialog'

interface URLChip {
  url: string
  id: string
}
const EventEditor: React.FC = () => {
  const selectedEventId = useEventsStore((state) => state.selectedEventId)
  const updateEventField = useEventsStore((state) => state.updateEventField)
  const addEventOptimistic = useEventsStore((state) => state.addEventOptimistic)
  // const setSelectedEvent = useEventsStore((state) => state.setSelectedEvent) // Not used - Enter key doesn't deselect
  const saveTrigger = useEventsStore((state) => state.saveTrigger)

  const {
    showEditDialog,
    pendingEdit,
    getMasterEventId,
    handleFieldChange,
    cancelDialog
  } = useRecurringEvents()

  const [title, setTitle] = useState('')
  const [notes, setNotes] = useState('')
  const [urlInput, setUrlInput] = useState('')
  const [urlChips, setUrlChips] = useState<URLChip[]>([])
  const urlInputRef = useRef<HTMLInputElement>(null)
  const prevSelectedEventIdRef = useRef<string | null>(null)
  const editorRef = useRef<HTMLDivElement>(null)
  const urlSectionRef = useRef<HTMLDivElement>(null)

  // Get the selected event
  const selectedEvent = useEventsStore((state) => {
    if (!selectedEventId) return null
    return state.getEventById(selectedEventId)
  })

  // Load event data when selected event changes
  useEffect(() => {
    if (selectedEvent) {
      setTitle(selectedEvent.title === 'New Event' ? '' : selectedEvent.title)
      setNotes(selectedEvent.notes || '')
      const urls = selectedEvent.urls || []
      setUrlChips(urls.map((url, index) => ({ url, id: `${index}-${url}` })))
    }
  }, [selectedEvent?.id])

  // Wrap updateEventField to match the expected signature
  const wrappedUpdateEventField = useCallback((id: string, field: string, value: any) => {
    updateEventField(id, field as any, value)
  }, [updateEventField])

  // Handle edit choice from dialog
  const handleEditChoice = (choice: 'only-this' | 'all-events' | 'this-and-following') => {
    if (!pendingEdit || !selectedEvent) return

    const { event, field, newValue } = pendingEdit
    const isVirtual = event.isRecurringInstance

    switch (choice) {
      case 'only-this':
        if (isVirtual) {
          // For virtual events, create a standalone copy
          const standaloneEvent = {
            ...event,
            id: crypto.randomUUID(),
            series_id: undefined,
            is_series_master: true,
            series_position: 0,
            isRecurringInstance: false,
            repeat: 'None'
          }
          addEventOptimistic(standaloneEvent as any)
          updateEventField(standaloneEvent.id, field as any, newValue)
        } else {
          // For master events, create a break in the series
          const breakEvent = {
            ...event,
            id: crypto.randomUUID(),
            series_id: undefined,
            is_series_master: true,
            series_position: 0,
            isRecurringInstance: false,
            repeat: 'None'
          }
          addEventOptimistic(breakEvent as any)
          updateEventField(breakEvent.id, field as any, newValue)
        }
        break

      case 'all-events':
        // Update the master event
        const masterId = getMasterEventId(event)
        updateEventField(masterId, field as any, newValue)
        break

      case 'this-and-following':
        // Split the series at this point
        const newMasterId = crypto.randomUUID()
        const splitEvent = {
          ...event,
          id: newMasterId,
          series_id: newMasterId,
          is_series_master: true,
          series_position: 0,
          isRecurringInstance: false
        }
        addEventOptimistic(splitEvent as any)
        updateEventField(newMasterId, field as any, newValue)
        break
    }

    cancelDialog()
  }

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
    console.log('EventEditor: saveTrigger useEffect, saveTrigger:', saveTrigger, 'selectedEventId:', selectedEventId)
    if (selectedEventId && saveTrigger > 0) {
      // For recurring events, we need to handle through the dialog
      // But for saveTrigger, we'll update directly since user already made choice
      console.log('EventEditor: Saving to cache via updateEventField')
      updateEventField(selectedEventId, 'title', titleRef.current || 'New Event')
      updateEventField(selectedEventId, 'notes', notesRef.current)
      updateEventField(selectedEventId, 'urls', urlChipsRef.current.map(c => c.url))
    }
  }, [saveTrigger, selectedEventId, updateEventField])

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
      handleFieldChange(
        selectedEvent as any,
        'title',
        title || 'New Event',
        wrappedUpdateEventField
      )
      handleFieldChange(
        selectedEvent as any,
        'notes',
        notes,
        wrappedUpdateEventField
      )
      handleFieldChange(
        selectedEvent as any,
        'urls',
        urlChips.map(c => c.url),
        wrappedUpdateEventField
      )
      // Don't deselect - keep event selected for further editing
      // setSelectedEvent(null)
    }
  }

  const handleNotesChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setNotes(e.target.value)
  }

  const handleNotesKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && selectedEventId && selectedEvent) {
      e.preventDefault()
      handleFieldChange(
        selectedEvent as any,
        'title',
        title || 'New Event',
        wrappedUpdateEventField
      )
      handleFieldChange(
        selectedEvent as any,
        'notes',
        notes,
        wrappedUpdateEventField
      )
      handleFieldChange(
        selectedEvent as any,
        'urls',
        urlChips.map(c => c.url),
        wrappedUpdateEventField
      )
      // Don't deselect - keep event selected for further editing
      // setSelectedEvent(null)
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
      handleFieldChange(
        selectedEvent as any,
        'title',
        title || 'New Event',
        wrappedUpdateEventField
      )
      handleFieldChange(
        selectedEvent as any,
        'notes',
        notes,
        wrappedUpdateEventField
      )
      handleFieldChange(
        selectedEvent as any,
        'urls',
        urlChips.map(c => c.url),
        wrappedUpdateEventField
      )
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
      handleFieldChange(
        selectedEvent as any,
        'urls',
        newChips.map(c => c.url),
        wrappedUpdateEventField
      )
    }
  }

  const removeUrlChip = (chipId: string) => {
    const newChips = urlChips.filter(chip => chip.id !== chipId)
    setUrlChips(newChips)
    if (selectedEventId && selectedEvent) {
      handleFieldChange(
        selectedEvent as any,
        'urls',
        newChips.map(c => c.url),
        wrappedUpdateEventField
      )
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

      {showEditDialog && pendingEdit && (
        <RecurringEditDialog
          open={showEditDialog}
          onClose={cancelDialog}
          onChoice={handleEditChoice}
          event={pendingEdit.event}
          field={pendingEdit.field}
          newValue={pendingEdit.newValue}
          oldValue={pendingEdit.oldValue}
        />
      )}
    </>
  )
}

export default EventEditor
