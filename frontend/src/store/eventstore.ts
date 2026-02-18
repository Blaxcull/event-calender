import { create } from "zustand"

export type CalendarEvent = {
  id: string
  title: string
  date: string // YYYY-MM-DD
}

type EventState = {
  events: CalendarEvent[]
  addEvent: (event: CalendarEvent) => void
}

export const useEventStore = create<EventState>((set) => ({
  events: [],
  addEvent: (event) =>
    set((state) => ({ events: [...state.events, event] })),
}))
