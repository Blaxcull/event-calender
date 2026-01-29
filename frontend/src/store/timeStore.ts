import { create } from "zustand";

type DateInfo = {
  day: number;
  monthName: string;
  year: number;
  dayName: string;
  hours: number;
  minutes: number;
  seconds: number;
};

type TimeStore = {
  selectedDate: Date | null;
  dateInfo: DateInfo | null;

  setDate: (date: Date) => void;
  setToday: () => void;
  clearDate: () => void;
  updateTime: () => void;
};

const buildDateInfo = (d: Date): DateInfo => ({
  day: d.getDate(),
  monthName: d.toLocaleString("en-US", { month: "short" }),
  year: d.getFullYear(),
  dayName: d.toLocaleDateString("en-US", { weekday: "long" }),
  hours: d.getHours(),
  minutes: d.getMinutes(),
  seconds: d.getSeconds(),
});

export const useTimeStore = create<TimeStore>((set) => ({
  selectedDate: new Date(),
  dateInfo: buildDateInfo(new Date()),

  setDate: (date) =>
    set({
      selectedDate: date,
      dateInfo: buildDateInfo(date),
    }),

  setToday: () => {
    const now = new Date();
    set({
      selectedDate: now,
      dateInfo: buildDateInfo(now),
    });
  },

  clearDate: () =>
    set({
      selectedDate: null,
      dateInfo: null,
    }),

  updateTime: () => {
    const now = new Date();
    set((state) => ({
      dateInfo: buildDateInfo(now),
      selectedDate: state.selectedDate ? now : null,
    }));
  },
}));

