import React from "react"
import { Circle } from "lucide-react"
import DropdownRow from "./DropdownRow"

const GOAL_OPTIONS = [
  "None",
  "Hello",
  "Improve time management and prioritization skills",
  "Spend less time on social media and distractions",
] as const

interface GoalRowProps {
  value: string
  onChange: (value: string) => void
}

const GoalRow: React.FC<GoalRowProps> = ({ value, onChange }) => (
  <DropdownRow
    icon={<Circle className="w-7 h-7 text-neutral-600" />}
    label="Goal"
    value={value}
    options={GOAL_OPTIONS}
    onChange={onChange}
    maxWidth="max-w-[250px]"
    dropdownMinWidth="min-w-[200px]"
  />
)

export default GoalRow
