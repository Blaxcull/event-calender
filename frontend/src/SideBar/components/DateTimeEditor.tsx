import React, { useState, useRef, useEffect, useMemo } from 'react'
import { Calendar as CalendarIcon, Clock } from 'lucide-react'
import { useEventsStore, formatDate } from '@/store/eventsStore'
import { useTimeStore } from '@/store/timeStore'
import { Calendar } from '@/components/ui/calendar'

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
}> = ({ value, onChange, disabled }) => {
  const [isOpen, setIsOpen] = useState(false)
  const [inputValue, setInputValue] = useState(formatTimeValue(value))
  const [hoveredValue, setHoveredValue] = useState<number | null>(null)

  const containerRef = useRef<HTMLDivElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const isInputFocused = useRef(false)

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
  const match = inputValue.match(/^(\d{1,2}):?(\d{0,2})$/)
  if (!match) return null

  const h = parseInt(match[1], 10)
  if (isNaN(h) || h > 23) return null

  const minutePart = match[2] || ""

  // 🔹 If no minutes typed yet
  if (minutePart.length === 0) return null


      // 🔹 If ONE digit minute
if (minutePart.length === 1) {
  const digit = minutePart

  if (digit === "1") return h * 60 + 15
  if (digit === "3") return h * 60 + 30
  if (digit === "4") return h * 60 + 45

  return null
}


  if (minutePart.length === 2) {
    const m = parseInt(minutePart, 10)
    if (isNaN(m) || m > 59) return null

    const total = h * 60 + m
    return total
  }

  return null
}, [inputValue])

  /* Auto scroll to highlighted option */
useEffect(() => {
  if (!isOpen || !dropdownRef.current) return

  const container = dropdownRef.current

  // Parse the hour from the input
  const match = inputValue.match(/^(\d{1,2}):?(\d{0,2})$/)
  if (!match) return

  const hour = parseInt(match[1], 10)
  if (isNaN(hour) || hour < 0 || hour > 23) return

  // Find the first option of that hour
  const index = TIME_OPTIONS.findIndex(
    (opt) => Math.floor(opt.value / 60) === hour
  )
  if (index === -1) return

  const option = container.children[index] as HTMLElement
  if (!option) return

  // 🔹 Instant scroll to the top of this hour block
  container.scrollTop = option.offsetTop
}, [inputValue, isOpen])


const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
  const val = e.target.value.replace(/[^0-9:]/g, '')
  setInputValue(val)
  if (!isOpen && !disabled) setIsOpen(true)
}

  const handleInputBlur = () => {
    const finalValue =
      typedClosest !== null ? typedClosest : value

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
        className={`bg-neutral-700 rounded-lg px-2 py-1 border-b-2 border-neutral-500 text-xl focus:outline-none focus:border-pink-500 w-20 text-center ${
          disabled
            ? 'opacity-40 cursor-not-allowed text-neutral-100'
            : isOpen
            ? 'text-pink-500'
            : 'text-neutral-100'
        }`}
      />

      {isOpen && !disabled && (
        <div
          ref={dropdownRef}
          className="absolute left-1/2 -translate-x-1/2 mt-1 bg-neutral-700 border-2 border-pink-500 rounded-lg shadow-xl p-1 max-h-[220px] overflow-y-auto w-28 z-50 no-scrollbar"
        >

{TIME_OPTIONS.map((option) => {
  const isHovered = hoveredValue === option.value

  const isTypingMatch =
    typedClosest !== null &&
    hoveredValue === null &&
    option.value === typedClosest

  return (
    <button
      key={option.value}
      type="button"
      onMouseDown={(e) => {
        e.preventDefault()
        handleSelect(option.value)
      }}
      onMouseEnter={() => setHoveredValue(option.value)}
      className={`w-full text-center py-2 px-2 rounded text-lg transition-colors duration-100 ${
        isHovered || isTypingMatch
          ? 'bg-pink-500 text-white'
          : 'text-neutral-100'
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

  const selectedDate = value
    ? new Date(value + 'T00:00:00')
    : undefined

  const [month, setMonth] = useState<Date | undefined>(selectedDate)

  useEffect(() => {
    if (isOpen) {
      setMonth(selectedDate)
    }
  }, [isOpen, selectedDate])

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
        onClick={() => setIsOpen(!isOpen)}
        className="bg-neutral-700 hover:bg-neutral-600 rounded px-2 py-1.5 text-neutral-100 text-lg focus:outline-none ring-2 ring-neutral-500 focus:ring-pink-500"
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
          className={`absolute z-50 mt-1 bg-neutral-800 border-2 border-pink-500 rounded-lg shadow-xl p-2 ${
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
            className="bg-neutral-800 text-white rounded-md"
          />
        </div>
      )}
    </div>
  )
}

/* ================= MAIN EDITOR ================= */

const DateTimeEditor: React.FC = () => {
  const selectedEventId = useEventsStore(
    (state) => state.selectedEventId
  )
  const eventsCache = useEventsStore(
    (state) => state.eventsCache
  )
  const updateEventField = useEventsStore(
    (state) => state.updateEventField
  )
  const selectedDate = useTimeStore(
    (state) => state.selectedDate
  )

  const selectedEvent = useMemo(() => {
    if (!selectedEventId || !selectedDate) return null
    const dateKey = formatDate(selectedDate)
    const events = eventsCache[dateKey] || []
    return events.find((e) => e.id === selectedEventId)
  }, [selectedEventId, eventsCache, selectedDate])

  if (!selectedEvent) return null

  const isAllDay = selectedEvent.is_all_day || false

  const toggleAllDay = () => {
    updateEventField(selectedEvent.id, 'is_all_day', !isAllDay)
  }

  return (
    <div className="border border-neutral-800 w-full border-20 bg-neutral-700 rounded-[34px] p-4 space-y-3">
      <div className="flex items-center gap-3">
        <CalendarIcon className="w-7 h-7 text-neutral-400" />
        <span className="text-neutral-100 text-2xl w-16 pr-55 shrink-0">
          Date
        </span>
        <DatePickerButton
          value={selectedEvent.date}
          onChange={(date) => {
            const newDate = formatDate(date)
            updateEventField(selectedEvent.id, 'date', newDate)
            updateEventField(selectedEvent.id, 'end_date', newDate)
          }}
        />
        <span className="text-neutral-400">-</span>
        <DatePickerButton
          value={selectedEvent.end_date || selectedEvent.date}
          onChange={(date) =>
            updateEventField(
              selectedEvent.id,
              'end_date',
              formatDate(date)
            )
          }
          alignRight
        />
      </div>

      <hr className="border-neutral-600 border-t-[2px]" />

      <div className="flex items-center gap-3">
        <Clock className="w-7 h-7 text-neutral-400" />
        <span className="text-neutral-100 text-2xl w-16 pr-64 shrink-0">
          Time
        </span>
        <TimePicker
          value={selectedEvent.start_time}
          onChange={(mins) =>
            updateEventField(
              selectedEvent.id,
              'start_time',
              mins
            )
          }
          disabled={isAllDay}
        />
        <span className="text-neutral-400">-</span>
        <TimePicker
          value={selectedEvent.end_time}
          onChange={(mins) =>
            updateEventField(
              selectedEvent.id,
              'end_time',
              mins
            )
          }
          disabled={isAllDay}
        />
      </div>

      <hr className="border-neutral-600 border-t-[2px]" />

      <div className="flex items-center justify-between">
        <span className="text-neutral-100 text-2xl">All Day</span>
        <button
          type="button"
          onClick={toggleAllDay}
          className={`w-12 h-6 rounded-full transition-colors relative ${
            isAllDay ? 'bg-pink-500' : 'bg-neutral-600'
          }`}
        >
          <span
            className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${
              isAllDay ? 'left-7' : 'left-1'
            }`}
          />
        </button>
      </div>
    </div>
  )
}

export default DateTimeEditor
