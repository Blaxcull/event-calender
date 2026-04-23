// Event data helpers for the Streak analyser.
// Loads real events from Supabase database.

import { supabase } from "./supabase";
import type { Event } from "./store/types";

export function getAppOpenDates(): string[] {
  return [];
}

export function recordAppOpen(): void {}

export async function fetchAppOpenDates(userId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from("streak_days")
    .select("date")
    .eq("user_id", userId as string)
    .order("date", { ascending: true });

  if (error) {
    console.error("Error fetching streak days:", error);
    return [];
  }

  return (data || []).map((d) => d.date as string);
}

export async function addAppOpenDate(userId: string, date: string): Promise<void> {
  const { error } = await supabase.from("streak_days").upsert({
    user_id: userId as string,
    date,
  }, { onConflict: "user_id,date" });

  if (error) {
    console.error("Error recording app open:", error);
  }
}

export type RawEvent = {
  id: string;
  title: string;
  date: string; // YYYY-MM-DD (scheduled date)
  start_time: number; // minutes since midnight
  end_time: number;
  status: "done" | "pending" | "missed";
};

const pad = (n: number) => String(n).padStart(2, "0");
export const isoDate = (d: Date) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

export async function fetchEventsFromSupabase(userId: string, days = 120): Promise<RawEvent[]> {
  const today = new Date();
  const startDate = new Date(today);
  startDate.setDate(today.getDate() - days);
  
  const { data: events, error } = await supabase
    .from("events")
    .select("*")
    .eq("user_id", userId)
    .gte("date", isoDate(startDate))
    .lte("date", isoDate(today))
    .order("date", { ascending: true });

  if (error) {
    console.error("Error fetching events:", error);
    return [];
  }

  return (events as Event[]).map((e) => ({
    id: e.id,
    title: e.title,
    date: e.date,
    start_time: e.start_time,
    end_time: e.end_time,
    status: "done" as const,
    created_date: e.created_at ? e.created_at.split("T")[0] : e.date,
  }));
}

const TITLE_POOL = [
  "Study session — algorithms",
  "Reading: Deep Work",
  "Morning workout",
  "Yoga flow",
  "Team standup",
  "Project review",
  "Client call",
  "Code refactor",
  "Meditation",
  "Journal & plan",
  "Run 5k",
  "Lunch break",
  "Coffee with mentor",
  "Course lecture",
  "Exam revision",
  "Cycling",
];

// Deterministic pseudo-random so the demo is stable
function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function generateMockEvents(days = 120): RawEvent[] {
  const rand = mulberry32(42);
  const events: RawEvent[] = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const dow = d.getDay();
    const isWeekend = dow === 0 || dow === 6;

    // Cadence ramps up over time (simulate building habit)
    const ramp = 0.4 + (1 - i / days) * 0.9;
    const base = isWeekend ? 1 : 2;
    const count = Math.max(0, Math.round((base + rand() * 2) * ramp));

    for (let k = 0; k < count; k++) {
      const title = TITLE_POOL[Math.floor(rand() * TITLE_POOL.length)];
      const startHour = 6 + Math.floor(rand() * 14); // 6am – 8pm
      const startMin = [0, 15, 30, 45][Math.floor(rand() * 4)];
      const start = startHour * 60 + startMin;
      const dur = [25, 30, 45, 60, 75, 90][Math.floor(rand() * 6)];
      const end = Math.min(start + dur, 23 * 60 + 59);

      // Status: older events mostly done; recent ones mixed
      const ageDays = i;
      let status: RawEvent["status"];
      const r = rand();
      if (ageDays > 2) status = r < 0.78 ? "done" : r < 0.92 ? "missed" : "pending";
      else status = r < 0.55 ? "done" : r < 0.85 ? "pending" : "missed";

      events.push({
        id: `${isoDate(d)}-${k}`,
        title,
        date: isoDate(d),
        start_time: start,
        end_time: end,
        status,
        created_date: isoDate(d),
      });
    }
  }
  return events;
}

export function minsToHuman(m: number): string {
  if (m <= 0) return "0m";
  const h = Math.floor(m / 60),
    rem = m % 60;
  if (h === 0) return `${rem}m`;
  if (rem === 0) return `${h}h`;
  return `${h}h ${rem}m`;
}

export function minsToClock(m: number): string {
  const h = Math.floor(m / 60);
  const r = m % 60;
  const period = h >= 12 ? "pm" : "am";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${pad(r)}${period}`;
}

// Category classification
const CAT_RULES: { kw: string[]; name: string; targetHours: number }[] = [
  { kw: ["study", "course", "exam", "lecture", "revision"], name: "Study", targetHours: 12 },
  { kw: ["read", "book", "deep work"], name: "Reading", targetHours: 6 },
  { kw: ["workout", "gym", "run", "yoga", "cycling", "swim"], name: "Fitness", targetHours: 5 },
  { kw: ["standup", "review", "client", "code", "refactor", "project"], name: "Work", targetHours: 20 },
  { kw: ["meditat", "journal", "plan"], name: "Mindfulness", targetHours: 3 },
  { kw: ["lunch", "coffee", "break"], name: "Breaks", targetHours: 4 },
];

export function classify(title: string): string {
  const low = title.toLowerCase();
  for (const r of CAT_RULES) if (r.kw.some((k) => low.includes(k))) return r.name;
  return "Other";
}

export function categoryTarget(name: string): number {
  return CAT_RULES.find((r) => r.name === name)?.targetHours ?? 8;
}

// Streak calculation: based on when app was opened (stored in Supabase)
export function computeStreak(_events: RawEvent[], activeDays: Set<string>): { current: number; longest: number; activeDays: Set<string> } {
  let current = 0;
  const c = new Date();
  c.setHours(0, 0, 0, 0);
  c.setDate(c.getDate() - 1);
  while (activeDays.has(isoDate(c))) {
    current++;
    c.setDate(c.getDate() - 1);
  }
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (activeDays.has(isoDate(today))) {
    current++;
  }
  const sorted = [...activeDays].sort();
  let longest = 0,
    run = 0,
    prev = "";
  for (const d of sorted) {
    if (prev) {
      const gap = (new Date(d).getTime() - new Date(prev).getTime()) / 86_400_000;
      run = gap === 1 ? run + 1 : 1;
    } else run = 1;
    if (run > longest) longest = run;
    prev = d;
  }
  return { current, longest, activeDays };
}