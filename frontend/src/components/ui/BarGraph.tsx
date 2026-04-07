"use client"

type BarData = {
  label: string
  value: number
}

type BarGraphProps = {
  weekEvents?: number[]
}

export default function BarGraph({ weekEvents = [] }: BarGraphProps) {

  const todayIndex = new Date().getDay()

  const labels = [
    "Sun","Mon","Tue","Wed","Thu","Fri","Sat"
  ]

  const data: BarData[] = labels.map((label, i) => ({
    label,
    value: weekEvents?.[i] ?? 0,
  }))

  const MAX_DOTS = 12

  return (
    <div className="w-full rounded-2xl bg-zinc-200 p-4 shadow-md">

      <div className="flex items-end justify-between h-[240px] gap-3">

        {data.map((item, i) => {
          const isToday = i === todayIndex

          const visibleDots = Math.min(item.value, MAX_DOTS)
          const extra = item.value - visibleDots

          return (
            <div key={i} className="flex flex-col items-center justify-end h-full">

              {/* dots */}
              <div className="flex flex-col justify-end items-center gap-1 h-full">

                {Array.from({ length: visibleDots }).map((_, j) => (
                  <div
                    key={j}
                    className={`w-3 h-3 rounded-full ${
                      isToday
                        ? "bg-cyan-500 shadow-[0_0_6px_#22d3ee]"
                        : "bg-pink-400"
                    }`}
                  />
                ))}

                {extra > 0 && (
                  <span className="text-[10px] text-zinc-500">
                    +{extra}
                  </span>
                )}

              </div>

              {/* label */}
              <span className={`mt-2 text-[10px] ${isToday ? "text-cyan-600" : "text-zinc-500"}`}>
                {item.label}
              </span>

            </div>
          )
        })}

      </div>
    </div>
  )
}