import { useMemo } from "react";
import { Target } from "lucide-react";
import { isoDate, type RawEvent } from "@/lib/streak-mock";

type Week = {
  label: string;
  startDate: Date;
  days: { date: Date; doneCount: number; total: number }[];
  doneCount: number;
};

function isoWeek(d: Date): number {
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  return Math.ceil(((t.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7);
}

function mondayOf(d: Date): Date {
  const c = new Date(d);
  c.setHours(0, 0, 0, 0);
  c.setDate(c.getDate() - ((c.getDay() + 6) % 7));
  return c;
}

export function WeekGraph({ events, weeks = 4 }: { events: RawEvent[]; weeks?: number }) {
  const data = useMemo<Week[]>(() => {
    const map = new Map<string, RawEvent[]>();
    for (const e of events) {
      if (!map.has(e.date)) map.set(e.date, []);
      map.get(e.date)!.push(e);
    }

    const thisMon = mondayOf(new Date());
    const out: Week[] = [];
    for (let w = weeks - 1; w >= 0; w--) {
      const start = new Date(thisMon);
      start.setDate(thisMon.getDate() - w * 7);
      const days: Week["days"] = [];
      let doneCount = 0;
      for (let d = 0; d < 7; d++) {
        const cur = new Date(start);
        cur.setDate(start.getDate() + d);
        const evs = map.get(isoDate(cur)) ?? [];
        const done = evs.filter((e) => e.status === "done").length;
        days.push({ date: cur, doneCount: done, total: evs.length });
        doneCount += done;
      }
      out.push({
        label: `W${isoWeek(start)}`,
        startDate: start,
        days,
        doneCount,
      });
    }
    return out;
  }, [events, weeks]);

  const eventMap = useMemo(() => {
    const map = new Map<string, RawEvent[]>();
    for (const e of events) {
      if (!map.has(e.date)) map.set(e.date, []);
      map.get(e.date)!.push(e);
    }
    return map;
  }, [events]);

  return (
    <article className="card-soft p-10 anim-fade-up" style={{ animationDelay: "120ms" }}>
      <header>
        <h3 className="text-3xl font-semibold tracking-tight">Week</h3>
      </header>

      <div className="mt-6 rounded-xl bg-gray-100 p-6">
        <div className="grid grid-cols-4 gap-3">
          {data.map((wk, wi) => (
            <div key={wi} className="flex flex-col items-start gap-3">
              <div className="flex h-16 w-full items-end justify-between">
                {wk.days.map((d, di) => {
                  const dayKey = isoDate(d.date);
                  const dayEvents = eventMap.get(dayKey) || [];
                  return (
                    <DotStack 
                      key={di} 
                      done={d.doneCount} 
                      total={d.total} 
                      delay={wi * 70 + di * 30}
                      events={dayEvents}
                    />
                  );
                })}
              </div>
              <div className="flex w-full justify-between font-mono text-xs text-muted-foreground tabular-nums">
                {wk.days.map((d, di) => (
                  <span key={di} className="w-3 text-center">
                    {d.date.getDate()}
                  </span>
                ))}
              </div>
              <div className="mt-1">
                <p className="text-base font-semibold tracking-tight">{wk.label}</p>
                <p className="mt-0.5 flex items-center gap-1 font-mono text-[11px] text-muted-foreground">
                  <Target size={11} />
                  <span className="tabular-nums">{wk.doneCount}</span>
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </article>
  );
}

function DotStack({ done, total, delay, events }: { done: number; total: number; delay: number; events: RawEvent[] }) {
  const visible = Math.min(3, total);
  return (
    <div className="flex flex-col-reverse items-center gap-1 relative group">
      {Array.from({ length: visible }).map((_, i) => {
        const isDone = i < done;
        return (
          <span
            key={i}
            className="h-2 w-2 rounded-full anim-pop cursor-pointer"
            style={{
              background: isDone ? "#111827" : "#9ca3af",
              animationDelay: `${delay + i * 50}ms`,
            }}
          />
        );
      })}
      {events.length > 0 && (
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-10">
          {events.map(e => e.title).join(", ")}
        </div>
      )}
    </div>
  );
}