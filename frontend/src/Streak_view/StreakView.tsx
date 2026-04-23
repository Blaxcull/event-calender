import { useMemo, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { computeStreak, fetchAppOpenDates, addAppOpenDate, isoDate } from "@/lib/streak-mock";
import type { RawEvent } from "@/lib/streak-mock";
import { StreakHero } from "./StreakHero";
import { GoalProgressTracker } from "./GoalProgressTracker";
import { DayBarGraph } from "./DayBarGraph";
import { WeekGraph } from "./WeekGraph";
import { MonthGraph } from "./MonthGraph";
import { YearGraph } from "./YearGraph";

export default function StreakView() {
  const [events, setEvents] = useState<RawEvent[]>([]);
  const [activeDays, setActiveDays] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function initStreak() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setLoading(false);
        return;
      }

      const today = isoDate(new Date());
      await addAppOpenDate(user.id, today);

      const streakDates = await fetchAppOpenDates(user.id);
      setActiveDays(new Set(streakDates));
    }

    initStreak();
  }, []);

  useEffect(() => {
    async function fetchEvents() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setLoading(false);
        return;
      }

      const today = new Date();
      const startDate = new Date(today);
      startDate.setDate(today.getDate() - 120);

      const pad = (n: number) => String(n).padStart(2, "0");
      const toIsoDate = (d: Date) =>
        `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

      const { data, error } = await supabase
        .from("events")
        .select("*")
        .eq("user_id", user.id)
        .gte("date", toIsoDate(startDate))
        .lte("date", toIsoDate(today))
        .order("date", { ascending: true });

      if (error) {
        console.error("Error fetching events:", error);
      } else if (data) {
        setEvents(data.map((e) => ({
          id: e.id,
          title: e.title,
          date: e.date,
          start_time: e.start_time,
          end_time: e.end_time,
          status: "done" as const,
        })));
      }
      setLoading(false);
    }

    fetchEvents();
  }, []);

  const { current, longest } = useMemo(() => computeStreak(events, activeDays), [events, activeDays]);

  if (loading) {
    return (
      <main className="min-h-screen bg-white text-gray-900 flex items-center justify-center">
        <p className="text-gray-500">Loading...</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-white text-gray-900">
      <div className="mx-auto max-w-[1800px] px-5 pb-16 pt-24 md:pt-28">
        <header className="flex flex-col items-start justify-between gap-5 md:flex-row md:items-center">
          <div>
            <p className="text-[10px] font-mono uppercase tracking-[0.3em] text-muted-foreground">
              Analytics
            </p>
            <h1 className="mt-1 text-4xl font-semibold tracking-tight md:text-5xl">Streak</h1>
          </div>
        </header>

        <div className="mt-8 grid grid-cols-1 gap-5 lg:grid-cols-[0.8fr_1.2fr]">
          <div className="flex flex-col gap-5">
            <div className="flex flex-col gap-5">
              <StreakHero
                current={current}
                longest={longest}
                activeDays={activeDays.size}
                totalDays={events.length > 0 ? 120 : 0}
                streakDays={activeDays}
              />
            </div>
            <GoalProgressTracker events={events} />
          </div>

          <div className="flex flex-col gap-5">
            <DayBarGraph events={events} />
            <WeekGraph events={events} />
            <MonthGraph events={events} />
            <YearGraph events={events} />
          </div>
        </div>

        <footer className="mt-12 text-center font-mono text-[10px] uppercase tracking-[0.3em] text-muted-foreground">
          {events.length} events over 120 days
        </footer>
      </div>
    </main>
  );
}