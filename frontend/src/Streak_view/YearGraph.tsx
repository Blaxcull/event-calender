import { useMemo } from "react";
import { type RawEvent } from "@/lib/streak-mock";

export function YearGraph({ events }: { events: RawEvent[] }) {
  const months = useMemo(() => {
    const today = new Date();
    const arr: { name: string; total: number; done: number }[] = [];
    const NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    for (let m = 11; m >= 0; m--) {
      const d = new Date(today.getFullYear(), today.getMonth() - m, 1);
      arr.push({ name: NAMES[d.getMonth()], total: 0, done: 0 });
    }
    for (const e of events) {
      const dt = new Date(`${e.date}T12:00:00`);
      const monthsAgo =
        (today.getFullYear() - dt.getFullYear()) * 12 + (today.getMonth() - dt.getMonth());
      const idx = 11 - monthsAgo;
      if (idx < 0 || idx > 11) continue;
      arr[idx].total++;
      if (e.status === "done") arr[idx].done++;
    }
    return arr;
  }, [events]);

  const max = Math.max(1, ...months.map((m) => m.total));
  const totalDone = months.reduce((s, m) => s + m.done, 0);

  return (
    <article className="card-soft p-10 anim-fade-up" style={{ animationDelay: "240ms" }}>
      <header className="flex items-baseline justify-between">
        <h3 className="text-3xl font-semibold tracking-tight">Year</h3>
      </header>

      <div className="mt-6 rounded-xl bg-gray-100 p-6">
        <div className="grid h-24 grid-cols-12 items-end gap-1.5">
          {months.map((m, i) => {
            const pct = (m.total / max) * 100;
            const doneRatio = m.total > 0 ? m.done / m.total : 0;
            return (
              <div key={i} className="flex h-full items-end">
                <div
                  className="relative w-full origin-bottom overflow-hidden rounded-sm bg-gray-300 anim-grow-y"
                  style={{
                    height: `${Math.max(m.total > 0 ? 4 : 0, pct)}%`,
                    animationDelay: `${i * 30}ms`,
                  }}
                  title={`${m.name} · ${m.total} events · ${m.done} done`}
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
        <div className="mt-2 grid grid-cols-12 gap-1.5 text-center font-mono text-xs text-muted-foreground">
          {months.map((m, i) => (
            <span key={i}>{m.name}</span>
          ))}
        </div>
      </div>
    </article>
  );
}