import { useMemo, useState } from "react";
import { ChevronDown, CircleCheck, CircleDashed, CircleX } from "lucide-react";
import { cn } from "@/lib/utils";
import { categoryTarget, minsToClock, minsToHuman, type RawEvent } from "@/lib/streak-mock";

type GoalAgg = {
  name: string;
  totalMinutes: number;
  doneMinutes: number;
  targetMinutes: number;
  pct: number;
  recent: RawEvent[];
};

export function GoalProgressTracker({ events }: { events: RawEvent[] }) {
  const goals = useMemo<GoalAgg[]>(() => {
    const since = new Date();
    since.setDate(since.getDate() - 7);
    const sinceISO = since.toISOString().slice(0, 10);

    const map = new Map<string, GoalAgg>();
    for (const e of events) {
      if (e.date < sinceISO) continue;
      const cat = classifyTitle(e.title);
      const dur = Math.max(0, e.end_time - e.start_time);
      const g = map.get(cat) ?? {
        name: cat,
        totalMinutes: 0,
        doneMinutes: 0,
        targetMinutes: categoryTarget(cat) * 60,
        pct: 0,
        recent: [],
      };
      g.totalMinutes += dur;
      if (e.status === "done") g.doneMinutes += dur;
      g.recent.push(e);
      map.set(cat, g);
    }
    const arr = [...map.values()];
    for (const g of arr) {
      g.pct = Math.min(100, Math.round((g.doneMinutes / g.targetMinutes) * 100));
      g.recent.sort((a, b) => b.date.localeCompare(a.date) || b.start_time - a.start_time);
    }
    return arr.sort((a, b) => b.pct - a.pct).slice(0, 6);
  }, [events]);

  const [open, setOpen] = useState<string | null>(goals[0]?.name ?? null);

  return (
    <section className="card-soft p-10 md:p-14 anim-fade-up" style={{ animationDelay: "120ms" }}>
      <header className="mb-8">
        <h2 className="text-4xl font-semibold tracking-tight">Goal Progress</h2>
      </header>

      <ul className="divide-y divide-gray-200">
        {goals.map((g) => (
          <GoalRow
            key={g.name}
            goal={g}
            open={open === g.name}
            onToggle={() => setOpen(open === g.name ? null : g.name)}
          />
        ))}
        {goals.length === 0 && (
          <li className="py-10 text-center text-sm text-muted-foreground">
            No activity in the last 7 days yet.
          </li>
        )}
      </ul>
    </section>
  );
}

function GoalRow({ goal, open, onToggle }: { goal: GoalAgg; open: boolean; onToggle: () => void }) {
  return (
    <li className="py-5">
      <button
        onClick={onToggle}
        className="group flex w-full items-center gap-5 text-left"
        aria-expanded={open}
      >
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-3">
            <h3 className="text-2xl font-semibold tracking-tight">{goal.name}</h3>
            <span className="font-mono text-sm tabular-nums text-muted-foreground">
              {minsToHuman(goal.doneMinutes)} / {minsToHuman(goal.targetMinutes)}
            </span>
          </div>
          <div className="mt-3 flex items-center gap-3">
            <div className="relative h-3 flex-1 overflow-hidden rounded-full bg-gray-200">
              <div
                className="absolute inset-y-0 left-0 rounded-full bg-gray-900"
                style={{ width: `${goal.pct}%` }}
              />
            </div>
            <span className="w-12 text-right font-mono text-sm font-semibold tabular-nums">
              {goal.pct}%
            </span>
          </div>
        </div>
        <ChevronDown
          size={18}
          className={cn(
            "shrink-0 text-muted-foreground transition-all",
            open && "rotate-180 text-gray-900"
          )}
        />
      </button>

      <div
        className="grid transition-all"
        style={{
          gridTemplateRows: open ? "1fr" : "0fr",
          opacity: open ? 1 : 0,
          marginTop: open ? 16 : 0,
        }}
      >
        <div className="overflow-hidden">
          <div className="rounded-2xl bg-gray-100 p-4">
            <ol className="space-y-2">
              {goal.recent.slice(0, 5).map((e, i) => (
                <li
                  key={e.id}
                  className="flex items-center gap-3 rounded-xl px-2 py-1.5 text-sm transition-colors hover:bg-gray-200"
                >
                  <span className="w-5 font-mono text-xs text-muted-foreground tabular-nums">
                    {i + 1}.
                  </span>
                  <StatusIcon status={e.status} />
                  <span className="min-w-0 flex-1 truncate font-medium">{e.title}</span>
                  <span className="hidden font-mono text-xs text-muted-foreground sm:inline">
                    {minsToClock(e.start_time)}
                  </span>
                  <span className="font-mono text-xs tabular-nums text-muted-foreground">
                    {minsToHuman(e.end_time - e.start_time)}
                  </span>
                </li>
              ))}
              {goal.recent.length === 0 && (
                <li className="py-4 text-center text-xs text-muted-foreground">
                  No events recorded
                </li>
              )}
            </ol>
          </div>
        </div>
      </div>
    </li>
  );
}

function StatusIcon({ status }: { status: RawEvent["status"] }) {
  if (status === "done") return <CircleCheck size={15} className="text-gray-900" />;
  if (status === "missed") return <CircleX size={15} className="text-gray-400" />;
  return <CircleDashed size={15} className="text-muted-foreground" />;
}

function classifyTitle(title: string): string {
  const low = title.toLowerCase();
  const rules: { kw: string[]; name: string }[] = [
    { kw: ["study", "course", "exam", "lecture", "revision"], name: "Study" },
    { kw: ["read", "book", "deep work"], name: "Reading" },
    { kw: ["workout", "gym", "run", "yoga", "cycling", "swim"], name: "Fitness" },
    { kw: ["standup", "review", "client", "code", "refactor", "project"], name: "Work" },
    { kw: ["meditat", "journal", "plan"], name: "Mindfulness" },
    { kw: ["lunch", "coffee", "break"], name: "Breaks" },
  ];
  for (const r of rules) if (r.kw.some((k) => low.includes(k))) return r.name;
  return "Other";
}