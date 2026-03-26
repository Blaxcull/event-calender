import React from "react"
import { Target } from "lucide-react"
import DropdownRow from "./DropdownRow"

const GOAL_TYPE_OPTIONS = ["None", "Weekly", "Monthly", "Yearly", "Lifetime"] as const

interface GoalTypeRowProps {
  value: string
  onChange: (value: string) => void
}

const GoalTypeRow: React.FC<GoalTypeRowProps> = ({ value, onChange }) => (
  <DropdownRow
    icon={<Target className="w-7 h-7 text-neutral-600" />}
    label="Goal Type"
    value={value}
    options={GOAL_TYPE_OPTIONS}
    onChange={onChange}
  />
)

export default GoalTypeRow
