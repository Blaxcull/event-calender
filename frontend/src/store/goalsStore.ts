import { create } from "zustand";
import { supabase } from "@/lib/supabase";
import type { Goal } from "@/Goal_view/goal";
import type { Event } from "@/store/eventsStore";

export type GoalColumnType = "week" | "month" | "year" | "life";

export interface GoalBoardItem {
  id: string;
  text: string;
  completed: boolean;
  notes?: string;
  color?: string;
  icon?: string;
  targetValue?: number;
  targetPeriod?: Goal["targetPeriod"];
  status?: Goal["status"];
}

export type GoalBoardStore = Record<string, GoalBoardItem[]>;

const EVENT_GOAL_TYPE_TO_COLUMN: Record<string, GoalColumnType | null> = {
  Weekly: "week",
  Monthly: "month",
  Yearly: "year",
  Lifetime: "life",
  None: null,
};

interface GoalRow {
  id: string;
  user_id: string;
  name: string;
  notes: string | null;
  color: string;
  icon: string;
  target_value: number;
  target_period: Goal["targetPeriod"];
  status: Goal["status"];
  completed: boolean;
  column_type: GoalColumnType;
  bucket_key: string;
  sort_order: number;
}

interface GoalsState {
  store: GoalBoardStore;
  userId: string | null;
  isLoadingCurrent: boolean;
  isLoadingAll: boolean;
  goalsError: string | null;
  hasPrefetchedCurrent: boolean;
  hasLoadedAll: boolean;
  setStore: (store: GoalBoardStore) => void;
  setGoalsError: (error: string | null) => void;
  clearGoals: () => void;
  fetchGoalBuckets: (keys: string[]) => Promise<void>;
  prefetchCurrentGoals: (currentDate?: Date, yearDate?: Date) => Promise<void>;
  fetchAllGoals: () => Promise<void>;
}

export const getGoalBucketKey = (type: GoalColumnType, date: Date): string => {
  if (type === "life") return "life";
  if (type === "year") return `year-${date.getFullYear()}`;
  if (type === "month") return `month-${date.getFullYear()}-${date.getMonth()}`;
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  return `week-${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
};

export function resolveGoalColorForEvent(
  goalsStore: GoalBoardStore,
  event: Pick<Event, "date" | "goalType" | "goal" | "goalColor">
): string | undefined {
  if (event.goalColor) return event.goalColor;
  if (!event.goalType || !event.goal || event.goal === "None") return undefined;

  const columnType = EVENT_GOAL_TYPE_TO_COLUMN[event.goalType] ?? null;
  if (!columnType) return undefined;

  const eventDate = new Date(`${event.date}T00:00:00`);
  const bucketKey = columnType === "life" ? "life" : getGoalBucketKey(columnType, eventDate);
  const goal = goalsStore[bucketKey]?.find((item) => item.text === event.goal);

  return goal?.color;
}

export function resolveGoalIconForEvent(
  goalsStore: GoalBoardStore,
  event: Pick<Event, "date" | "goalType" | "goal" | "goalIcon">
): string | undefined {
  if (event.goalIcon) return event.goalIcon;
  if (!event.goalType || !event.goal || event.goal === "None") return undefined;

  const columnType = EVENT_GOAL_TYPE_TO_COLUMN[event.goalType] ?? null;
  if (!columnType) return undefined;

  const eventDate = new Date(`${event.date}T00:00:00`);
  const bucketKey = columnType === "life" ? "life" : getGoalBucketKey(columnType, eventDate);
  const goal = goalsStore[bucketKey]?.find((item) => item.text === event.goal);

  return goal?.icon;
}

const rowToGoalItem = (row: GoalRow): GoalBoardItem => ({
  id: row.id,
  text: row.name,
  completed: row.completed,
  notes: row.notes ?? undefined,
  color: row.color || undefined,
  icon: row.icon || undefined,
  targetValue: row.target_value,
  targetPeriod: row.target_period,
  status: row.status,
});

const buildStoreFromRows = (rows: GoalRow[]): GoalBoardStore => {
  return rows.reduce<GoalBoardStore>((acc, row) => {
    const key = row.bucket_key;
    if (!acc[key]) acc[key] = [];
    acc[key].push(rowToGoalItem(row));
    return acc;
  }, {});
};

export const useGoalsStore = create<GoalsState>((set, get) => ({
  store: {},
  userId: null,
  isLoadingCurrent: false,
  isLoadingAll: false,
  goalsError: null,
  hasPrefetchedCurrent: false,
  hasLoadedAll: false,

  setStore: (store) => set({ store }),
  setGoalsError: (goalsError) => set({ goalsError }),

  clearGoals: () =>
    set({
      store: {},
      userId: null,
      isLoadingCurrent: false,
      isLoadingAll: false,
      goalsError: null,
      hasPrefetchedCurrent: false,
      hasLoadedAll: false,
    }),

  fetchGoalBuckets: async (keys) => {
    const uniqueKeys = Array.from(new Set(keys)).filter(Boolean);
    if (uniqueKeys.length === 0) return;

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError) {
      set({ goalsError: userError.message });
      return;
    }

    if (!user) {
      get().clearGoals();
      return;
    }

    const { data, error } = await supabase
      .from("goals")
      .select("*")
      .eq("user_id", user.id)
      .in("bucket_key", uniqueKeys)
      .order("bucket_key", { ascending: true })
      .order("sort_order", { ascending: true });

    if (error) {
      set({
        userId: user.id,
        goalsError: error.message,
      });
      return;
    }

    const partialStore = buildStoreFromRows((data ?? []) as GoalRow[]);

    set((state) => {
      const nextStore = { ...state.store };
      for (const key of uniqueKeys) {
        nextStore[key] = partialStore[key] ?? [];
      }

      return {
        store: nextStore,
        userId: user.id,
        goalsError: null,
      };
    });
  },

  prefetchCurrentGoals: async (currentDate = new Date(), yearDate = currentDate) => {
    const currentKeys = [
      getGoalBucketKey("week", currentDate),
      getGoalBucketKey("month", currentDate),
      getGoalBucketKey("year", yearDate),
      "life",
    ];

    set({ isLoadingCurrent: true, goalsError: null });

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError) {
      set({ isLoadingCurrent: false, goalsError: userError.message });
      return;
    }

    if (!user) {
      get().clearGoals();
      return;
    }

    const { data, error } = await supabase
      .from("goals")
      .select("*")
      .eq("user_id", user.id)
      .in("bucket_key", currentKeys)
      .order("bucket_key", { ascending: true })
      .order("sort_order", { ascending: true });

    if (error) {
      set({
        userId: user.id,
        isLoadingCurrent: false,
        goalsError: error.message,
      });
      return;
    }

    const partialStore = buildStoreFromRows((data ?? []) as GoalRow[]);

    set((state) => {
      const nextStore = { ...state.store };
      for (const key of currentKeys) {
        nextStore[key] = partialStore[key] ?? [];
      }

      return {
        store: nextStore,
        userId: user.id,
        isLoadingCurrent: false,
        goalsError: null,
        hasPrefetchedCurrent: true,
      };
    });
  },

  fetchAllGoals: async () => {
    if (get().isLoadingAll) return;

    set({ isLoadingAll: true, goalsError: null });

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError) {
      set({ isLoadingAll: false, goalsError: userError.message });
      return;
    }

    if (!user) {
      get().clearGoals();
      return;
    }

    const { data, error } = await supabase
      .from("goals")
      .select("*")
      .eq("user_id", user.id)
      .order("bucket_key", { ascending: true })
      .order("sort_order", { ascending: true });

    if (error) {
      set({
        userId: user.id,
        isLoadingAll: false,
        goalsError: error.message,
      });
      return;
    }

    set({
      store: buildStoreFromRows((data ?? []) as GoalRow[]),
      userId: user.id,
      isLoadingAll: false,
      goalsError: null,
      hasPrefetchedCurrent: true,
      hasLoadedAll: true,
    });
  },
}));
