import { useMemo } from "react";
import { Target, TrendingDown, TrendingUp } from "lucide-react";
import { type RawEvent } from "@/lib/streak-mock";

type MonthCol = {
  monthIdx: number;
  monthName: string;
  weeks: { label: string; total: number; done: number }[];
  monthTotal: number;
  delta: number | null;
};

const MONTH_NAMES = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];

function weekOfMonth(d: Date): number {
  const first = new Date(d.getFullYear(), d.getMonth(), 1);
  const offset = (first.getDay() + 6) % 7;
  return Math.floor((d.getDate() - 1 + offset) / 7) + 1;
}

export function MonthGraph({ events, months = 4 }: { events: RawEvent[]; months?: number }) {
  const cols = useMemo<MonthCol[]>(() => {
    const today = new Date();
    const out: MonthCol[] = [];
    for (let m = months - 1; m >= 0; m--) {
      const monthStart = new Date(today.getFullYear(), today.getMonth() - m, 1);
      const monthEnd = new Date(today.getFullYear(), today.getMonth() - m + 1, 0);
      const weeksInMonth: { [k: number]: { total: number; done: number } } = {};
      const wMax = weekOfMonth(monthEnd);
      for (let w = 1; w <= wMax; w++) weeksInMonth[w] = { total: 0, done: 0 };

      for (const e of events) {
        const dt = new Date(`${e.date}T12:00:00`);
        if (dt.getMonth() !== monthStart.getMonth() || dt.getFullYear() !== monthStart.getFullYear())
          continue;
        const w = weekOfMonth(dt);
        weeksInMonth[w].total++;
        if (e.status === "done") weeksInMonth[w].done++;
      }
      const weeks = Object.entries(weeksInMonth).map(([k, v]) => ({
        label: `W${k}`,
        total: v.total,
        done: v.done,
      }));
      const monthTotal = weeks.reduce((s, w) => s + w.total, 0);
      out.push({
        monthIdx: monthStart.getMonth(),
        monthName: MONTH_NAMES[monthStart.getMonth()],
        weeks,
        monthTotal,
        delta: null,
      });
    }
    for (let i = 0; i < out.length; i++) {
      const prev = out[i - 1];
      if (!prev || prev.monthTotal === 0) {
        out[i].delta = i === 0 ? null : out[i].monthTotal > 0 ? 100 : 0;
      } else {
        out[i].delta = Math.round(((out[i].monthTotal - prev.monthTotal) / prev.monthTotal) * 100);
      }
    }
    return out;
  }, [events, months]);

  const totalWeekCols = cols.reduce((s, c) => s + c.weeks.length, 0);
  const allWeeks = cols.flatMap((c) => c.weeks);
  const max = Math.max(1, ...allWeeks.map((w) => w.total));

  return (
    <article className="card-soft p-10 anim-fade-up" style={{ animationDelay: "180ms" }}>
      <header>
        <h3 className="text-3xl font-semibold tracking-tight">Month</h3>
      </header>

      <div className="mt-6 rounded-xl bg-gray-100 p-6">
        <div
          className="grid h-28 items-end gap-[3px]"
          style={{ gridTemplateColumns: `repeat(${totalWeekCols}, minmax(0, 1fr))` }}
        >
          {allWeeks.map((w, i) => {
            const pct = (w.total / max) * 100;
            const doneRatio = w.total > 0 ? w.done / w.total : 0;
            return (
              <div key={i} className="flex h-full items-end">
                <div
                  className="relative w-full origin-bottom overflow-hidden rounded-sm bg-gray-300 anim-grow-y"
                  style={{
                    height: `${Math.max(w.total > 0 ? 4 : 0, pct)}%`,
                    animationDelay: `${i * 18}ms`,
                  }}
                  title={`${w.label} · ${w.total} events · ${w.done} done`}
                >
                  <div
                    className="absolute inset-x-0 bottom-0 bg-gray-900 transition-all"
                    style={{ height: `${doneRatio * 100}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>

        <div
          className="mt-2 grid gap-[3px] font-mono text-xs text-muted-foreground tabular-nums"
          style={{ gridTemplateColumns: `repeat(${totalWeekCols}, minmax(0, 1fr))` }}
        >
          {allWeeks.map((w, i) => (
            <span key={i} className="text-center">
              {w.label}
            </span>
          ))}
        </div>

        <div
          className="mt-4 grid gap-3"
          style={{ gridTemplateColumns: `repeat(${cols.length}, minmax(0, 1fr))` }}
        >
          {cols.map((c) => (
            <div key={c.monthName}>
              <p className="text-sm font-semibold tracking-wide">{c.monthName}</p>
              <p className="mt-0.5 flex items-center gap-1.5 font-mono text-sm text-muted-foreground">
                <Target size={11} />
                <span className="tabular-nums text-gray-900">{c.monthTotal}</span>
                {c.delta !== null && c.monthTotal > 0 && (
                  <span
                    className="ml-1 inline-flex items-center gap-0.5 tabular-nums"
                    style={{ color: c.delta >= 0 ? "#111827" : "#6b7280" }}
                  >
                    {c.delta >= 0 ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
                    {c.delta > 0 ? "+" : ""}
                    {c.delta}%
                  </span>
                )}
              </p>
            </div>
          ))}
        </div>
      </div>
    </article>
  );
}