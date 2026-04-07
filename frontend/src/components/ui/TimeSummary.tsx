"use client"

import { useState, useEffect } from "react"

type Session = {
  id: number
  hours: number
  goal: string
}

type Props = {
  onTotalChange: (total: number[]) => void
}

const days = [
  "Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"
]

export default function TimeSummary({ onTotalChange }: Props) {
  const todayIndex = new Date().getDay()

  const [selectedDay, setSelectedDay] = useState<number>(todayIndex)

  const [goals, setGoals] = useState<string[]>([
    "Study",
    "Work",
    "Exercise",
  ])

  const [weekSessions, setWeekSessions] = useState<Record<number, Session[]>>({
    0: [],1: [],2: [],3: [],4: [],5: [],6: [],
  })

  const sessions = weekSessions[selectedDay] || []

  const updateSessions = (newSessions: Session[]) => {
    setWeekSessions(prev => ({
      ...prev,
      [selectedDay]: newSessions,
    }))
  }

  const addSession = () => {
    const total = sessions.reduce((sum, s) => sum + s.hours, 0)
    if (total >= 24) return

    updateSessions([
      ...sessions,
      {
        id: Date.now(),
        hours: 0,
        goal: goals[0] ?? "Study",
      },
    ])
  }

  const updateSession = (id: number, value: number) => {
    let hours = Math.max(0, Math.min(24, value))

    const otherTotal = sessions
      .filter(s => s.id !== id)
      .reduce((sum, s) => sum + s.hours, 0)

    if (otherTotal + hours > 24) {
      hours = 24 - otherTotal
    }

    updateSessions(
      sessions.map(s =>
        s.id === id ? { ...s, hours } : s
      )
    )
  }

  const updateGoal = (id: number, goal: string) => {
    updateSessions(
      sessions.map(s =>
        s.id === id ? { ...s, goal } : s
      )
    )
  }

  const addGoal = () => {
    const newGoal = globalThis.prompt?.("Enter new goal")
    if (!newGoal) return

    if (!goals.includes(newGoal)) {
      setGoals(prev => [...prev, newGoal])
    }
  }

  const total = sessions.reduce((sum, s) => sum + s.hours, 0)

  const dailyTotals = days.map((_, i) =>
    (weekSessions[i] || []).reduce((sum, s) => sum + s.hours, 0)
  )

  useEffect(() => {
    onTotalChange(dailyTotals)
  }, [dailyTotals, onTotalChange])

  return (
    <div className="w-[320px] rounded-xl bg-zinc-200 p-5">

      <h2 className="text-neutral-800 text-lg font-semibold mb-4">
        Time Sessions
      </h2>

      <select
        value={selectedDay}
        onChange={(e) => setSelectedDay(Number(e.target.value))}
        className="mb-4 w-full rounded bg-zinc-300 text-neutral-800 px-2 py-1"
      >
        {days.map((day, i) => (
          <option key={i} value={i}>{day}</option>
        ))}
      </select>

      <div className="space-y-3">
        {sessions.map((session, i) => (
          <div key={session.id} className="flex items-center gap-3">

            <span className="text-zinc-800 text-sm w-16">
              Session {i + 1}
            </span>

            <input
              type="number"
              min={0}
              max={24}
              value={session.hours}
              onChange={(e) =>
                updateSession(session.id, Number(e.target.value))
              }
              className="w-14 rounded bg-zinc-200 px-2 py-1"
            />

            <span className="text-sm">hrs</span>

            <select
              value={session.goal}
              onChange={(e) =>
                updateGoal(session.id, e.target.value)
              }
              className="rounded bg-zinc-300 px-2 py-1"
            >
              {goals.map((g, idx) => (
                <option key={idx} value={g}>{g}</option>
              ))}
            </select>

          </div>
        ))}
      </div>

      <button
        onClick={addSession}
        className="mt-4 text-sm text-cyan-500"
      >
        + Add Session
      </button>

      <button
        onClick={addGoal}
        className="mt-2 text-sm text-pink-500 block"
      >
        + Add Goal
      </button>

      <div className="mt-6 border-t pt-3">
        Total: <span className="text-cyan-700">{total} hrs</span>
      </div>

    </div>
  )
}