"use client"

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"

import BarGraph from "@/components/ui/BarGraph"
import SessionRadarGraph from "@/components/ui/Webchart"
import Streak from "@/components/ui/Streak"

export function Analyser() {

  const [weeksData, setWeeksData] = useState<number[][]>([
    [0,0,0,0,0,0,0], // prev
    [0,0,0,0,0,0,0], // current
    [0,0,0,0,0,0,0], // next
  ])

  useEffect(() => {
    const fetchEvents = async () => {

      const getWeekRange = (offset: number) => {
        const start = new Date()
        start.setDate(start.getDate() - start.getDay() + offset * 7)

        const end = new Date(start)
        end.setDate(start.getDate() + 7)

        return { start, end }
      }

      const results: number[][] = []

      for (let w = -1; w <= 1; w++) {
        const { start, end } = getWeekRange(w)

        const { data, error } = await supabase
          .from("events")
          .select("created_at")
          .gte("created_at", start.toISOString())
          .lt("created_at", end.toISOString())

        if (error) {
          console.error(error)
          results.push([0,0,0,0,0,0,0])
          continue
        }

        const counts = [0,0,0,0,0,0,0]

        data.forEach((event) => {
          const day = new Date(event.created_at).getDay()
          counts[day]++
        })

        results.push(counts)
      }

      setWeeksData(results)
    }

    fetchEvents()
  }, [])

  return (
    <div className="flex flex-col gap-6 p-6 bg-zinc-100 min-h-screen">

      {/* 🔥 STREAK */}
      <Streak />

      {/* 📊 THREE WEEK GRAPHS */}
      <div className="flex gap-6 w-full">

        {/* Previous */}
        <div className="flex-1">
          <h3 className="text-sm font-semibold text-center mb-2 text-zinc-600">
            Previous Week
          </h3>
          <BarGraph weekEvents={weeksData[0]} />
        </div>

        {/* Current */}
        <div className="flex-[1.2] border-2 border-cyan-400 rounded-xl p-2">
          <h3 className="text-sm font-semibold text-center mb-2 text-cyan-600">
            This Week
          </h3>
          <BarGraph weekEvents={weeksData[1]} />
        </div>

        {/* Next */}
        <div className="flex-1">
          <h3 className="text-sm font-semibold text-center mb-2 text-zinc-600">
            Next Week
          </h3>
          <BarGraph weekEvents={weeksData[2]} />
        </div>

      </div>

      {/* 📡 RADAR */}
      <SessionRadarGraph />

    </div>
  )
}