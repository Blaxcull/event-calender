import { useMemo } from "react"
import { addDays, endOfMonth, format, isSameDay, isSameMonth, startOfMonth, startOfWeek } from "date-fns"
import { useNavigate, useParams } from "react-router-dom"
import { useTimeStore } from "@/store/timeStore"
import { useEventsStore, formatDate } from "@/store/eventsStore"
import { resolveGoalColorForEvent, useGoalsStore } from "@/store/goalsStore"
import { getEventVisualColors, isAllDayEvent, isMultiDayEvent, isTimedMultiDayEvent } from "@/lib/eventUtils"

const WEEKDAY_LABELS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]
const MAX_VISIBLE_EVENTS = 4

const formatClock = (totalMinutes: number) => {
  const hour = Math.floor(totalMinutes / 60) % 24
  const minute = totalMinutes % 60
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`
}

const MonthView = () => {
  const navigate = useNavigate()
  const { year, month, day } = useParams<{ year: string; month: string; day: string }>()
  const selectedDate = useTimeStore((state) => state.selectedDate)
  const setDate = useTimeStore((state) => state.setDate)
  const getEventsForDate = useEventsStore((state) => state.getEventsForDate)
  const addEventLocal = useEventsStore((state) => state.addEventLocal)
  const selectedEventId = useEventsStore((state) => state.selectedEventId)
  const setSelectedEvent = useEventsStore((state) => state.setSelectedEvent)
  const goalsStore = useGoalsStore((state) => state.store)

  useEventsStore((state) => state.eventsCache)
  useEventsStore((state) => state.computedEventsCache)
  useEventsStore((state) => state.recurringEventsCache)
  useEventsStore((state) => state.eventExceptionsCache)

  const displayDate = useMemo(() => {
    const yearNum = year ? parseInt(year, 10) : NaN
    const monthNum = month ? parseInt(month, 10) - 1 : NaN
    const dayNum = day ? parseInt(day, 10) : NaN
    const routeDate = new Date(yearNum, monthNum, dayNum)
    const isValidRouteDate =
      !Number.isNaN(yearNum) &&
      !Number.isNaN(monthNum) &&
      !Number.isNaN(dayNum) &&
      routeDate.getFullYear() === yearNum &&
      routeDate.getMonth() === monthNum &&
      routeDate.getDate() === dayNum

    return isValidRouteDate ? routeDate : selectedDate || new Date()
  }, [day, month, selectedDate, year])

  const today = new Date()
  const monthStart = useMemo(() => startOfMonth(displayDate), [displayDate])
  const monthEnd = useMemo(() => endOfMonth(displayDate), [displayDate])
  const gridStart = useMemo(() => startOfWeek(monthStart, { weekStartsOn: 0 }), [monthStart])
  const monthDays = useMemo(
    () => Array.from({ length: 42 }, (_, index) => addDays(gridStart, index)),
    [gridStart]
  )
  const weeks = useMemo(
    () => Array.from({ length: 6 }, (_, index) => monthDays.slice(index * 7, index * 7 + 7)),
    [monthDays]
  )
  const visibleWeeks = useMemo(() => {
    const lastWeek = weeks[weeks.length - 1]
    if (!lastWeek) return weeks

    const isOnlyNextMonthDays = lastWeek.every(
      (date) => !isSameMonth(date, displayDate) && date > monthEnd
    )

    return isOnlyNextMonthDays ? weeks.slice(0, -1) : weeks
  }, [displayDate, monthEnd, weeks])

  const openMonthDate = (date: Date) => {
    setDate(date)
    setSelectedEvent(null)
    navigate(`/month/${date.getFullYear()}/${date.getMonth() + 1}/${date.getDate()}`)
  }

  const openDayView = (date: Date) => {
    setDate(date)
    navigate(`/day/${date.getFullYear()}/${date.getMonth() + 1}/${date.getDate()}`)
  }

  const createEventForDate = (date: Date) => {
    const dateKey = formatDate(date)
    const now = new Date()
    const isToday = isSameDay(date, now)
    const startHour = isToday ? Math.min(now.getHours() + 1, 22) : 9
    const startMinutes = startHour * 60
    const endMinutes = startMinutes + 60

    setDate(date)
    const newEvent = addEventLocal({
      title: "New Event",
      date: dateKey,
      end_date: dateKey,
      start_time: startMinutes,
      end_time: endMinutes,
    })
    setSelectedEvent(newEvent.id)
  }

  return (
    <div className="h-full w-full bg-[#f3f3f2] flex items-center justify-center overflow-hidden select-none">
      <div className="h-full w-full rounded-l-2xl bg-[#ececeb] shadow-xl flex flex-col overflow-hidden">
        <div className="px-9 pt-32 pb-3 border-b border-white/20 shrink-0 bg-[#ececeb]">
          <h1 className="text-6xl font-semibold tracking-tight text-neutral-800" style={{ fontFamily: "SF Pro Display Bold" }}>
            {format(displayDate, "MMMM")}
            <span className="ml-3 text-neutral-400" style={{ fontFamily: "SF Pro Display Regular", fontWeight: 400 }}>
              {format(displayDate, "yyyy")}
            </span>
          </h1>
        </div>

        <div className="flex-1 min-h-0 bg-[#e2e2e1]">
          <div
            className="grid h-full grid-cols-7 overflow-hidden border-black/5 bg-[#e2e2e1]"
            style={{ gridTemplateRows: `auto repeat(${visibleWeeks.length}, minmax(0, 1fr))` }}
          >
            {WEEKDAY_LABELS.map((label) => (
              <div
                key={label}
                className="border-b border-r last:border-r-0 border-black/5 px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-neutral-500 bg-[#e2e2e1]"
              >
                {label.slice(0, 3)}
              </div>
            ))}

            {visibleWeeks.map((week, weekIndex) =>
              week.map((cellDate, dayIndex) => {
                const dateKey = formatDate(cellDate)
                const isTodayCell = isSameDay(cellDate, today)
                const isSelected = selectedDate ? isSameDay(cellDate, selectedDate) : false
                const inCurrentMonth = isSameMonth(cellDate, displayDate)
                const events = getEventsForDate(cellDate)
                const visibleEvents = events.slice(0, MAX_VISIBLE_EVENTS)
                const hiddenCount = Math.max(0, events.length - visibleEvents.length)
                const isLastColumn = dayIndex === 6
                const isLastRow = weekIndex === visibleWeeks.length - 1

                return (
                  <div
                    key={dateKey}
                    role="button"
                    tabIndex={0}
                    onClick={() => openMonthDate(cellDate)}
                    onDoubleClick={() => openDayView(cellDate)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault()
                        openMonthDate(cellDate)
                      }
                    }}
                    className={`group min-h-0 flex flex-col px-2.5 py-2.5 outline-none transition-colors ${
                      isLastColumn ? "" : "border-r border-black/5"
                    } ${isLastRow ? "" : "border-b border-black/5"} ${
                      isSelected ? "bg-[#dcdcd9]" : "bg-transparent hover:bg-[#e9e9e7]"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 pb-2">
                      <div className="flex items-center gap-2">
                        <div
                          className={`h-8 min-w-8 rounded-full px-2 inline-flex items-center justify-center text-sm font-semibold ${
                            isTodayCell
                              ? "bg-black text-white"
                              : isSelected
                                ? "bg-[#e2e2e1] text-neutral-800"
                                : inCurrentMonth
                                  ? "text-neutral-800"
                                  : "text-neutral-400"
                          }`}
                        >
                          {cellDate.getDate()}
                        </div>
                        {!inCurrentMonth ? (
                          <span className="text-[11px] font-medium uppercase tracking-[0.14em] text-neutral-400">
                            {format(cellDate, "MMM")}
                          </span>
                        ) : null}
                      </div>

                      <button
                        type="button"
                        aria-label={`Add event on ${format(cellDate, "MMMM d")}`}
                        onClick={(event) => {
                          event.stopPropagation()
                          createEventForDate(cellDate)
                        }}
                        className="h-7 w-7 shrink-0 rounded-full text-neutral-500 hover:bg-black/5 hover:text-black opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity"
                      >
                        +
                      </button>
                    </div>

                    <div className="flex-1 min-h-0 space-y-1 overflow-hidden">
                      {visibleEvents.map((event) => {
                        const resolvedColor = event.goalColor || resolveGoalColorForEvent(goalsStore, event) || event.color
                        const { mutedBackgroundColor, textColor, accentColor, backgroundColor } = getEventVisualColors(resolvedColor)
                        const isAllDay = isAllDayEvent(event)
                        const isMultiDay = isMultiDayEvent(event)
                        const isTimedMultiDay = isTimedMultiDayEvent(event)
                        const isRecurring = !!event.isRecurringInstance || !!(event.repeat && event.repeat !== "None")
                        const isEventSelected = selectedEventId === event.id

                        return (
                          <button
                            key={event.id}
                            type="button"
                            onClick={(clickEvent) => {
                              clickEvent.stopPropagation()
                              setDate(cellDate)
                              setSelectedEvent(event.id)
                            }}
                            className={`w-full rounded-md px-2 py-[5px] text-left border transition-colors ${
                              isEventSelected ? "border-white shadow-sm" : "border-transparent hover:border-black/10"
                            }`}
                            style={{ backgroundColor: isEventSelected ? backgroundColor : mutedBackgroundColor }}
                          >
                            <div className="flex items-center gap-1.5 min-w-0">
                              <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: isEventSelected ? "#ffffff" : accentColor }} />
                              <span className="truncate text-[12px] font-semibold" style={{ color: textColor }}>
                                {isTimedMultiDay
                                  ? `${formatClock(event.start_time)}→${formatClock(event.end_time)} ${event.title}`
                                  : isAllDay
                                    ? event.title
                                    : `${formatClock(event.start_time)} ${event.title}`}
                              </span>
                            </div>
                            {(isRecurring || isMultiDay) && (
                              <div className="mt-0.5 truncate text-[10px] uppercase tracking-[0.12em]" style={{ color: textColor }}>
                                {isRecurring ? "Repeat" : ""}
                                {isRecurring && isMultiDay ? " · " : ""}
                                {isMultiDay ? "Multi day" : ""}
                              </div>
                            )}
                          </button>
                        )
                      })}

                      {hiddenCount > 0 ? (
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation()
                            openDayView(cellDate)
                          }}
                          className="px-2 py-1 text-left text-[11px] font-semibold text-neutral-500 hover:text-black"
                        >
                          {hiddenCount} more
                        </button>
                      ) : null}
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default MonthView
