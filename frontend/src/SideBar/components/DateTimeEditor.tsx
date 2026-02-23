import React, { useState, useRef, useEffect } from 'react'
import { Calendar as CalendarIcon, Clock } from 'lucide-react'
import { useEventsStore, formatDate } from '@/store/eventsStore'
import { useTimeStore } from '@/store/timeStore'
import { Calendar } from '@/components/ui/calendar'

const TIME_OPTIONS: { value: number; label: string }[] = []
for (let hour = 0; hour < 24; hour++) {
  for (let min = 0; min < 60; min += 15) {
    TIME_OPTIONS.push({
      value: hour * 60 + min,
      label: `${hour.toString().padStart(2, '0')}:${min.toString().padStart(2, '0')}`,
    })
  }
}

interface DatePickerButtonProps {
  value: string
  onChange: (date: Date) => void
  alignRight?: boolean
}

const getClosestTimeOption = (minutes: number): number => {
  const closest = TIME_OPTIONS.reduce((prev, curr) => 
    Math.abs(curr.value - minutes) < Math.abs(prev.value - minutes) ? curr : prev
  )
  return closest.value
}

const formatTimeValue = (minutes: number): string => {
  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60
  return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`
}

const getCenteredTimeOptions = (_currentValue: number, filterValue: string): { value: number; label: string }[] => {
  if (filterValue) {
    return TIME_OPTIONS.filter(opt => opt.label.includes(filterValue))
  }
  
  return TIME_OPTIONS
}

const TimePicker: React.FC<{
  value: number
  onChange: (minutes: number) => void
  disabled?: boolean
}> = ({ value, onChange, disabled }) => {
  const [isOpen, setIsOpen] = useState(false)
  const [inputValue, setInputValue] = useState(formatTimeValue(value))
  const [filterValue, setFilterValue] = useState('')
  const [hoveredValue, setHoveredValue] = useState<number | null>(null)
  const [dropdownStyle, setDropdownStyle] = useState<React.CSSProperties>({
    position: 'fixed',
    top: 0,
    left: 0,
    zIndex: 9999,
    visibility: 'hidden',
  })
  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const optionHeight = 40

  const displayedOptions = getCenteredTimeOptions(value, filterValue)

  useEffect(() => {
    setInputValue(formatTimeValue(value))
  }, [value])

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false)
        setFilterValue('')
        setHoveredValue(null)
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen])

  useEffect(() => {
    if (isOpen && inputRef.current) {
      setHoveredValue(null)
      const input = inputRef.current
      const rect = input.getBoundingClientRect()
      setDropdownStyle({
        position: 'fixed',
        top: rect.bottom + 4,
        left: rect.left,
        zIndex: 9999,
        visibility: 'visible',
      })
    } else if (!isOpen) {
      setDropdownStyle(prev => ({ ...prev, visibility: 'hidden' }))
    }
  }, [isOpen])

  useEffect(() => {
    if (isOpen && dropdownRef.current && !filterValue) {
      setTimeout(() => {
        if (dropdownRef.current) {
          const currentIndex = TIME_OPTIONS.findIndex(opt => opt.value === value)
          const scrollIndex = Math.max(0, currentIndex - 4)

const scrollPos = scrollIndex * optionHeight
          dropdownRef.current.scrollTop = scrollPos
        }
      }, 0)
    }
  }, [isOpen, value, filterValue])

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.replace(/[^0-9:]/g, '')
    setInputValue(val)
    setFilterValue(val)
  }

  const handleInputBlur = () => {
    const match = inputValue.match(/^(\d{1,2}):(\d{2})$/)
    if (match) {
      const hours = parseInt(match[1], 10)
      const mins = parseInt(match[2], 10)
      if (hours >= 0 && hours < 24 && mins >= 0 && mins < 60) {
        const totalMins = hours * 60 + mins
        onChange(getClosestTimeOption(totalMins))
        return
      }
    }
    setInputValue(formatTimeValue(value))
  }

  const handleSelect = (minutes: number) => {
    onChange(minutes)
    setInputValue(formatTimeValue(minutes))
    setIsOpen(false)
    setFilterValue('')
  }

  const handleInputFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    e.target.select()
    if (!disabled) {
      setIsOpen(true)
    }
  }

  return (
    <div ref={containerRef} className="relative">
      <input
        type="text"
        ref={inputRef}
        value={inputValue}
        onChange={handleInputChange}
        onBlur={handleInputBlur}
        onFocus={handleInputFocus}
        disabled={disabled}
        className={`bg-neutral-700 rounded-lg px-2 py-1 border-b-2 border-neutral-500 text-neutral-100 text-xl focus:outline-none focus:border-pink-500 w-20 text-center ${
          disabled ? 'opacity-40 cursor-not-allowed' : ''
        }`}
      />
      {isOpen && !disabled && (
        <div 
          ref={dropdownRef} 
          style={dropdownStyle} 
          className="bg-neutral-700 border-2 border-pink-500 rounded-lg shadow-xl p-1 max-h-[200px] overflow-y-auto w-28 no-scrollbar"
          onMouseLeave={() => {}}
        >
          {displayedOptions.map((option) => (
            <button
              type="button"
              tabIndex={-1}
              key={option.value}
              onClick={() => handleSelect(option.value)}
              onMouseEnter={() => setHoveredValue(option.value)}
              className={`w-full text-center py-1 px-2 text-neutral-100 rounded text-xl focus:outline-none ${
                hoveredValue !== null 
                  ? (hoveredValue === option.value ? 'bg-pink-500' : '')
                  : (option.value === value ? 'bg-pink-500' : '')
              } hover:bg-pink-500`}
            >
              {option.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

const DatePickerButton: React.FC<DatePickerButtonProps> = ({ value, onChange, alignRight = false }) => {
  const [isOpen, setIsOpen] = useState(false)
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(
    value ? new Date(value + 'T00:00:00') : undefined
  )
  const [positionAbove, setPositionAbove] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen])

  useEffect(() => {
    if (value) {
      setSelectedDate(new Date(value + 'T00:00:00'))
    }
  }, [value])

  useEffect(() => {
    if (isOpen && buttonRef.current) {
      setPositionAbove(false)
    }
  }, [isOpen])

  const handleSelect = (date: Date | undefined) => {
    if (date) {
      setSelectedDate(date)
      onChange(date)
      setIsOpen(false)
    }
  }

  const displayValue = value 
    ? new Date(value + 'T00:00:00').toLocaleDateString('en-US', { 
        month: 'short', 
        day: 'numeric', 
        year: 'numeric' 
      })
    : 'Select date'

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        ref={buttonRef}
        onClick={(e) => {
          e.preventDefault()
          e.stopPropagation()
          setIsOpen(!isOpen)
        }}
className="
bg-neutral-700 hover:bg-neutral-600
rounded px-4 py-1.5 
text-neutral-100 text-lg
focus:outline-none
ring-2 ring-neutral-500
focus:ring-2 focus:ring-pink-500
"      >
        {displayValue}
      </button>

      {isOpen && (
        <div className={`absolute z-50 ${positionAbove ? 'bottom-full mb-1' : 'top-full mt-1'} ${alignRight ? 'right-0' : 'left-1/2 -translate-x-1/2'} bg-neutral-800 border-2 border-pink-500 rounded-lg shadow-xl p-2`}>
          <Calendar
            mode="single"
            selected={selectedDate}
            onSelect={handleSelect}
            className="bg-neutral-800 text-white rounded-md"
          />
        </div>
      )}
    </div>
  )
}

const DateTimeEditor: React.FC = () => {
  const selectedEventId = useEventsStore((state) => state.selectedEventId)
  const eventsCache = useEventsStore((state) => state.eventsCache)
  const updateEventField = useEventsStore((state) => state.updateEventField)
  const selectedDate = useTimeStore((state) => state.selectedDate)

  const selectedEvent = React.useMemo(() => {
    if (!selectedEventId || !selectedDate) return null
    const dateKey = formatDate(selectedDate)
    const events = eventsCache[dateKey] || []
    return events.find(e => e.id === selectedEventId)
  }, [selectedEventId, eventsCache, selectedDate])

  const isAllDay = selectedEvent ? (selectedEvent.is_all_day || false) : false
  const startTime = selectedEvent ? selectedEvent.start_time : 0
  const endTime = selectedEvent ? selectedEvent.end_time : 60

  const handleStartDateChange = (date: Date) => {
    if (!selectedEventId) return
    const dateStr = formatDate(date)
    updateEventField(selectedEventId, 'date', dateStr)
    
    const currentEndDate = selectedEvent?.end_date || selectedEvent?.date
    if (currentEndDate && dateStr > currentEndDate) {
      updateEventField(selectedEventId, 'end_date', dateStr)
    }
  }

  const handleEndDateChange = (date: Date) => {
    if (!selectedEventId) return
    const dateStr = formatDate(date)
    updateEventField(selectedEventId, 'end_date', dateStr)
  }

  const handleAllDayChange = (checked: boolean) => {
    if (!selectedEventId) return
    updateEventField(selectedEventId, 'is_all_day', checked)
  }

  const [timeInterval, setTimeInterval] = useState(60)

  React.useEffect(() => {
    if (selectedEvent) {
      setTimeInterval(selectedEvent.end_time - selectedEvent.start_time)
    }
  }, [selectedEvent?.start_time, selectedEvent?.end_time])

  const handleStartTimeChange = (minutes: number) => {
    if (!selectedEventId) return
    const newEndTime = minutes + timeInterval
    updateEventField(selectedEventId, 'start_time', minutes)
    if (newEndTime < 24 * 60) {
      updateEventField(selectedEventId, 'end_time', newEndTime)
    }
  }

  const handleEndTimeChange = (minutes: number) => {
    if (!selectedEventId) return
    updateEventField(selectedEventId, 'end_time', minutes)
  }

  if (!selectedEvent) {
    return null
  }

  return (
      <div className="
shadow-lg border border-neutral-800
      w-full bg-neutral-700 rounded-[34px] p-4 border-20  space-y-3 shadow-none">
        {/* Date Row */}
        <div className="py-2">
          <div className="flex items-center gap-3">
            <CalendarIcon className="w-7 h-7 text-neutral-400" />
            <span className="text-neutral-100 text-2xl w-16 pl-3 pr-50 shrink-0">Date</span>
            <DatePickerButton
              value={selectedEvent.date}
              onChange={handleStartDateChange}
            />
            <span className="text-neutral-400">-</span>
            <DatePickerButton
              value={selectedEvent.end_date || selectedEvent.date}
              onChange={handleEndDateChange}
              alignRight
            />
          </div>
        </div>


        <hr className="border-neutral-600 border-t-[2px]" />

        {/* Time Row */}
        <div className="py-2">
          <div className="flex items-center gap-3">
            <Clock className="w-7 h-7 text-neutral-400" />
            <span className="text-neutral-100 text-2xl w-16 pl-3 pr-60  shrink-0">Time</span>
            <TimePicker
              value={startTime}
              onChange={handleStartTimeChange}
              disabled={isAllDay}
            />
            <span className="text-neutral-400">-</span>
            <TimePicker
              value={endTime}
              onChange={handleEndTimeChange}
              disabled={isAllDay}
            />
          </div>
        </div>

        <hr className="border-neutral-600 border-t-[2px]" />

        {/* All Day Row */}
        <div className="py-2">
          <div className="flex items-center gap-2">
            <span className="text-neutral-100 text-lg w-16  shrink-0">All day</span>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={isAllDay}
                onChange={(e) => handleAllDayChange(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-neutral-600 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-pink-500 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-pink-500"></div>
            </label>
          </div>
        </div>
      </div>
  )
}

export default DateTimeEditor
