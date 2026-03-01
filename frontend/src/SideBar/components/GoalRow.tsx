import React, { useState, useRef, useEffect } from "react"
import { ChevronsUpDown, Circle } from "lucide-react"

const GOAL_OPTIONS = ["dummy"] as const

interface GoalRowProps {
  value: string
  onChange: (value: string) => void
}

const GoalRow: React.FC<GoalRowProps> = ({ value, onChange }) => {
  const [isOpen, setIsOpen] = useState(false)
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const validValue = GOAL_OPTIONS.includes(value as any) ? value : GOAL_OPTIONS[0]
  const selectedIndex = GOAL_OPTIONS.indexOf(validValue as any)

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside)
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside)
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

  const handleSelect = (option: string) => {
    onChange(option)
    setIsOpen(false)
    setHoveredIndex(null)
  }

  return (
    <div ref={containerRef} className="relative">
      <div
        className="flex items-center justify-between py-1 px-0 transition-colors cursor-pointer rounded-lg"
        onClick={() => setIsOpen(!isOpen)}
      >
        <div className="flex items-center gap-3">
          <Circle className="w-7 h-7 text-neutral-400" />
          <span className="text-neutral-100 pl-2 text-2xl w-24 shrink-0">Goal</span>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-neutral-400 text-xl">{validValue}</span>
          <ChevronsUpDown className="w-4 h-4 text-neutral-500" />
        </div>
      </div>

      {isOpen && (
        <div
          ref={dropdownRef}
          className="absolute right-0 top-full mt-1 z-50 bg-neutral-700 border-2 border-pink-500 rounded-lg shadow-xl py-1 min-w-[180px] max-h-[200px] overflow-y-auto"
        >
          {GOAL_OPTIONS.map((option, index) => {
            const isSelected = option === validValue
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
                  w-full text-center py-2 px-4 text-xl transition-colors duration-100
                  ${isHighlighted ? "bg-pink-500 text-white" : "text-neutral-300 hover:bg-pink-500"}
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

export default GoalRow
