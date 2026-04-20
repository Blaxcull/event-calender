import { useMemo } from "react"
import {
  addDays,
  endOfMonth,
  format,
  isSameDay,
  isSameMonth,
  startOfMonth,
  startOfWeek,
} from "date-fns"
import { useNavigate, useParams } from "react-router-dom"
import { useTimeStore } from "@/store/timeStore"
import { useEventsStore, formatDate } from "@/store/eventsStore"
import { resolveGoalColorForEvent, useGoalsStore } from "@/store/goalsStore"
import {
  getEventVisualColors,
  isAllDayEvent,
  isMultiDayEvent,
  isTimedMultiDayEvent,
} from "@/lib/eventUtils"

const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
const MAX_VISIBLE_EVENTS = 4
const MULTI_DAY_VISIBLE_LANES = 2
const MULTI_DAY_LANE_PITCH = 20
const DATE_ROW_HEIGHT = 28
const EVENT_BLOCK_TOP_GAP = 10

const formatClock = (totalMinutes: number) => {
  const hour = Math.floor(totalMinutes / 60) % 24
  const minute = totalMinutes % 60
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`
}

const getEventLabel = (event: any) => {
  if (isTimedMultiDayEvent(event)) {
    return `${formatClock(event.start_time)} ${event.title}`
  }

  if (isAllDayEvent(event)) {
    return event.title
  }

  return `${formatClock(event.start_time)} ${event.title}`
}

const getTimedEventPieces = (event: any) => ({
  time: formatClock(event.start_time),
  title: event.title,
})

const getMonthCellTone = (inCurrentMonth: boolean, isSelected: boolean) => {
  if (isSelected) return "bg-[#dcdcd9]"
  if (!inCurrentMonth) return "bg-[#dddddb]"
  return "bg-[#e2e2e1]"
}

const toDayStamp = (dateKey: string) => new Date(`${dateKey}T00:00:00`).getTime()

const daySpan = (from: string, to: string) =>
  Math.max(0, Math.floor((toDayStamp(to) - toDayStamp(from)) / 86400000))

const getDateFromSpanningClick = (
  eventClick: React.MouseEvent<HTMLElement>,
  visibleStartDateKey: string,
  spanDays: number
) => {
  if (spanDays <= 1) return new Date(`${visibleStartDateKey}T00:00:00`)
  const rect = eventClick.currentTarget.getBoundingClientRect()
  if (!rect.width || rect.width <= 0) return new Date(`${visibleStartDateKey}T00:00:00`)
  const boundedX = Math.max(0, Math.min(eventClick.clientX - rect.left, rect.width - 1))
  const dayWidth = rect.width / spanDays
  const dayOffset = Math.max(0, Math.min(spanDays - 1, Math.floor(boundedX / dayWidth)))
  return addDays(new Date(`${visibleStartDateKey}T00:00:00`), dayOffset)
}

type WeekSpanItem = {
  event: any
  lane: number
  startIdx: number
  spanDays: number
  visibleStartKey: string
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

  const weekLayouts = useMemo(() => {
    return visibleWeeks.map((week) => {
      const weekDateKeys = week.map((date) => formatDate(date))
      const firstWeekKey = weekDateKeys[0]
      const lastWeekKey = weekDateKeys[weekDateKeys.length - 1]
      const weekDayIndexByKey: Record<string, number> = {}
      weekDateKeys.forEach((key, index) => {
        weekDayIndexByKey[key] = index
      })

      const seen = new Set<string>()
      const items: Array<{ event: any; startIdx: number; endIdx: number; visibleStartKey: string }> = []

      week.forEach((date) => {
        const events = getEventsForDate(date)
        events.forEach((event) => {
          if (!isMultiDayEvent(event)) return

          const eventStartKey = event.date
          const eventEndKey = event.end_date || event.date
          if (eventEndKey < firstWeekKey || eventStartKey > lastWeekKey) return
          if (seen.has(event.id)) return
          seen.add(event.id)

          const visibleStartKey = eventStartKey < firstWeekKey ? firstWeekKey : eventStartKey
          const visibleEndKey = eventEndKey > lastWeekKey ? lastWeekKey : eventEndKey
          const startIdx = weekDayIndexByKey[visibleStartKey]
          const endIdx = weekDayIndexByKey[visibleEndKey]

          items.push({
            event,
            startIdx,
            endIdx,
            visibleStartKey,
          })
        })
      })

      items.sort((a, b) => {
        if (a.startIdx !== b.startIdx) return a.startIdx - b.startIdx
        const aSpan = a.endIdx - a.startIdx
        const bSpan = b.endIdx - b.startIdx
        if (aSpan !== bSpan) return bSpan - aSpan
        return a.event.start_time - b.event.start_time
      })

      const laneEnds: number[] = []
      const positionedItems: WeekSpanItem[] = items.map((item) => {
        let lane = 0
        while (lane < laneEnds.length && item.startIdx <= laneEnds[lane]) lane += 1
        if (lane === laneEnds.length) laneEnds.push(item.endIdx)
        else laneEnds[lane] = item.endIdx

        return {
          event: item.event,
          lane,
          startIdx: item.startIdx,
          spanDays: item.endIdx - item.startIdx + 1,
          visibleStartKey: item.visibleStartKey,
        }
      })

      const visibleItems = positionedItems.filter((item) => item.lane < MULTI_DAY_VISIBLE_LANES)
      const hiddenCount = Math.max(0, positionedItems.length - visibleItems.length)
      const rowHeight =
        visibleItems.length > 0
          ? Math.max(20, Math.min(MULTI_DAY_VISIBLE_LANES, laneEnds.length) * MULTI_DAY_LANE_PITCH + 2)
          : 0

      return {
        multiDayItems: visibleItems,
        multiDayRowHeight: rowHeight,
        hiddenMultiDayCount: hiddenCount,
      }
    })
  }, [getEventsForDate, visibleWeeks])

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
          <h1 className="text-6xl font-semibold tracking-tight text-neutral-800">
            <span style={{ fontFamily: "SF Pro Display Bold" }}>{format(displayDate, "MMMM")}</span>
            <span
              className="ml-3 text-neutral-400"
              style={{ fontFamily: "SF Pro Display Regular", fontWeight: 400 }}
            >
              {format(displayDate, "yyyy")}
            </span>
          </h1>
        </div>

        <div className="flex min-h-0 flex-1 flex-col bg-[#e2e2e1] px-1 pb-1">
          <div className="grid grid-cols-7 shrink-0 overflow-hidden rounded-tl-2xl bg-[#e2e2e1]">
            {WEEKDAY_LABELS.map((label, index) => (
              <div
                key={label}
                className={`flex h-[38px] items-center justify-center border-b border-black/5 px-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-neutral-500 bg-[#e2e2e1] ${
                  index === 6 ? "" : "border-r border-black/5"
                }`}
              >
                {label}
              </div>
            ))}
          </div>

          <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-bl-2xl rounded-tl-2xl">
            {visibleWeeks.map((week, weekIndex) => {
              const weekLayout = weekLayouts[weekIndex]
              const isLastWeek = weekIndex === visibleWeeks.length - 1

              return (
                <div
                  key={`week-${weekIndex}`}
                  className={`relative flex min-h-0 flex-1 flex-col ${isLastWeek ? "" : "border-b border-black/5"}`}
                >
                  <div className="grid min-h-0 flex-1 grid-cols-7">
                    {week.map((cellDate, dayIndex) => {
                      const dateKey = formatDate(cellDate)
                      const inCurrentMonth = isSameMonth(cellDate, displayDate)
                      const isTodayCell = isSameDay(cellDate, today)
                      const isSelected = selectedDate ? isSameDay(cellDate, selectedDate) : false
                      const dayEvents = getEventsForDate(cellDate).filter((event) => !isMultiDayEvent(event))
                      const visibleEvents = dayEvents.slice(0, MAX_VISIBLE_EVENTS)
                      const hiddenCount = Math.max(0, dayEvents.length - visibleEvents.length)
                      const isLastColumn = dayIndex === 6

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
                          className={`group relative flex min-h-0 flex-col px-1.5 pb-1 text-left outline-none transition-colors ${
                            isLastColumn ? "" : "border-r border-black/5"
                          } ${getMonthCellTone(inCurrentMonth, isSelected)} ${
                            isSelected ? "" : "hover:bg-[#e9e9e7]"
                          }`}
                          style={{
                            paddingTop:
                              DATE_ROW_HEIGHT +
                              EVENT_BLOCK_TOP_GAP +
                              (weekLayout.multiDayRowHeight > 0 ? weekLayout.multiDayRowHeight : 0),
                          }}
                        >
                          <div className="absolute inset-x-0 top-0 z-20 flex items-center justify-between gap-1.5 px-1.5 pt-1">
                            <div className="flex items-center gap-1">
                              <span
                                className={`inline-flex h-7 min-w-7 items-center justify-center rounded-full px-1.5 text-[13px] font-semibold ${
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
                              </span>
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
                              className="h-5 w-5 shrink-0 rounded-full text-sm text-neutral-500 opacity-0 transition-opacity hover:bg-black/5 hover:text-black group-hover:opacity-100 focus:opacity-100"
                            >
                              +
                            </button>
                          </div>

                          <div className="min-h-0 flex-1 space-y-0.5 overflow-hidden">
                            {visibleEvents.map((event) => {
                              const resolvedColor =
                                event.goalColor || resolveGoalColorForEvent(goalsStore, event) || event.color
                              const { mutedBackgroundColor, textColor, accentColor, backgroundColor } =
                                getEventVisualColors(resolvedColor)
                              const isEventSelected = selectedEventId === event.id
                              const isAllDay = isAllDayEvent(event)
                              const isTimedMultiDay = isTimedMultiDayEvent(event)
                              const timedPieces = !isAllDay && !isTimedMultiDay ? getTimedEventPieces(event) : null

                              return (
                                <button
                                  key={event.id}
                                  type="button"
                                  onClick={(clickEvent) => {
                                    clickEvent.stopPropagation()
                                    setDate(cellDate)
                                    setSelectedEvent(event.id)
                                  }}
                                  className={`flex w-full items-center gap-1 overflow-hidden rounded-md px-1 py-[2px] text-left text-[11px] leading-4 transition ${
                                    isEventSelected ? "border-white shadow-sm" : "hover:border-black/10"
                                  }`}
                                  style={{
                                    backgroundColor:
                                      isAllDay || isTimedMultiDay
                                        ? isEventSelected
                                          ? backgroundColor
                                          : mutedBackgroundColor
                                        : "transparent",
                                    color: textColor,
                                    borderWidth: 1,
                                    borderStyle: "solid",
                                    borderColor: isEventSelected ? "#ffffff" : "transparent",
                                  }}
                                >
                                  {timedPieces ? (
                                    <>
                                      <span
                                        className="mt-[1px] h-2 w-2 shrink-0 rounded-full"
                                        style={{ backgroundColor: isEventSelected ? "#ffffff" : accentColor }}
                                      />
                                      <span className="truncate">
                                        <span className="mr-1 font-medium">{timedPieces.time}</span>
                                        <span>{timedPieces.title}</span>
                                      </span>
                                    </>
                                  ) : (
                                    <>
                                      <span
                                        className="h-2 w-2 shrink-0 rounded-full"
                                        style={{ backgroundColor: isEventSelected ? "#ffffff" : accentColor }}
                                      />
                                      <span className="truncate font-medium">{getEventLabel(event)}</span>
                                    </>
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
                    })}
                  </div>

                  {weekLayout.multiDayRowHeight > 0 ? (
                    <div
                      className="pointer-events-none absolute inset-x-0 z-10"
                      style={{
                        top: DATE_ROW_HEIGHT + EVENT_BLOCK_TOP_GAP - 2,
                        height: weekLayout.multiDayRowHeight,
                      }}
                    >
                      {weekLayout.multiDayItems.map((item) => {
                        const resolvedColor =
                          item.event.goalColor ||
                          resolveGoalColorForEvent(goalsStore, item.event) ||
                          item.event.color
                        const { backgroundColor, mutedBackgroundColor, textColor, accentColor } =
                          getEventVisualColors(resolvedColor)
                        const isEventSelected = selectedEventId === item.event.id
                        const left = `${(item.startIdx / 7) * 100}%`
                        const width = `${(item.spanDays / 7) * 100}%`

                        return (
                          <button
                            key={item.event.id}
                            type="button"
                            onClick={(eventClick) => {
                              eventClick.stopPropagation()
                              const clickedDate = getDateFromSpanningClick(
                                eventClick,
                                item.visibleStartKey,
                                item.spanDays
                              )
                              setDate(clickedDate)
                              setSelectedEvent(item.event.id)
                            }}
                            className="pointer-events-auto absolute flex items-center gap-2 overflow-hidden rounded-xl border px-3 py-1 text-left text-[12px] font-semibold"
                            style={{
                              top: item.lane * MULTI_DAY_LANE_PITCH + 1,
                              left,
                              width,
                              backgroundColor: isEventSelected ? backgroundColor : mutedBackgroundColor,
                              color: textColor,
                              borderColor: isEventSelected ? "#ffffff" : "transparent",
                              boxShadow: isEventSelected ? "0 1px 2px rgba(0,0,0,0.08)" : "none",
                            }}
                          >
                            <span
                              className="h-2 w-2 shrink-0 rounded-full"
                              style={{ backgroundColor: isEventSelected ? "#ffffff" : accentColor }}
                            />
                            <span className="truncate text-[11px] leading-4">
                              {isTimedMultiDayEvent(item.event)
                                ? `${formatClock(item.event.start_time)} ${item.event.title}`
                                : item.event.title}
                            </span>
                          </button>
                        )
                      })}

                      {weekLayout.hiddenMultiDayCount > 0 ? (
                        <div className="absolute bottom-1 right-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-neutral-500">
                          +{weekLayout.hiddenMultiDayCount} more
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}

export default MonthView
