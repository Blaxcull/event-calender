import React from "react"
import { Repeat } from "lucide-react"
import DropdownRow from "./DropdownRow"

const REPEAT_OPTIONS = ["None", "Daily", "Weekly", "Monthly", "Yearly"] as const

interface RepeatRowProps {
  value: string
  onChange: (value: string) => void
}

const RepeatRow: React.FC<RepeatRowProps> = ({ value, onChange }) => (
  <DropdownRow
    icon={<Repeat className="w-7 h-7 text-neutral-600" />}
    label="Repeat"
    value={value}
    options={REPEAT_OPTIONS}
    onChange={onChange}
  />
)

export default RepeatRow
