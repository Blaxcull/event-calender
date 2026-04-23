import { useMemo } from "react";
import { Flame } from "lucide-react";
import { isoDate } from "@/lib/streak-mock";

export function StreakHero({
  current,
  longest,
  activeDays,
  totalDays,
  streakDays,
}: {
  current: number;
  longest: number;
  activeDays: number;
  totalDays: number;
  streakDays?: Set<string>;
}) {
  const consistency = totalDays > 0 ? Math.round((activeDays / totalDays) * 100) : 0;

  const grid = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayDow = today.getDay();
    const daysToShow = 29 + todayDow;
    const result: { date: Date; hasEvents: boolean }[] = [];

    for (let i = daysToShow - 1; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      result.push({
        date: d,
        hasEvents: streakDays ? streakDays.has(isoDate(d)) : false,
      });
    }
    return result;
  }, [streakDays]);

  const dayLabels = ["S", "M", "T", "W", "T", "F", "S"];

  return (
    <section className="card-ink relative overflow-hidden p-12 md:p-16 anim-fade-up">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.06]"
        style={{
          backgroundImage:
            "linear-gradient(to right, currentColor 1px, transparent 1px), linear-gradient(to bottom, currentColor 1px, transparent 1px)",
          backgroundSize: "32px 32px",
        }}
      />
      <div className="relative flex flex-col gap-8">
        <div className="flex items-center gap-2 text-[10px] font-mono uppercase tracking-[0.3em] opacity-70">
          <Flame size={14} /> Streak
        </div>

        <div className="flex items-end gap-6">
          <span className="text-[10rem] md:text-[14rem] font-bold leading-none tracking-tighter tabular-nums">
            {current}
          </span>
          <span className="mb-6 text-xl font-medium opacity-70">
            {current === 1 ? "day" : "days"} in a row
          </span>
        </div>

        <div className="grid grid-cols-3 gap-8 border-t border-white/10 pt-8">
          <Stat label="Longest" value={`${longest}d`} />
          <Stat label="Active days" value={`${activeDays}`} />
          <Stat label="Consistency" value={`${consistency}%`} />
        </div>
      </div>

      <div className="absolute right-8 top-1/2 -translate-y-1/2 hidden lg:flex flex-col gap-1 self-start mt-0">
        <div className="flex gap-2 ml-1">
          {dayLabels.map((label, i) => (
            <div key={i} className="w-8 text-[12px] text-white/40 text-center">{label}</div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-2">
          {grid.map((day, i) => (
            <div
              key={i}
              className="w-8 h-8 rounded-sm"
              style={{
                backgroundColor: day.hasEvents ? "#ffffff" : "#374151",
              }}
              title={day.date.toLocaleDateString()}
            />
          ))}
        </div>
      </div>
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] font-mono uppercase tracking-[0.25em] opacity-50">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>
    </div>
  );
}