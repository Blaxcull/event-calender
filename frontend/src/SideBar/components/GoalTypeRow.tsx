import React, { useState, useRef, useEffect } from "react"
import { ChevronsUpDown, Target, Check } from "lucide-react"

const GOAL_TYPE_OPTIONS = ["None", "Weekly", "Monthly", "Yearly", "Lifetime"] as const

interface GoalTypeRowProps {
  value: string
  onChange: (value: string) => void
}

const GoalTypeRow: React.FC<GoalTypeRowProps> = ({ value, onChange }) => {
  const [isOpen, setIsOpen] = useState(false)
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const validValue = GOAL_TYPE_OPTIONS.includes(value as any) ? value : GOAL_TYPE_OPTIONS[0]
  const selectedIndex = GOAL_TYPE_OPTIONS.indexOf(validValue as any)

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
      <div className="flex items-center justify-between py-1 px-0">
        <div className="flex items-center gap-3">
          <Target className="w-7 h-7 text-neutral-400" />
          <span className="text-neutral-100 pl-2 text-2xl shrink-0">Goal type</span>
        </div>

        <div className="flex items-center gap-4">
          <span className="text-neutral-300 text-2xl">{validValue}</span>
          <button
            type="button"

            onClick={() => setIsOpen(!isOpen)}
            className="p-1 bg-neutral-600  rounded-full transition-colors cursor-pointer hover:bg-neutral-500"
          >
            <ChevronsUpDown className="w-5 h-5 text-neutral-300" />
          </button>
        </div>
      </div>

      {isOpen && (
        <div
          ref={dropdownRef}
          className="absolute px-2 right-0 top-full mr-6 mt-1 z-50 bg-neutral-700 border-2 border-pink-500 rounded-lg shadow-xl py-1 min-w-[140px] max-h-[120px] overflow-y-auto [&::-webkit-scrollbar]:hidden"
        >
          {GOAL_TYPE_OPTIONS.map((option, index) => {
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
                  relative w-full rounded-[10px] flex items-center py-1 px-4 text-xl transition-colors duration-100
                  ${isHighlighted ? "bg-pink-500 text-white" : "text-neutral-300 hover:bg-pink-500"}
                `}
              >
                {isSelected && <Check className="absolute left-2 w-4 h-4 shrink-0" />}
                <span className="pl-8">{option}</span>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

export default GoalTypeRow
