import React from "react"
import { Circle } from "lucide-react"
import DropdownRow from "./DropdownRow"

interface GoalRowProps {
  value: string
  options: readonly string[]
  onChange: (value: string) => void
}

const GoalRow: React.FC<GoalRowProps> = ({ value, options, onChange }) => (
  <DropdownRow
    icon={<Circle className="w-7 h-7 text-neutral-600 opacity-30" />}
    label="Goal"
    value={value}
    options={options}
    onChange={onChange}
    maxWidth="max-w-[250px]"
    dropdownMinWidth="min-w-[200px]"
  />
)

export default GoalRow
