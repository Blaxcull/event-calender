import React, { useState, useRef, useEffect } from 'react'
import { Repeat, Bell, ChevronsUpDown } from 'lucide-react'
import { useEventsStore, formatDate } from '@/store/eventsStore'
import { useTimeStore } from '@/store/timeStore'

const REPEAT_OPTIONS = ['Never', 'Daily', 'Weekly', 'Monthly', 'Yearly'] as const
type RepeatOption = typeof REPEAT_OPTIONS[number]

const REMINDER_OPTIONS = ['None', '5 minutes before', '15 minutes before', '30 minutes before', '1 hour before', '2 hours before', '1 day before'] as const
type ReminderOption = typeof REMINDER_OPTIONS[number]

const RepeatRow: React.FC<{
  value: RepeatOption
  onChange: (value: RepeatOption) => void
}> = ({ value, onChange }) => {
  const [isOpen, setIsOpen] = useState(false)
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const selectedIndex = REPEAT_OPTIONS.indexOf(value)

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
    if (isOpen && dropdownRef.current) {
      requestAnimationFrame(() => {
        if (dropdownRef.current) {
          const itemHeight = 36
          const scrollPos = Math.max(0, (selectedIndex - 2) * itemHeight)
          dropdownRef.current.scrollTop = scrollPos
        }
      })
    }
  }, [isOpen, selectedIndex])

  const handleSelect = (option: RepeatOption) => {
    onChange(option)
    setIsOpen(false)
    setHoveredIndex(null)
  }

  return (
    <div ref={containerRef} className="relative">
      <div 
        className="flex items-center justify-between py-3 px-4 bg-neutral-600/50 hover:bg-neutral-600 transition-colors cursor-pointer rounded-lg"
        onClick={() => setIsOpen(!isOpen)}
      >
        <div className="flex items-center gap-3">
          <Repeat className="w-5 h-5 text-neutral-400" />
          <span className="text-neutral-100 text-base font-medium">Repeat</span>
        </div>
        
        <div className="flex items-center gap-2">
          <span className="text-neutral-400 text-base">{value}</span>
          <ChevronsUpDown className="w-4 h-4 text-neutral-500" />
        </div>
      </div>

      {isOpen && (
        <div 
          ref={dropdownRef}
          className="absolute right-0 top-full mt-1 z-50 bg-neutral-800 border border-neutral-700 rounded-lg shadow-xl py-1 min-w-[140px] max-h-[200px] overflow-y-auto"
        >
          {REPEAT_OPTIONS.map((option, index) => {
            const isSelected = option === value
            const isHovered = hoveredIndex === index
            const isHighlighted = isHovered || (isSelected && hoveredIndex === null)

            return (
              <button
                key={option}
                type="button"
                onClick={() => handleSelect(option)}
                onMouseEnter={() => setHoveredIndex(index)}
                onMouseLeave={() => setHoveredIndex(null)}
                className={`
                  w-full text-left px-4 py-2 text-sm transition-colors duration-100
                  ${isHighlighted ? 'bg-pink-500 text-white' : 'text-neutral-300'}
                `}
              >
                {option}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

const ReminderRow: React.FC<{
  value: ReminderOption
  onChange: (value: ReminderOption) => void
}> = ({ value, onChange }) => {
  const [isOpen, setIsOpen] = useState(false)
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const selectedIndex = REMINDER_OPTIONS.indexOf(value)

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
    if (isOpen && dropdownRef.current) {
      requestAnimationFrame(() => {
        if (dropdownRef.current) {
          const itemHeight = 36
          const scrollPos = Math.max(0, (selectedIndex - 2) * itemHeight)
          dropdownRef.current.scrollTop = scrollPos
        }
      })
    }
  }, [isOpen, selectedIndex])

  const handleSelect = (option: ReminderOption) => {
    onChange(option)
    setIsOpen(false)
    setHoveredIndex(null)
  }

  return (
    <div ref={containerRef} className="relative">
      <div 
        className="flex items-center justify-between py-3 px-4 bg-neutral-600/50 hover:bg-neutral-600 transition-colors cursor-pointer rounded-lg"
        onClick={() => setIsOpen(!isOpen)}
      >
        <div className="flex items-center gap-3">
          <Bell className="w-5 h-5 text-neutral-400" />
          <span className="text-neutral-100 text-base font-medium">Early Reminder</span>
        </div>
        
        <div className="flex items-center gap-2">
          <span className="text-neutral-400 text-base">{value}</span>
          <ChevronsUpDown className="w-4 h-4 text-neutral-500" />
        </div>
      </div>

      {isOpen && (
        <div 
          ref={dropdownRef}
          className="absolute right-0 top-full mt-1 z-50 bg-neutral-800 border border-neutral-700 rounded-lg shadow-xl py-1 min-w-[180px] max-h-[200px] overflow-y-auto"
        >
          {REMINDER_OPTIONS.map((option, index) => {
            const isSelected = option === value
            const isHovered = hoveredIndex === index
            const isHighlighted = isHovered || (isSelected && hoveredIndex === null)

            return (
              <button
                key={option}
                type="button"
                onClick={() => handleSelect(option)}
                onMouseEnter={() => setHoveredIndex(index)}
                onMouseLeave={() => setHoveredIndex(null)}
                className={`
                  w-full text-left px-4 py-2 text-sm transition-colors duration-100
                  ${isHighlighted ? 'bg-pink-500 text-white' : 'text-neutral-300'}
                `}
              >
                {option}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

const SettingsPanel: React.FC = () => {
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

  if (!selectedEvent) return null

  const repeat = (selectedEvent.repeat as RepeatOption) || 'Never'
  const reminder = (selectedEvent.reminder as ReminderOption) || 'None'

  const handleRepeatChange = (value: RepeatOption) => {
    if (selectedEventId) {
      updateEventField(selectedEventId, 'repeat', value)
    }
  }

  const handleReminderChange = (value: ReminderOption) => {
    if (selectedEventId) {
      updateEventField(selectedEventId, 'reminder', value)
    }
  }

  return (
    <div className="w-full rounded-[34px] p-4 space-y-1">
      <RepeatRow value={repeat} onChange={handleRepeatChange} />
      <ReminderRow value={reminder} onChange={handleReminderChange} />
    </div>
  )
}

export { RepeatRow, ReminderRow, SettingsPanel }
export default SettingsPanel
