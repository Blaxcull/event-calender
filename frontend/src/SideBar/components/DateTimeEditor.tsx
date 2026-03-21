import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react'
import { useEventsStore, formatDate, type NewEvent, type EventFieldValue, type CalendarEvent } from '@/store/eventsStore'
import { Calendar } from '@/components/ui/calendar'
import RecurringActionDialog from '@/components/RecurringActionDialog'

/* ================= TIME OPTIONS ================= */

const TIME_OPTIONS: { value: number; label: string }[] = []

for (let hour = 0; hour < 24; hour++) {
  for (let min = 0; min < 60; min += 15) {
    TIME_OPTIONS.push({
      value: hour * 60 + min,
      label: `${hour.toString().padStart(2, '0')}:${min
        .toString()
        .padStart(2, '0')}`,
    })
  }
}

const formatTimeValue = (minutes: number) => {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return `${h.toString().padStart(2, '0')}:${m
    .toString()
    .padStart(2, '0')}`
}

const getClosestTimeOption = (minutes: number) => {
  return TIME_OPTIONS.reduce((prev, curr) =>
    Math.abs(curr.value - minutes) < Math.abs(prev.value - minutes)
      ? curr
      : prev
  ).value
}

/* ================= TIME PICKER ================= */

const TimePicker: React.FC<{
  value: number
  onChange: (minutes: number) => void
  disabled?: boolean
  minValue?: number
}> = ({ value, onChange, disabled, minValue }) => {

  const [isOpen, setIsOpen] = useState(false)
  const [inputValue, setInputValue] = useState(formatTimeValue(value))
  const [hoveredValue, setHoveredValue] = useState<number | null>(null)
  const [debouncedInput, setDebouncedInput] = useState(inputValue)

  const containerRef = useRef<HTMLDivElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const isInputFocused = useRef(false)



  useEffect(() => {
  const t = setTimeout(() => {
    setDebouncedInput(inputValue)
  }, 60)

  return () => clearTimeout(t)
}, [inputValue])


  /* Sync external value */
  useEffect(() => {
    setInputValue(formatTimeValue(value))
  }, [value])

  /* Close on outside click */
  useEffect(() => {
  if (isOpen) {
    setHoveredValue(null)
  }
}, [isOpen])
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false)
        isInputFocused.current = false
      }
    }

    if (isOpen) {
      document.addEventListener('mouseup', handleClickOutside)
    }

    return () =>
      document.removeEventListener('mouseup', handleClickOutside)
  }, [isOpen])

  /* 🔥 Smart closest match while typing */

  const roundedValue = useMemo(() => {
  return getClosestTimeOption(value)
}, [value])



const typedClosest = useMemo(() => {
    const match = debouncedInput.match(/^(\d{1,2}):?(\d{0,2})$/)
  if (!match) return null

  let h = parseInt(match[1], 10)
  if (isNaN(h)) return null

  // 🔹 Clamp hour
  if (h > 23) h = 23
  if (h < 0) h = 0

  const minutePart = match[2] || ""

  // 🔹 No minutes typed
  if (minutePart.length === 0) {
    return h * 60
  }

  // 🔹 ONE digit minute snapping
  if (minutePart.length === 1) {
    const digit = minutePart

    if (digit === "0") return h * 60 
    if (digit === "1") return h * 60 + 15
    if (digit === "3") return h * 60 + 30
    if (digit === "4") return h * 60 + 45

    return null
  }

  // 🔹 TWO digit minutes
  if (minutePart.length === 2) {
    let m = parseInt(minutePart, 10)
    if (isNaN(m)) return null

    // Clamp minute
    if (m > 59) m = 59
    if (m < 0) m = 0

    return h * 60 + m
  }

  return null
}, [debouncedInput])



useEffect(() => {
  if (!isOpen) {
    setHoveredValue(null)
  }
}, [isOpen])

  /* Auto scroll to highlighted option */
useEffect(() => {
  if (!isOpen || !dropdownRef.current) return

  const container = dropdownRef.current

  const targetValue =
  typedClosest !== null &&
  TIME_OPTIONS.some(o => o.value === typedClosest)
    ? typedClosest
    : roundedValue

  const index = TIME_OPTIONS.findIndex(
    (opt) => opt.value === targetValue
  )

  if (index === -1) return

  requestAnimationFrame(() => {
    const option = container.children[index] as HTMLElement
    if (!option) return

    const containerHeight = container.clientHeight
    const optionHeight = option.clientHeight

    let scroll =
      option.offsetTop - containerHeight / 2 + optionHeight / 2

    const maxScroll = container.scrollHeight - containerHeight
    scroll = Math.max(0, Math.min(scroll, maxScroll))

    container.scrollTop = scroll
  })
}, [isOpen, typedClosest, roundedValue])

const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
  const val = e.target.value.replace(/[^0-9:]/g, '')
  setInputValue(val)
  if (!isOpen && !disabled) setIsOpen(true)
}

  const handleInputBlur = () => {
      let finalValue =
  typedClosest !== null ? typedClosest : value

if (minValue !== undefined && finalValue < minValue) {
  finalValue = minValue
}

    onChange(finalValue)
    setInputValue(formatTimeValue(finalValue))
    setIsOpen(false)
  }

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      const finalValue =
        typedClosest !== null ? typedClosest : value

      onChange(finalValue)
      setInputValue(formatTimeValue(finalValue))
      setIsOpen(false)
      ;(e.target as HTMLInputElement).blur()
    }
  }

const handleSelect = (minutes: number) => {
  if (minValue !== undefined && minutes < minValue) return

  onChange(minutes)
  setInputValue(formatTimeValue(minutes))
  setIsOpen(false)
}
  return (
    <div ref={containerRef} className="relative">
      <input
        ref={inputRef}
        type="text"
        value={inputValue}
        onChange={handleInputChange}
        onBlur={handleInputBlur}
        onKeyDown={handleInputKeyDown}
        onFocus={() => {
          isInputFocused.current = true
          !disabled && setIsOpen(true)
        }}
        disabled={disabled}
        className={`bg-neutral-100 rounded-lg px-2 py-1 border-b-2 border-neutral-300 text-xl focus:outline-none focus:border-red-500 w-20 text-center ${
          disabled
            ? 'opacity-40 cursor-not-allowed text-neutral-800'
            : isOpen
            ? 'text-red-500'
            : 'text-neutral-800'
        }`}
      />

      {isOpen && !disabled && (
        <div
          ref={dropdownRef}
          className="absolute left-1/2 -translate-x-1/2 mt-1 bg-[#f6f6f6] shadow rounded-lg shadow-xl p-1 max-h-[220px] overflow-y-auto w-28 z-50 no-scrollbar"
        >

{TIME_OPTIONS.map((option) => {
  const isDisabled =
    minValue !== undefined && option.value < minValue

  const isHovered = hoveredValue === option.value

  const isTypingMatch =
  hoveredValue === null &&
  typedClosest !== null &&
  TIME_OPTIONS.some(o => o.value === typedClosest) &&
  option.value === typedClosest

  return (
    <button
      key={option.value}
      type="button"
      disabled={isDisabled}
      onMouseDown={(e) => {
        e.preventDefault()
        handleSelect(option.value)
      }}
      onMouseEnter={() => !isDisabled && setHoveredValue(option.value)}
      className={`w-full text-center py-2 px-2 rounded text-lg transition-colors duration-100
        ${
          isDisabled
            ? "text-neutral-400 cursor-not-allowed"
            : isHovered || isTypingMatch
            ? "bg-red-400 text-white"
            : "text-neutral-800"
        }`}
    >
      {option.label}
    </button>
  )
})}
        </div>
      )}
    </div>
  )
}

/* ================= DATE PICKER ================= */

const DatePickerButton: React.FC<{
  value: string
  onChange: (date: Date) => void
  alignRight?: boolean
}> = ({ value, onChange, alignRight = false }) => {
  const [isOpen, setIsOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  const selectedDate = useMemo(() => {
    return value ? new Date(value + 'T00:00:00') : undefined
  }, [value])

  const [month, setMonth] = useState<Date | undefined>(() => selectedDate)

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false)
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () =>
      document.removeEventListener(
        'mousedown',
        handleClickOutside
      )
  }, [isOpen])

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => {
          if (!isOpen && selectedDate) {
            setMonth(selectedDate)
          }
          setIsOpen(!isOpen)
        }}
        className="bg-neutral-100 hover:bg-neutral-200 rounded px-2 py-1.5 text-neutral-800 text-lg focus:outline-none ring-2 ring-neutral-400 focus:ring-red-500"
      >
        {selectedDate
          ? selectedDate.toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
              year: 'numeric',
            })
          : 'Select date'}
      </button>

      {isOpen && (
        <div
          className={`absolute z-50 mt-1 bg-[#f6f6f6] shadow  rounded-lg  p-2 ${
            alignRight
              ? 'right-0'
              : 'left-1/2 -translate-x-1/2'
          }`}
        >
          <Calendar
            mode="single"
            selected={selectedDate}
            month={month}
            onMonthChange={setMonth}
            onSelect={(date) => {
              if (date) {
                onChange(date)
                setIsOpen(false)
              }
            }}
            className="bg-[#f6f6f6] text-black rounded-md"
          />

        </div>
      )}
    </div>
  )
}

/* ================= MAIN EDITOR ================= */

const DateTimeEditor: React.FC = () => {
  const selectedEventId = useEventsStore((state) => state.selectedEventId)
  const updateEventField = useEventsStore((state) => state.updateEventField)
  const showRecurringDialog = useEventsStore((state) => state.showRecurringDialog)
  const recurringDialogOpen = useEventsStore((state) => state.recurringDialogOpen)
  const recurringDialogEvent = useEventsStore((state) => state.recurringDialogEvent)
  const recurringDialogActionType = useEventsStore((state) => state.recurringDialogActionType)
  const closeRecurringDialog = useEventsStore((state) => state.closeRecurringDialog)

  // Subscribe to cache changes and trigger re-render
  const [, setEventVersion] = useState(0)
  const getEventById = useEventsStore((state) => state.getEventById)
  
  // Subscribe to cache changes
  useEffect(() => {
    const unsubscribe = useEventsStore.subscribe(
      () => {
        setEventVersion(v => v + 1)
      }
    )
    return unsubscribe
  }, [])

  // Get the selected event
  const selectedEvent = selectedEventId ? getEventById(selectedEventId) : null

  // Check if this is a recurring event INSTANCE (not the base master event)
  // Only show dialog for virtual instances (isRecurringInstance = true)
  // Don't show dialog for base recurring events (they have repeat but isRecurringInstance is false)
  const isRecurring = selectedEvent && 
                      !selectedEvent.isTemp &&
                      selectedEvent.title !== "New Event" &&
                      selectedEvent.isRecurringInstance === true

  const handlePropertyChange = useCallback((field: keyof NewEvent, value: EventFieldValue, extraFields?: Partial<Record<keyof NewEvent, EventFieldValue>>) => {
    if (!selectedEvent || !selectedEventId) return

    if (isRecurring) {
      // Capture values at this moment
      const eventId = selectedEvent.id

      showRecurringDialog(
        selectedEvent as CalendarEvent,
        "edit",
        async (choice: string) => {
          if (choice === "only-this") {
            // Use splitRecurringEvent to split the series
            const splitRecurringEvent = useEventsStore.getState().splitRecurringEvent
            
            // Build updates object with current field and any extra fields
            const updates: Record<string, EventFieldValue> = {}
            if (field && value !== undefined) {
              updates[field] = value
            }
            if (extraFields) {
              Object.entries(extraFields).forEach(([key, val]) => {
                if (val !== undefined) {
                  updates[key] = val
                }
              })
            }
            
            await splitRecurringEvent(
              selectedEvent as any,
              selectedEvent.date,
              selectedEvent.start_time,
              selectedEvent.end_time,
              updates as any
            )
          } else if (choice === "all-events") {
            const updateAllInSeries = useEventsStore.getState().updateAllInSeries
            const seriesMasterId = (selectedEvent as any).seriesMasterId || eventId
            
            const allUpdates: Record<string, EventFieldValue> = {}
            if (field && value !== undefined) {
              allUpdates[field] = value
            }
            if (extraFields) {
              Object.entries(extraFields).forEach(([key, val]) => {
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

  if (!selectedEvent) return null

  const isAllDay = selectedEvent.is_all_day || false

  return (
    <>
      <div className="shadow-lg border border-neutral-100 w-full bg-[#ececec] rounded-[52px] pl-5 pr-6 py-6 border-20 space-y-3 shadow-none">
        <div className="flex items-center gap-3">
          <img src="/src/assets/calendar2.png" alt="Calendar" className="w-7 h-7 opacity-30" />
          <span className="text-neutral-800 text-2xl w-16 pl-2 pr-55 shrink-0">
            Date
          </span>
          <DatePickerButton
            value={selectedEvent.date}
            onChange={(date) => {
              const newDate = formatDate(date)
              handlePropertyChange('date', newDate, { end_date: newDate })
            }}
          />
          <span className="text-neutral-600">-</span>
          <DatePickerButton
            value={selectedEvent.end_date || selectedEvent.date}
            onChange={(date) => {
              const newDate = formatDate(date)
              handlePropertyChange('end_date', newDate)
            }}
            alignRight
          />
        </div>

        <hr className="border-neutral-200 border-t-[3px]" />
        <div className="flex items-center gap-3">
          <img src="/src/assets/clock.png" alt="Clock" className="w-7 h-7 opacity-30" />
          <span className="text-neutral-800 text-2xl w-16 pl-2 pr-61 shrink-0">
            Time
          </span>
          <TimePicker
            value={selectedEvent.start_time}
            onChange={(mins) => {
              handlePropertyChange('start_time', mins)
            }}
            disabled={isAllDay}
          />
          <span className="text-neutral-600">-</span>
          <TimePicker
            value={selectedEvent.end_time}
            onChange={(mins) => {
              handlePropertyChange('end_time', mins)
            }}
            disabled={isAllDay}
            minValue={selectedEvent.start_time}
          />
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

export default DateTimeEditor
