import { useState } from "react"

export default function ReminderForm() {
  const [dateEnabled, setDateEnabled] = useState(true)
  const [timeEnabled, setTimeEnabled] = useState(true)

  return (
    <div className="w-full bg-neutral-600 rounded-3xl shadow p-4 space-y-4">
      <div>
        <h2 className="text-xl font-semibold">Pick up groceries</h2>
        <input
          placeholder="Notes"
          className="w-full mt-2 text-sm border-b outline-none"
        />
        <input
          placeholder="URL"
          className="w-full mt-2 text-sm border-b outline-none"
        />
      </div>

      <div className="pt-2">
        <p className="text-xs font-medium text-gray-500 mb-2">Date & Time</p>

        <div className="flex items-center justify-between py-2">
          <div>
            <p className="text-sm font-medium">Date</p>
            <p className="text-xs text-gray-500">Tuesday, April 1, 2025</p>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              className="sr-only peer"
              checked={dateEnabled}
              onChange={() => setDateEnabled(!dateEnabled)}
            />
            <div className="w-11 h-6 bg-gray-300 rounded-full peer peer-checked:bg-red-500 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:h-5 after:w-5 after:rounded-full after:transition-all peer-checked:after:translate-x-full" />
          </label>
        </div>

        <div className="flex items-center justify-between py-2">
          <div>
            <p className="text-sm font-medium">Time</p>
            <p className="text-xs text-gray-500">1:30 PM</p>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              className="sr-only peer"
              checked={timeEnabled}
              onChange={() => setTimeEnabled(!timeEnabled)}
            />
            <div className="w-11 h-6 bg-gray-300 rounded-full peer peer-checked:bg-red-500 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:h-5 after:w-5 after:rounded-full after:transition-all peer-checked:after:translate-x-full" />
          </label>
        </div>
      </div>

      <div className="border-t pt-3 space-y-2">
        <Row label="Repeat" value="Never" />
        <Row label="Early Reminder" value="None" />
      </div>

      <div className="border-t pt-3">
        <p className="text-xs font-medium text-gray-500">Organization</p>
        <Row label="List" value="Reminders" />
      </div>
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between items-center py-2">
      <span className="text-sm">{label}</span>
      <span className="text-sm text-gray-500">{value}</span>
    </div>
  )
}
