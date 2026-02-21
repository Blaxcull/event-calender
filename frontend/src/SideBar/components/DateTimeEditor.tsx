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
}

const DatePickerButton: React.FC<DatePickerButtonProps> = ({ value, onChange }) => {
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
      const button = buttonRef.current
      const rect = button.getBoundingClientRect()
      const calendarHeight = 350
      const spaceBelow = window.innerHeight - rect.bottom
      const spaceAbove = rect.top
      setPositionAbove(spaceBelow < calendarHeight && spaceAbove > spaceBelow)
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
        onClick={() => setIsOpen(!isOpen)}
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
        <div className={`absolute z-50 ${positionAbove ? 'bottom-full mb-1' : 'top-full mt-1'} left-1/2 -translate-x-1/2 bg-neutral-800 border-2 border-pink-500 rounded-lg shadow-xl p-2`}>
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

  const handleStartTimeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    if (!selectedEventId) return
    const value = parseInt(e.target.value, 10)
    updateEventField(selectedEventId, 'start_time', value)
  }

  const handleEndTimeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    if (!selectedEventId) return
    const value = parseInt(e.target.value, 10)
    updateEventField(selectedEventId, 'end_time', value)
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
            />
          </div>
        </div>


        <hr className="border-neutral-600 border-t-[2px]" />

        {/* Time Row */}
        <div className="py-2">
          <div className="flex items-center gap-3">
            <Clock className="w-7 h-7 text-neutral-400" />
            <span className="text-neutral-100 text-2xl w-16 pl-3 pr-60  shrink-0">Time</span>
            <select
              value={startTime}
              onChange={handleStartTimeChange}
              disabled={isAllDay}
              className={`bg-neutral-700 rounded px-2 py-1 border-b-2 border-neutral-500 text-neutral-100 text-xl focus:outline-none focus:border-pink-500 ${
                isAllDay ? 'opacity-40 cursor-not-allowed' : ''
              }`}
            >
              {TIME_OPTIONS.map((option) => (
                <option key={option.value} value={option.value} className="bg-neutral-700">
                  {option.label}
                </option>
              ))}
            </select>
            <span className="text-neutral-400">-</span>
            <select
              value={endTime}
              onChange={handleEndTimeChange}
              disabled={isAllDay}
              className={`bg-neutral-700 rounded px-2 py-1 border-b-2 border-neutral-500 text-neutral-100 text-xl focus:outline-none focus:border-pink-500 ${
                isAllDay ? 'opacity-40 cursor-not-allowed' : ''
              }`}
            >
              {TIME_OPTIONS.map((option) => (
                <option key={option.value} value={option.value} className="bg-neutral-700">
                  {option.label}
                </option>
              ))}
            </select>
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
