"use client"

import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  ResponsiveContainer,
} from "recharts"

type SessionRadarGraphProps = {
  sessions?: {
    type: string
    value: number
  }[]
}

export default function SessionRadarGraph({ sessions }: SessionRadarGraphProps) {

  const data =
    sessions ??
    [
      { type: "Focus", value: 80 },
      { type: "Study", value: 65 },
      { type: "Work", value: 90 },
      { type: "Exercise", value: 40 },
      { type: "Break", value: 30 },
      { type: "Sleep", value: 75 },
    ]

  return (
    <div className="w-full max-w-md aspect-square bg-zinc-200 rounded-xl shadow p-4">
      <h2 className="text-lg font-semibold mb-2">Session Distribution</h2>

      <ResponsiveContainer width="100%" height="100%">
  <RadarChart
    data={data}
    margin={{ top: 20, right: 40, bottom: 20, left: 40 }}
  >
    <PolarGrid />
    <PolarAngleAxis dataKey="type" />

    <Radar
      name="Sessions"
      dataKey="value"
      stroke="#FF69B4"
      fill="#FF69B4"
      fillOpacity={0.6}
    />
  </RadarChart>
</ResponsiveContainer>
    </div>
  )
}