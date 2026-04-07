"use client"

import { useState, useMemo } from "react"

const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]

const STORAGE_KEY = "streak-days"

const generateDates = (weeks = 20) => {
  const totalDays = weeks * 7
  const dates: Date[] = []

  const today = new Date()

  // Convert Sunday=0 → Monday=0
  const day = (today.getDay() + 6) % 7

  // Find Monday of current week
  const startOfWeek = new Date(today)
  startOfWeek.setDate(today.getDate() - day)

  // Center offset (in weeks)
  const middleWeek = Math.floor(weeks / 2)

  // Start date = Monday of (middle - offset)
  const startDate = new Date(startOfWeek)
  startDate.setDate(startOfWeek.getDate() - middleWeek * 7)

  for (let i = 0; i < totalDays; i++) {
    const d = new Date(startDate)
    d.setDate(startDate.getDate() + i)
    dates.push(d)
  }

  return dates
}

export default function Streak() {
  const dates = useMemo(() => generateDates(), [])
  const today = new Date().toDateString()

  const [activeDays] = useState<Set<string>>(() => {
    const stored = localStorage.getItem(STORAGE_KEY)
    let daysSet = new Set<string>()

    if (stored) {
      daysSet = new Set(JSON.parse(stored))
    }

    daysSet.add(today)
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...daysSet]))

    return daysSet
  })

  const [hovered, setHovered] = useState<Date | null>(null)

  const streakDates = new Set<string>()

// 🔥 find today's index
const todayIndex = dates.findIndex(
  (d) => d.toDateString() === today
)

// 🔥 walk backwards from today
for (let i = todayIndex; i >= 0; i--) {
  const key = dates[i].toDateString()

  if (activeDays.has(key)) {
    streakDates.add(key)
  } else {
    break
  }
}
  const displayDate = hovered ? hovered.toDateString() : today

  return (
    <div className="bg-zinc-100 p-8 rounded-2xl text-neutral-800 w-[75vw] max-w-[1200px]">

      <div className="flex gap-6">

        {/* Day labels */}
        <div className="flex flex-col justify-between text-base text-zinc-900 pr-4">
          {days.map((day, i) => (
            <span key={i}>{day}</span>
          ))}
        </div>

        {/* Scrollable grid */}
        <div className="flex gap-3 overflow-x-auto pb-2">

          {Array.from({ length: Math.ceil(dates.length / 7) }).map((_, week) => {

            const weekDates = dates.slice(week * 7, week * 7 + 7)

            return (
              <div key={week} className="flex flex-col gap-3">

                {weekDates.map((date, i) => {
                  const key = date.toDateString()
                  const isToday = key === today
                  const isActive = activeDays.has(key)
                  const isStreak = streakDates.has(key)

                  let color = "bg-zinc-400"

                  if (isActive) color = "bg-neutral-700"
                  if (isStreak) color = "bg-neutral-700"
                  if (isToday) color = "bg-neutral-100"

                  let border = "border-zinc-500"

if (isToday) border = "border-zinc-800"
else if (isStreak) border = "border-zinc-800"
else if (isActive) border = "border-zinc-800"

                  return (
                    <div
  key={i}
  onMouseEnter={() => setHovered(date)}
  onMouseLeave={() => setHovered(null)}
  className={`relative w-8 h-8 rounded-full border-2 ${border} ${color} flex justify-center items-center cursor-pointer`}
>
{isToday && (
  <div className="absolute w-[22px] h-[22px] rounded-full bg-black top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
)}
</div>
                  )
                })}

              </div>
            )
          })}

        </div>
      </div>

      {/* Bottom info */}
      <div className="mt-6 flex justify-between items-center">

        <div className="text-base bg-zinc-100 text-zinc-800 px-4 py-2 rounded">
          {displayDate}
        </div>

        <div className="text-xl font-bold text-green-700">
          🔥 {streakDates.size} day streak 
        </div>

      </div>

    </div>
  )
}