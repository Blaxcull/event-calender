import { useEffect, useMemo, useRef, useState } from "react"
import type { DragEvent, MouseEvent } from "react"
import {
  addDays,
  differenceInCalendarDays,
  endOfMonth,
  format,
  isSameDay,
  isSameMonth,
  startOfMonth,
  startOfWeek,
} from "date-fns"
import { useNavigate, useParams } from "react-router-dom"
import { useTimeStore } from "@/store/timeStore"
import { useEventsStore, formatDate, getEventsForDatesSnapshot } from "@/store/eventsStore"
import type { CalendarEvent } from "@/store/eventsStore"
import { resolveGoalColorForEvent, useGoalsStore } from "@/store/goalsStore"
import { isSeriesActuallyRecurring, isSeriesAnchorEvent } from "@/store/recurringUtils"
import {
  getEventVisualColors,
  isAllDayEvent,
  isMultiDayEvent,
  isTimedMultiDayEvent,
} from "@/lib/eventUtils"

const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
const MAX_VISIBLE_EVENTS = 4
const MULTI_DAY_VISIBLE_LANES = 2
const MULTI_DAY_ITEM_HEIGHT = 22
const MULTI_DAY_LANE_PITCH = 24
const DATE_ROW_HEIGHT = 34
const MULTI_DAY_ROW_TOP_OFFSET = 4
const MULTI_DAY_ROW_BOTTOM_GAP = 6

const formatClock = (totalMinutes: number) => {
  const hour = Math.floor(totalMinutes / 60) % 24
  const minute = totalMinutes % 60
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`
}

const getEventLabel = (event: CalendarEvent) => {
  if (isTimedMultiDayEvent(event)) {
    return `${formatClock(event.start_time)} ${event.title}`
  }

  if (isAllDayEvent(event)) {
    return event.title
  }

  return `${formatClock(event.start_time)} ${event.title}`
}

const getTimedEventPieces = (event: CalendarEvent) => ({
  time: formatClock(event.start_time),
  title: event.title,
})

const getDateAtStartOfDay = (dateKey: string) => new Date(`${dateKey}T00:00:00`)
const withMiddayTime = (date: Date) =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate(), 12, 0, 0, 0)

const getMonthCellTone = (inCurrentMonth: boolean, isSelected: boolean) => {
  if (isSelected) return "bg-[#dcdcd9]"
  if (!inCurrentMonth) return "bg-[#dddddb]"
  return "bg-[#e2e2e1]"
}

const compareMonthEvents = (a: CalendarEvent, b: CalendarEvent) => {
  const aIsAllDay = isAllDayEvent(a)
  const bIsAllDay = isAllDayEvent(b)
  if (aIsAllDay !== bIsAllDay) return aIsAllDay ? -1 : 1

  const aIsMultiDay = isMultiDayEvent(a)
  const bIsMultiDay = isMultiDayEvent(b)
  if (aIsMultiDay !== bIsMultiDay) return aIsMultiDay ? -1 : 1

  if (a.start_time !== b.start_time) return a.start_time - b.start_time
  return a.title.localeCompare(b.title)
}

const compareMonthEventsWithPinnedDraft = (
  a: CalendarEvent,
  b: CalendarEvent,
  pinnedDraftEventId: string | null
) => {
  if (pinnedDraftEventId) {
    if (a.id === pinnedDraftEventId && b.id !== pinnedDraftEventId) return -1
    if (b.id === pinnedDraftEventId && a.id !== pinnedDraftEventId) return 1
  }

  return compareMonthEvents(a, b)
}

const prioritizeSelectedEvent = (
  events: CalendarEvent[],
  pinnedDraftEventId: string | null
) => {
  return [...events].sort((a, b) => compareMonthEventsWithPinnedDraft(a, b, pinnedDraftEventId))
}

const getDateFromSpanningClick = (
  eventClick: MouseEvent<HTMLElement>,
  visibleStartDateKey: string,
  spanDays: number
) => {
  if (spanDays <= 1) return withMiddayTime(getDateAtStartOfDay(visibleStartDateKey))
  const rect = eventClick.currentTarget.getBoundingClientRect()
  if (!rect.width || rect.width <= 0) return withMiddayTime(getDateAtStartOfDay(visibleStartDateKey))
  const boundedX = Math.max(0, Math.min(eventClick.clientX - rect.left, rect.width - 1))
  const dayWidth = rect.width / spanDays
  const dayOffset = Math.max(0, Math.min(spanDays - 1, Math.floor(boundedX / dayWidth)))
  return withMiddayTime(addDays(getDateAtStartOfDay(visibleStartDateKey), dayOffset))
}

type WeekSpanItem = {
  event: CalendarEvent
  lane: number
  startIdx: number
  spanDays: number
  visibleStartKey: string
  isPinnedDraft?: boolean
}

type DraggedMonthEvent = {
  eventId: string
  sourceDateKey: string
}

const MonthView = () => {
  const navigate = useNavigate()
  const { year, month, day } = useParams<{ year: string; month: string; day: string }>()
  const selectedDate = useTimeStore((state) => state.selectedDate)
  const setDate = useTimeStore((state) => state.setDate)
  const getEventById = useEventsStore((state) => state.getEventById)
  const addEventLocal = useEventsStore((state) => state.addEventLocal)
  const deleteEvent = useEventsStore((state) => state.deleteEvent)
  const selectedEventId = useEventsStore((state) => state.selectedEventId)
  const setSelectedEvent = useEventsStore((state) => state.setSelectedEvent)
  const showRecurringDialog = useEventsStore((state) => state.showRecurringDialog)
  const closeRecurringDialog = useEventsStore((state) => state.closeRecurringDialog)
  const updateAllInSeries = useEventsStore((state) => state.updateAllInSeries)
  const updateEvent = useEventsStore((state) => state.updateEvent)
  const splitRecurringEvent = useEventsStore((state) => state.splitRecurringEvent)
  const updateThisAndFollowing = useEventsStore((state) => state.updateThisAndFollowing)
  const goalsStore = useGoalsStore((state) => state.store)
  const [draggedEvent, setDraggedEvent] = useState<DraggedMonthEvent | null>(null)
  const [dragOverDateKey, setDragOverDateKey] = useState<string | null>(null)
  const suppressNextCellClickRef = useRef(false)
  const eventsCache = useEventsStore((state) => state.eventsCache)
  const recurringEventsCache = useEventsStore((state) => state.recurringEventsCache)
  const eventExceptionsCache = useEventsStore((state) => state.eventExceptionsCache)

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

  const monthEventsByDateKey = useMemo(() => {
    return getEventsForDatesSnapshot(
      monthDays,
      eventsCache,
      recurringEventsCache,
      eventExceptionsCache
    )
  }, [eventExceptionsCache, eventsCache, monthDays, recurringEventsCache])

  const pinnedDraftEventId = useMemo(() => {
    if (!selectedEventId) return null
    const selectedEvent = getEventById(selectedEventId)
    if (!selectedEvent?.isTemp) return null
    return selectedEvent.id
  }, [getEventById, selectedEventId])

  const pinnedDraftEvent = useMemo(() => {
    if (!pinnedDraftEventId) return null
    return getEventById(pinnedDraftEventId)
  }, [getEventById, pinnedDraftEventId])

  const weekLayouts = useMemo(() => {
    return visibleWeeks.map((week) => {
      const weekDateKeys = week.map((date) => formatDate(date))
      const firstWeekKey = weekDateKeys[0]
      const lastWeekKey = weekDateKeys[weekDateKeys.length - 1]
      const pinnedDraftVisibleInWeek =
        pinnedDraftEvent &&
        pinnedDraftEvent.date >= firstWeekKey &&
        pinnedDraftEvent.date <= lastWeekKey
          ? pinnedDraftEvent
          : null
      const weekDayIndexByKey: Record<string, number> = {}
      weekDateKeys.forEach((key, index) => {
        weekDayIndexByKey[key] = index
      })

      const seen = new Set<string>()
      const items: Array<{ event: CalendarEvent; startIdx: number; endIdx: number; visibleStartKey: string }> = []

      week.forEach((date) => {
        const events = monthEventsByDateKey[formatDate(date)] || []
        events.forEach((event) => {
          if (pinnedDraftEventId && event.id === pinnedDraftEventId) return
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
        const priorityDiff = compareMonthEventsWithPinnedDraft(
          a.event,
          b.event,
          pinnedDraftEventId
        )
        if (priorityDiff !== 0) return priorityDiff
        if (a.startIdx !== b.startIdx) return a.startIdx - b.startIdx
        const aSpan = a.endIdx - a.startIdx
        const bSpan = b.endIdx - b.startIdx
        if (aSpan !== bSpan) return bSpan - aSpan
        return a.event.start_time - b.event.start_time
      })

      const laneEnds: number[] = []
      const baseLaneOffset = pinnedDraftVisibleInWeek ? 1 : 0
      const positionedItems: WeekSpanItem[] = items.map((item) => {
        let lane = 0
        while (lane < laneEnds.length && item.startIdx <= laneEnds[lane]) lane += 1
        if (lane === laneEnds.length) laneEnds.push(item.endIdx)
        else laneEnds[lane] = item.endIdx

        return {
          event: item.event,
          lane: lane + baseLaneOffset,
          startIdx: item.startIdx,
          spanDays: item.endIdx - item.startIdx + 1,
          visibleStartKey: item.visibleStartKey,
        }
      })

      const allPositionedItems = pinnedDraftVisibleInWeek
        ? [
            {
              event: pinnedDraftVisibleInWeek,
              lane: 0,
              startIdx: weekDayIndexByKey[pinnedDraftVisibleInWeek.date],
              spanDays: 1,
              visibleStartKey: pinnedDraftVisibleInWeek.date,
              isPinnedDraft: true,
            } satisfies WeekSpanItem,
            ...positionedItems,
          ]
        : positionedItems

      const visibleLaneLimit = MULTI_DAY_VISIBLE_LANES + (pinnedDraftVisibleInWeek ? 1 : 0)
      const visibleItems = allPositionedItems.filter((item) => item.lane < visibleLaneLimit)
      const hiddenCount = Math.max(0, allPositionedItems.length - visibleItems.length)
      const highestVisibleLane = visibleItems.reduce((maxLane, item) => Math.max(maxLane, item.lane), -1)
      const visibleLaneCount = highestVisibleLane + 1
      const visibleMultiDayCountByDay = Array.from({ length: 7 }, (_, dayIndex) =>
        visibleItems.reduce((count, item) => {
          const itemEndIdx = item.startIdx + item.spanDays - 1
          if (dayIndex < item.startIdx || dayIndex > itemEndIdx) return count
          return count + 1
        }, 0)
      )
      const totalMultiDayCountByDay = Array.from({ length: 7 }, (_, dayIndex) =>
        allPositionedItems.reduce((count, item) => {
          const itemEndIdx = item.startIdx + item.spanDays - 1
          if (dayIndex < item.startIdx || dayIndex > itemEndIdx) return count
          return count + 1
        }, 0)
      )
      const multiDayHeightByDay = Array.from({ length: 7 }, (_, dayIndex) => {
        const highestLaneForDay = visibleItems.reduce((maxLane, item) => {
          const itemEndIdx = item.startIdx + item.spanDays - 1
          if (dayIndex < item.startIdx || dayIndex > itemEndIdx) return maxLane
          return Math.max(maxLane, item.lane)
        }, -1)

        if (highestLaneForDay < 0) return 0
        return highestLaneForDay * MULTI_DAY_LANE_PITCH + MULTI_DAY_ITEM_HEIGHT + MULTI_DAY_ROW_BOTTOM_GAP
      })
      const rowHeight =
        visibleItems.length > 0
          ? Math.max(
              MULTI_DAY_ITEM_HEIGHT,
              (visibleLaneCount - 1) * MULTI_DAY_LANE_PITCH + MULTI_DAY_ITEM_HEIGHT
            )
          : 0

      return {
        multiDayItems: visibleItems,
        multiDayRowHeight: rowHeight,
        multiDayHeightByDay,
        visibleMultiDayCountByDay,
        totalMultiDayCountByDay,
        hiddenMultiDayCount: hiddenCount,
      }
    })
  }, [monthEventsByDateKey, pinnedDraftEvent, pinnedDraftEventId, visibleWeeks])

  const openMonthDate = (date: Date) => {
    setDate(withMiddayTime(date))
    setSelectedEvent(null)
    navigate(`/month/${date.getFullYear()}/${date.getMonth() + 1}/${date.getDate()}`)
  }

  const openDayView = (date: Date) => {
    setDate(withMiddayTime(date))
    navigate(`/day/${date.getFullYear()}/${date.getMonth() + 1}/${date.getDate()}`)
  }

  const createEventForDate = (date: Date) => {
    const dateKey = formatDate(date)
    const now = new Date()
    const isToday = isSameDay(date, now)
    const startHour = isToday ? Math.min(now.getHours() + 1, 22) : 9
    const startMinutes = startHour * 60
    const endMinutes = startMinutes + 60

    setDate(withMiddayTime(date))
    const newEvent = addEventLocal({
      title: "New Event",
      date: dateKey,
      end_date: dateKey,
      start_time: startMinutes,
      end_time: endMinutes,
    })
    setSelectedEvent(newEvent.id)
  }

  const resetDragState = () => {
    setDraggedEvent(null)
    setDragOverDateKey(null)
  }

  const moveEventToDate = async (event: CalendarEvent, targetDateKey: string) => {
    const durationDays = Math.max(
      0,
      differenceInCalendarDays(
        getDateAtStartOfDay(event.end_date || event.date),
        getDateAtStartOfDay(event.date)
      )
    )

    const commit = {
      date: targetDateKey,
      end_date: formatDate(addDays(getDateAtStartOfDay(targetDateKey), durationDays)),
      start_time: event.start_time,
      end_time: event.end_time,
    }

    const isRecurringSourceEvent = isSeriesActuallyRecurring(event) || !!event.seriesMasterId
    if (isRecurringSourceEvent) {
      if (isSeriesAnchorEvent(event)) {
        const seriesMasterId = event.seriesMasterId || event.id
        await updateAllInSeries(seriesMasterId, commit)
        return
      }

      const occurrenceDate = event.occurrenceDate || event.date
      showRecurringDialog(event, "edit", async (choice: string) => {
        if (choice === "cancel") {
          closeRecurringDialog()
          return
        }

        if (choice === "only-this") {
          await splitRecurringEvent(
            event,
            occurrenceDate,
            commit.start_time,
            commit.end_time,
            commit
          )
        } else if (choice === "all-events") {
          const seriesMasterId = event.seriesMasterId || event.id
          await updateAllInSeries(seriesMasterId, commit)
        } else if (choice === "this-and-following") {
          await updateThisAndFollowing(
            event,
            occurrenceDate,
            commit.start_time,
            commit.end_time,
            commit
          )
        }

        closeRecurringDialog()
      })
      return
    }

    await updateEvent(event.id, commit)
  }

  const handleEventDragStart = (
    dragEvent: DragEvent<HTMLElement>,
    event: CalendarEvent,
    sourceDateKey: string
  ) => {
    dragEvent.stopPropagation()
    dragEvent.dataTransfer.effectAllowed = "move"
    dragEvent.dataTransfer.setData("text/plain", event.id)
    setDraggedEvent({
      eventId: event.id,
      sourceDateKey,
    })
  }

  const handleCellDragOver = (dragEvent: DragEvent<HTMLElement>, dateKey: string) => {
    if (!draggedEvent) return
    dragEvent.preventDefault()
    dragEvent.dataTransfer.dropEffect = "move"
    if (dragOverDateKey !== dateKey) {
      setDragOverDateKey(dateKey)
    }
  }

  const handleCellDrop = async (dragEvent: DragEvent<HTMLElement>, cellDate: Date) => {
    if (!draggedEvent) return

    dragEvent.preventDefault()
    dragEvent.stopPropagation()
    suppressNextCellClickRef.current = true

    const targetDateKey = formatDate(cellDate)
    const eventToMove = getEventById(draggedEvent.eventId)

    resetDragState()

    if (!eventToMove || draggedEvent.sourceDateKey === targetDateKey) return

    setDate(withMiddayTime(cellDate))
    setSelectedEvent(null)
    await moveEventToDate(eventToMove, targetDateKey)
  }

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || !selectedEventId) return

      const selectedEvent = getEventById(selectedEventId)
      if (!selectedEvent) return

      if (selectedEvent.title === "New Event") {
        void deleteEvent(selectedEvent.id)
        setSelectedEvent(null)
        return
      }

      const isRecurringDeleteTarget = !!(
        isSeriesActuallyRecurring(selectedEvent) ||
        (selectedEvent as any).seriesMasterId
      )

      if (isRecurringDeleteTarget) {
        const occurrenceDate = (selectedEvent as any).occurrenceDate || selectedEvent.date

        if (isSeriesAnchorEvent(selectedEvent as any)) {
          const seriesMasterId = (selectedEvent as any).seriesMasterId || selectedEvent.id
          void deleteEvent(seriesMasterId)
          setSelectedEvent(null)
          return
        }

        showRecurringDialog(selectedEvent as any, "delete", async (choice: string) => {
          if (choice === "cancel") {
            closeRecurringDialog()
            return
          }

          if (choice === "only-this") {
            const deleteSingleOccurrence = useEventsStore.getState().deleteSingleOccurrence
            await deleteSingleOccurrence(selectedEvent as any, occurrenceDate)
          } else if (choice === "all-events") {
            const seriesMasterId = (selectedEvent as any).seriesMasterId || selectedEvent.id
            await deleteEvent(seriesMasterId)
          } else if (choice === "this-and-following") {
            const seriesMasterId = (selectedEvent as any).seriesMasterId || selectedEvent.id
            const previousDay = (() => {
              const d = new Date(`${occurrenceDate}T00:00:00`)
              d.setDate(d.getDate() - 1)
              return formatDate(d)
            })()
            await updateAllInSeries(seriesMasterId, { series_end_date: previousDay })
          }

          setSelectedEvent(null)
          closeRecurringDialog()
        })
        return
      }

      void deleteEvent(selectedEvent.id)
      setSelectedEvent(null)
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [
    closeRecurringDialog,
    deleteEvent,
    getEventById,
    selectedEventId,
    setSelectedEvent,
    showRecurringDialog,
    updateAllInSeries,
  ])

  useEffect(() => {
    const clearDragState = () => {
      resetDragState()
    }

    window.addEventListener("dragend", clearDragState)
    return () => window.removeEventListener("dragend", clearDragState)
  }, [])

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
                      const visibleMultiDayCount = weekLayout.visibleMultiDayCountByDay?.[dayIndex] || 0
                      const hiddenMultiDayCountForDay = Math.max(
                        0,
                        (weekLayout.totalMultiDayCountByDay?.[dayIndex] || 0) - visibleMultiDayCount
                      )
                      const dayEvents = (monthEventsByDateKey[dateKey] || []).filter(
                        (event) => !isMultiDayEvent(event) && event.id !== pinnedDraftEventId
                      )
                      const orderedDayEvents = prioritizeSelectedEvent(dayEvents, pinnedDraftEventId)
                      const totalItemCount =
                        visibleMultiDayCount + hiddenMultiDayCountForDay + orderedDayEvents.length
                      const availableEventSlots = Math.max(0, MAX_VISIBLE_EVENTS - visibleMultiDayCount)
                      const shouldReserveMoreRow = totalItemCount >= MAX_VISIBLE_EVENTS
                      const visibleEventLimit = Math.max(
                        0,
                        shouldReserveMoreRow ? availableEventSlots - 1 : availableEventSlots
                      )
                      const visibleEvents = orderedDayEvents.slice(0, visibleEventLimit)
                      const hiddenCount = Math.max(
                        0,
                        hiddenMultiDayCountForDay + orderedDayEvents.length - visibleEvents.length
                      )
                      const isLastColumn = dayIndex === 6

                      return (
                        <div
                          key={dateKey}
                          role="button"
                          aria-label={format(cellDate, "MMMM d, yyyy")}
                          tabIndex={0}
                          onClick={() => {
                            if (suppressNextCellClickRef.current) {
                              suppressNextCellClickRef.current = false
                              return
                            }
                            openMonthDate(cellDate)
                          }}
                          onDoubleClick={() => openDayView(cellDate)}
                          onDragOver={(event) => handleCellDragOver(event, dateKey)}
                          onDragEnter={(event) => handleCellDragOver(event, dateKey)}
                          onDragLeave={() => {
                            if (dragOverDateKey === dateKey) {
                              setDragOverDateKey(null)
                            }
                          }}
                          onDrop={(event) => {
                            void handleCellDrop(event, cellDate)
                          }}
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
                          } ${
                            draggedEvent && dragOverDateKey === dateKey
                              ? "ring-2 ring-black/15 ring-inset bg-[#ecece8]"
                              : ""
                          }`}
                          style={{
                            paddingTop:
                              DATE_ROW_HEIGHT +
                              ((weekLayout.multiDayHeightByDay?.[dayIndex] || 0) > 0
                                ? MULTI_DAY_ROW_TOP_OFFSET + (weekLayout.multiDayHeightByDay?.[dayIndex] || 0)
                                : 0),
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

                          <div className="min-h-0 flex-1 space-y-0.5 overflow-hidden pt-0.5">
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
                                  draggable
                                  aria-label={`Open event ${getEventLabel(event)} on ${format(cellDate, "MMMM d, yyyy")}`}
                                  onDragStart={(dragEvent) =>
                                    handleEventDragStart(dragEvent, event, formatDate(cellDate))
                                  }
                                  onDragEnd={() => resetDragState()}
                                  onClick={(clickEvent) => {
                                    clickEvent.stopPropagation()
                                    setDate(cellDate)
                                    setSelectedEvent(event.id)
                                  }}
                                  className={`flex h-[22px] w-full items-center gap-1 overflow-hidden rounded-md px-1 text-left text-[11px] transition ${
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
                                        className="h-2 w-2 shrink-0 rounded-full"
                                        style={{ backgroundColor: isEventSelected ? "#ffffff" : accentColor }}
                                      />
                                      <span className="min-w-0 flex-1 truncate leading-none">
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
                                      <span className="min-w-0 flex-1 truncate leading-none font-medium">
                                        {getEventLabel(event)}
                                      </span>
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
                        top: DATE_ROW_HEIGHT + MULTI_DAY_ROW_TOP_OFFSET,
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
                            draggable
                            aria-label={`Open spanning event ${item.event.title} starting ${item.visibleStartKey}`}
                            onDragStart={(dragEvent) =>
                              handleEventDragStart(dragEvent, item.event, item.event.date)
                            }
                            onDragEnd={() => resetDragState()}
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
                            className="pointer-events-auto absolute flex items-center gap-2 overflow-hidden rounded-xl border px-3 text-left text-[12px] font-semibold"
                            style={{
                              top: item.lane * MULTI_DAY_LANE_PITCH,
                              left,
                              width,
                              height: MULTI_DAY_ITEM_HEIGHT,
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
                            <span className="min-w-0 flex-1 truncate text-[11px] leading-none">
                              {item.isPinnedDraft
                                ? getEventLabel(item.event)
                                : isTimedMultiDayEvent(item.event)
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
