import React, { useState, useEffect, useRef } from 'react'
import { Trash2 } from 'lucide-react'
import { useEventsStore, formatDate } from '@/store/eventsStore'
import { useTimeStore } from '@/store/timeStore'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

interface URLChip {
  url: string
  id: string
}

const EventEditor: React.FC = () => {
  const selectedEventId = useEventsStore((state) => state.selectedEventId)
  const eventsCache = useEventsStore((state) => state.eventsCache)
  const updateEventField = useEventsStore((state) => state.updateEventField)
  const deleteEvent = useEventsStore((state) => state.deleteEvent)
  const setSelectedEvent = useEventsStore((state) => state.setSelectedEvent)
  const selectedDate = useTimeStore((state) => state.selectedDate)

  const [title, setTitle] = useState('')
  const [notes, setNotes] = useState('')
  const [urlInput, setUrlInput] = useState('')
  const [urlChips, setUrlChips] = useState<URLChip[]>([])
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)
  const urlInputRef = useRef<HTMLInputElement>(null)
  const prevSelectedEventIdRef = useRef<string | null>(null)

  // Get the selected event
  const selectedEvent = React.useMemo(() => {
    if (!selectedEventId || !selectedDate) return null
    const dateKey = formatDate(selectedDate)
    const events = eventsCache[dateKey] || []
    return events.find(e => e.id === selectedEventId)
  }, [selectedEventId, eventsCache, selectedDate])

  // Load event data when selected event changes
  useEffect(() => {
    if (selectedEvent) {
      setTitle(selectedEvent.title === 'New Event' ? '' : selectedEvent.title)
      setNotes(selectedEvent.notes || '')
      const urls = selectedEvent.urls || []
      setUrlChips(urls.map((url, index) => ({ url, id: `${index}-${url}` })))
      setHasUnsavedChanges(false)
    }
  }, [selectedEvent?.id])

  // Save pending changes when deselecting
  useEffect(() => {
    const prevId = prevSelectedEventIdRef.current
    const currentId = selectedEventId

    // If going from selected to not selected, save pending changes
    if (prevId && !currentId && hasUnsavedChanges) {
      updateEventField(prevId, 'title', title)
      updateEventField(prevId, 'notes', notes)
      updateEventField(prevId, 'urls', urlChips.map(c => c.url))
    }

    prevSelectedEventIdRef.current = currentId
  }, [selectedEventId, hasUnsavedChanges, title, notes, urlChips, updateEventField])

  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setTitle(e.target.value)
    setHasUnsavedChanges(true)
  }

  const handleTitleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && selectedEventId) {
      e.preventDefault()
      updateEventField(selectedEventId, 'title', title || 'New Event')
      updateEventField(selectedEventId, 'notes', notes)
      updateEventField(selectedEventId, 'urls', urlChips.map(c => c.url))
      setHasUnsavedChanges(false)
      setSelectedEvent(null)
    }
  }

  const handleNotesChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setNotes(e.target.value)
    setHasUnsavedChanges(true)
  }

  const handleNotesKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && selectedEventId) {
      e.preventDefault()
      updateEventField(selectedEventId, 'title', title || 'New Event')
      updateEventField(selectedEventId, 'notes', notes)
      updateEventField(selectedEventId, 'urls', urlChips.map(c => c.url))
      setHasUnsavedChanges(false)
      setSelectedEvent(null)
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
      setHasUnsavedChanges(true)
    }

    if (e.key === 'Enter' && selectedEventId) {
      e.preventDefault()
      if (urlInput.trim()) {
        addUrlChip(urlInput.trim())
        setUrlInput('')
      }
      updateEventField(selectedEventId, 'title', title || 'New Event')
      updateEventField(selectedEventId, 'notes', notes)
      updateEventField(selectedEventId, 'urls', urlChips.map(c => c.url))
      setHasUnsavedChanges(false)
    }
  }

  const addUrlChip = (url: string) => {
    const newChip: URLChip = {
      url,
      id: `${Date.now()}-${url}`,
    }
    const newChips = [...urlChips, newChip]
    setUrlChips(newChips)
    setHasUnsavedChanges(true)
  }

  const removeUrlChip = (chipId: string) => {
    const newChips = urlChips.filter(chip => chip.id !== chipId)
    setUrlChips(newChips)
    setHasUnsavedChanges(true)
  }

  const handleDelete = () => {
    if (selectedEventId && confirm('Are you sure you want to delete this event?')) {
      deleteEvent(selectedEventId)
      setSelectedEvent(null)
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
    <div className="space-y-4">

      {/*
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-neutral-200">
          Event Details
        </h3>

        <Button
          variant="ghost"
          size="sm"
          onClick={handleDelete}
          className="text-red-400 hover:text-red-300 
                     hover:bg-red-500/10 p-2"
        >
          <Trash2 className="h-5 w-5" />
        </Button>
      </div>

          */}

      {/* Card */}
      <div className="
shadow-lg border border-neutral-800
      w-full bg-neutral-700 rounded-[34px] p-5 border-20  space-y-4 shadow-none">



        {/* Title */}
        <Input
          type="text"
          placeholder="Title"
          value={title || ''}
          onChange={handleTitleChange}
          onKeyDown={handleTitleKeyDown}

          className="text-5xl  bg-transparent border-none
                     focus-visible:ring-0 focus-visible:ring-offset-0
                     px-0 h-14 placeholder:text-neutral-300 text-neutral-100"
        />

        {/* Notes */}
        <Input
          type="text"
          placeholder="Notes"
          value={notes}
          onChange={handleNotesChange}
          onKeyDown={handleNotesKeyDown}
          className="text-2xl bg-transparent border-none
                     focus-visible:ring-0 focus-visible:ring-offset-0
                     px-0 h-7 placeholder:text-neutral-400 text-neutral-300"
        />

        {/* Divider */}
        <hr className="border-neutral-600 border-t-[2px]" />

        {/* URL Chips */}
        <div
          className="flex flex-wrap items-center gap-2 min-h-[36px] cursor-text"
          onClick={() => urlInputRef.current?.focus()}
        >
          {urlChips.map((chip) => (
            <span
              key={chip.id}
              className="inline-flex items-center gap-1 px-2 
             bg-neutral-700  
             border-neutral-600 border-2 border-solid
              text-neutral-500 text-2xl
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
                className="text-neutral-400 hover:text-white"
              >
                ×
              </button>
            </span>
          ))}

          <input
            ref={urlInputRef}
            type="text"
            placeholder={urlChips.length === 0 ? "URL" : ""}
            value={urlInput}
            onChange={handleUrlInputChange}
            onKeyDown={handleUrlInputKeyDown}
            className="flex-1 min-w-[80px] bg-transparent
                       text-2xl text-neutral-400
                       placeholder:text-neutral-500
         
              font-semibold
                       focus:outline-none"
          />
        </div>
      </div>
    </div>
  )
}

export default EventEditor
