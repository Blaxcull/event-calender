import React, { useState, useRef, useEffect } from "react"
import { ChevronsUpDown, Repeat, Check } from "lucide-react"

const REPEAT_OPTIONS = ["None", "Daily", "Weekly", "Monthly", "Yearly"] as const

interface RepeatRowProps {
  value: string
  onChange: (value: string) => void
}

const RepeatRow: React.FC<RepeatRowProps> = ({ value, onChange }) => {
  const [isOpen, setIsOpen] = useState(false)
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const validValue = REPEAT_OPTIONS.includes(value as typeof REPEAT_OPTIONS[number]) ? value : REPEAT_OPTIONS[0]
  const selectedIndex = REPEAT_OPTIONS.indexOf(validValue as typeof REPEAT_OPTIONS[number])

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
          <Repeat className="w-7 h-7 text-neutral-600" />
          <span className="text-neutral-800 pl-2 text-2xl shrink-0">Repeat</span>
        </div>

        <div className="flex items-center gap-4">
          <span className="text-neutral-700 text-2xl">{validValue}</span>
          <button
            type="button"
            onClick={() => setIsOpen(!isOpen)}
            className="p-1 bg-neutral-300  rounded-full transition-colors cursor-pointer hover:bg-neutral-500"
          >
            <ChevronsUpDown className="w-5 h-5 text-neutral-700" />
          </button>
        </div>
      </div>

      {isOpen && (
        <div
          ref={dropdownRef}
          className="absolute px-2 right-0 top-full mr-0 mt-1 z-50  bg-[#f6f6f6] rounded-lg shadow-xl py-1 min-w-[140px] max-h-[120px] overflow-y-auto [&::-webkit-scrollbar]:hidden"
        >
          {REPEAT_OPTIONS.map((option, index) => {
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
                  relative w-60 rounded-[10px] flex items-center py-1 px-4 text-xl transition-colors duration-100
                  ${isSelected ? "bg-red-500 text-white font-medium" : isHighlighted ? "bg-red-400 text-white" : "text-neutral-700 hover:bg-red-400"}
                `}
              >
                {isSelected && <Check className="absolute left-2 w-4 h-4 shrink-0" />}
                <span className="pl-4">{option}</span>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

export default RepeatRow
