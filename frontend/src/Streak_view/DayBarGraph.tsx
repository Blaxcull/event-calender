import { useMemo } from "react";
import { isoDate, type RawEvent } from "@/lib/streak-mock";

type Bucket = { date: string; created: number; done: number; updated: number };

export function DayBarGraph({ events, days = 30 }: { events: RawEvent[]; days?: number }) {
  const eventMap = useMemo(() => {
    const map = new Map<string, RawEvent[]>();
    for (const e of events) {
      if (!map.has(e.date)) map.set(e.date, []);
      map.get(e.date)!.push(e);
    }
    return map;
  }, [events]);

  const buckets = useMemo<Bucket[]>(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const map = new Map<string, Bucket>();
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      const k = isoDate(d);
      map.set(k, { date: k, created: 0, done: 0, updated: 0 });
    }
    for (const e of events) {
      const b = map.get(e.date);
      if (!b) continue;
      b.created++;
      if (e.status === "done") b.done++;
      else if (e.status === "pending") b.updated++;
    }
    return [...map.values()];
  }, [events, days]);

  const totals = buckets.reduce(
    (acc, b) => {
      acc.created += b.created;
      acc.done += b.done;
      acc.updated += b.updated;
      return acc;
    },
    { created: 0, done: 0, updated: 0 }
  );

  const max = Math.max(1, ...buckets.map((b) => b.created));

  return (
    <article className="card-soft p-10 anim-fade-up" style={{ animationDelay: "60ms" }}>
      <Header title="Day" />

      <div className="relative mt-6 h-72 rounded-xl bg-gray-100 p-4">
        <div className="flex h-56 items-end gap-[3px]">
          {buckets.map((b, i) => {
            const pct = (b.created / max) * 100;
            const dayEvents = eventMap.get(b.date) || [];
            return (
              <div
                key={b.date}
                className="flex-1 origin-bottom rounded-sm bg-gray-900 anim-grow-y transition-colors hover:bg-gray-700 relative group cursor-pointer"
                style={{
                  height: `${Math.max(b.created > 0 ? 6 : 0, pct)}%`,
                  minHeight: b.created > 0 ? 4 : 0,
                  animationDelay: `${i * 12}ms`,
                  opacity: b.done === 0 && b.created > 0 ? 0.35 : 1,
                }}
              >
                {b.created > 0 && (
                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900 text-white text-sm rounded-lg opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-10">
                    {b.done} done of {b.created}
                  </div>
                )}
              </div>
            );
          })}
        </div>
        <div className="h-12 flex items-start justify-between pt-2 text-xs text-muted-foreground">
          {buckets.map((b) => (
            <span key={b.date} className="flex-1 text-center">
              {new Date(b.date).getDate()}
            </span>
          ))}
        </div>
      </div>

      <Pills
        items={[
          { label: "created", value: totals.created },
          { label: "done", value: totals.done },
          { label: "updated", value: totals.updated },
        ]}
      />
    </article>
  );
}

function Header({ title }: { title: string }) {
  return (
    <header className="flex items-baseline justify-between">
      <h3 className="text-3xl font-semibold tracking-tight">{title}</h3>
    </header>
  );
}

function Pills({ items }: { items: { label: string; value: number }[] }) {
  return (
    <div className="mt-4 flex flex-wrap gap-3">
      {items.map((it, i) => (
        <span
          key={it.label}
          className={
            i === 0
              ? "rounded-full bg-gray-900 px-4 py-2 font-mono text-sm text-white anim-fade-in"
              : "rounded-full border border-gray-200 px-4 py-2 font-mono text-sm text-muted-foreground anim-fade-in"
          }
          style={{ animationDelay: `${200 + i * 80}ms` }}
        >
          <span className="mr-1 font-semibold tabular-nums">{it.value}</span>
          {it.label}
        </span>
      ))}
    </div>
  );
}