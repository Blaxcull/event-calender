import { useMemo, useRef, useEffect, useState } from "react"
import { addDays, format, startOfWeek } from "date-fns"
import { useTimeStore } from "@/store/timeStore"
import { useEventsStore, formatDate } from "@/store/eventsStore"
import { resolveGoalColorForEvent, useGoalsStore } from "@/store/goalsStore"
import { TOP_DEAD_ZONE, SLOT_HEIGHT, addEventOnClick, calculateEventPositions, getClockwiseDurationMinutes, getEventVisualColors, storeEventToUIEvent, uiEventToStoreEvent } from "@/lib/eventUtils"

const hourSlots = Array.from({ length: 24 }, (_, i) => i)
const gridLines = Array.from({ length: 23 }, (_, i) => i)

const isAllDayLike = (event: { is_all_day?: boolean; start_time: number; end_time: number }) => {
  const durationMinutes = event.end_time >= event.start_time
    ? event.end_time - event.start_time
    : (1440 - event.start_time) + event.end_time
  return !!event.is_all_day || durationMinutes >= 1440
}

const isSpanningTopEvent = (event: { date: string; end_date?: string | null; is_all_day?: boolean; start_time: number; end_time: number }) => {
  const endDate = event.end_date || event.date
  return endDate > event.date
}

const formatTime = (minutes: number) => {
  const h = Math.floor(minutes / 60) % 24
  const m = minutes % 60
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`
}

const WeekView = () => {
  const selectedDate = useTimeStore((state) => state.selectedDate)
  const setDate = useTimeStore((state) => state.setDate)
  const getEventsForDate = useEventsStore((state) => state.getEventsForDate)
  const addEventLocal = useEventsStore((state) => state.addEventLocal)
  const deleteEvent = useEventsStore((state) => state.deleteEvent)
  const updateEventFields = useEventsStore((state) => state.updateEventFields)
  const setSelectedEvent = useEventsStore((state) => state.setSelectedEvent)
  const selectedEventId = useEventsStore((state) => state.selectedEventId)
  const getEventById = useEventsStore((state) => state.getEventById)
  const eventsCache = useEventsStore((state) => state.eventsCache)
  const computedEventsCache = useEventsStore((state) => state.computedEventsCache)
  const recurringEventsCache = useEventsStore((state) => state.recurringEventsCache)
  const eventExceptionsCache = useEventsStore((state) => state.eventExceptionsCache)
  const goalsStore = useGoalsStore((state) => state.store)
  const scrollRef = useRef<HTMLDivElement>(null)
  const stickyHeaderRef = useRef<HTMLDivElement>(null)
  const suppressNextClickRef = useRef(false)
  const dayColumnRefs = useRef<Record<string, HTMLDivElement | null>>({})
  const [previewById, setPreviewById] = useState<Record<string, { date: string; start_time: number; end_time: number }>>({})
  const [dragState, setDragState] = useState<{ id: string; duration: number; offsetMinutes: number } | null>(null)
  const [pendingDrag, setPendingDrag] = useState<{ id: string; duration: number; offsetMinutes: number; startX: number; startY: number; date: string; start: number } | null>(null)
  const [resizeState, setResizeState] = useState<{ id: string; start: number; date: string } | null>(null)
  const [horizontalResizeState, setHorizontalResizeState] = useState<{
    id: string
    startDate: string
    start_time: number
    end_time: number
  } | null>(null)
  const [dismissedEventIds, setDismissedEventIds] = useState<Set<string>>(new Set())
  const [now, setNow] = useState(new Date())
  const [showAllTopEvents, setShowAllTopEvents] = useState(true)
  const interactionOriginalRef = useRef<Record<string, { date: string; end_date: string; start_time: number; end_time: number }>>({})

  const weekStart = useMemo(() => {
    const base = selectedDate || new Date()
    return startOfWeek(base, { weekStartsOn: 0 })
  }, [selectedDate])

  const weekDays = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)),
    [weekStart]
  )
  const weekDateKeys = useMemo(() => weekDays.map((d) => formatDate(d)), [weekDays])
  const weekDayIndexByKey = useMemo(() => {
    const map: Record<string, number> = {}
    weekDateKeys.forEach((key, idx) => {
      map[key] = idx
    })
    return map
  }, [weekDateKeys])
  const todayKey = formatDate(now)
  const nowMinutes = now.getHours() * 60 + now.getMinutes()
  const nowLineTop = TOP_DEAD_ZONE + (nowMinutes / 60) * SLOT_HEIGHT

  const topRowLayout = useMemo(() => {
    const baseByDay: Record<string, any[]> = Object.fromEntries(weekDateKeys.map((k) => [k, []]))
    const seen = new Set<string>()

    weekDays.forEach((day) => {
      const dayKey = formatDate(day)
      const events = getEventsForDate(day)
      events.forEach((event) => {
        if (!(isAllDayLike(event as any) || isSpanningTopEvent(event as any))) return
        const startKey = event.date
        const endKey = event.end_date || event.date
        const isSpan = endKey > startKey
        if (isSpan && startKey !== dayKey) return
        if (!weekDayIndexByKey.hasOwnProperty(startKey)) return
        if (seen.has(event.id)) return
        seen.add(event.id)
        baseByDay[startKey].push(event)
      })
    })

    Object.keys(baseByDay).forEach((key) => {
      baseByDay[key].sort((a, b) => {
        const aEnd = a.end_date || a.date
        const bEnd = b.end_date || b.date
        const aIsMultiDay = aEnd > a.date
        const bIsMultiDay = bEnd > b.date
        if (aIsMultiDay && !bIsMultiDay) return -1
        if (!aIsMultiDay && bIsMultiDay) return 1
        return a.start_time - b.start_time
      })
    })

    const visibleByDay: Record<string, any[]> = {}
    weekDateKeys.forEach((key) => {
      visibleByDay[key] = baseByDay[key] || []
    })

    const flattened = weekDateKeys.flatMap((key) =>
      (visibleByDay[key] || []).map((event) => {
        const startIdx = weekDayIndexByKey[key]
        const endKey = event.end_date || event.date
        const endIdxRaw = weekDayIndexByKey[endKey]
        const endIdx = endIdxRaw === undefined ? 6 : Math.max(startIdx, Math.min(6, endIdxRaw))
        return { event, startKey: key, startIdx, endIdx, span: endIdx - startIdx + 1 }
      })
    )

    flattened.sort((a, b) => {
      if (a.startIdx !== b.startIdx) return a.startIdx - b.startIdx
      if (a.span !== b.span) return b.span - a.span
      return a.event.start_time - b.event.start_time
    })

    const laneEnds: number[] = []
    const laneByEventId: Record<string, number> = {}
    flattened.forEach((item) => {
      let lane = 0
      while (lane < laneEnds.length && item.startIdx <= laneEnds[lane]) lane += 1
      if (lane === laneEnds.length) laneEnds.push(item.endIdx)
      else laneEnds[lane] = item.endIdx
      laneByEventId[item.event.id] = lane
    })

    const visibleLaneLimit = showAllTopEvents ? laneEnds.length : 2
    const allEventIds = new Set(flattened.map((f) => f.event.id))
    const hiddenIds = new Set<string>()
    if (!showAllTopEvents) {
      Object.entries(laneByEventId).forEach(([eventId, lane]) => {
        if (lane >= 2) hiddenIds.add(eventId)
      })
    }

    weekDateKeys.forEach((key) => {
      visibleByDay[key] = visibleByDay[key].filter((event) => {
        if (!allEventIds.has(event.id)) return false
        return showAllTopEvents || (laneByEventId[event.id] ?? 0) < 2
      })
    })

    const rowHeight = Math.max(34, Math.max(visibleLaneLimit, 1) * 22 + 8)

    const hiddenCount = hiddenIds.size
    const totalLaneCount = laneEnds.length
    const hasAnyMore = totalLaneCount > 2

    return {
      allByDay: baseByDay,
      visibleByDay,
      laneByEventId,
      rowHeight,
      hasAnyMore,
      hiddenCount,
    }
  }, [weekDays, weekDateKeys, weekDayIndexByKey, getEventsForDate, showAllTopEvents, eventsCache, computedEventsCache, recurringEventsCache, eventExceptionsCache])

  const timedWeekEvents = useMemo(() => {
    const unique = new Map<string, any>()
    weekDays.forEach((day) => {
      getEventsForDate(day).forEach((event) => {
        const endDate = event.end_date || event.date
        const isMultiDay = endDate > event.date
        if (!isAllDayLike(event) && !isMultiDay) unique.set(event.id, event)
      })
    })
    return Array.from(unique.values()).filter((event) => !dismissedEventIds.has(event.id))
  }, [getEventsForDate, weekDays, goalsStore, selectedEventId, dismissedEventIds, eventsCache, computedEventsCache, recurringEventsCache, eventExceptionsCache])

  useEffect(() => {
    if (!selectedEventId) return
    const selectedEvent = getEventById(selectedEventId)
    if (!selectedEvent) return
    const endDate = selectedEvent.end_date || selectedEvent.date
    const isMultiDay = endDate > selectedEvent.date
    if (selectedEvent.is_all_day || isMultiDay) {
      setShowAllTopEvents(true)
    }
  }, [selectedEventId, eventsCache, getEventById])

  useEffect(() => {
    if (dismissedEventIds.size === 0) return
    const existingIds = new Set<string>()
    weekDays.forEach((day) => {
      getEventsForDate(day).forEach((event) => existingIds.add(event.id))
    })
    setDismissedEventIds((prev) => {
      const next = new Set<string>()
      prev.forEach((id) => {
        if (existingIds.has(id)) next.add(id)
      })
      return next
    })
  }, [weekDays, getEventsForDate, selectedDate, eventsCache])

  const scrollToEventTime = (startMinutes: number) => {
    if (!scrollRef.current) return
    const top = TOP_DEAD_ZONE + (startMinutes / 60) * SLOT_HEIGHT - 24
    scrollRef.current.scrollTo({ top: Math.max(0, top), behavior: "auto" })
  }

  const scrollToEventElement = (el: HTMLElement) => {
    if (!scrollRef.current) return
    const stickyHeight = stickyHeaderRef.current?.offsetHeight ?? 0
    const containerRect = scrollRef.current.getBoundingClientRect()
    const eventRect = el.getBoundingClientRect()
    const absoluteTop = eventRect.top - containerRect.top + scrollRef.current.scrollTop
    const nextTop = absoluteTop - stickyHeight - 8
    scrollRef.current.scrollTo({ top: Math.max(0, nextTop), behavior: "auto" })
  }

  useEffect(() => {
    const timer = window.setInterval(() => {
      setNow(new Date())
    }, 60_000)
    return () => window.clearInterval(timer)
  }, [])

  const snapToQuarter = (minutes: number) => Math.round(minutes / 15) * 15
  const toDayStamp = (dateKey: string) => new Date(`${dateKey}T00:00:00`).getTime()
  const daySpan = (from: string, to: string) => Math.max(0, Math.floor((toDayStamp(to) - toDayStamp(from)) / 86400000))

  const findDayByClientX = (clientX: number) => {
    for (const dayKey of weekDateKeys) {
      const el = dayColumnRefs.current[dayKey]
      if (!el) continue
      const rect = el.getBoundingClientRect()
      if (clientX >= rect.left && clientX <= rect.right) return { dayKey, el }
    }
    return null
  }

  const getMinutesFromClientY = (clientY: number, el: HTMLDivElement) => {
    const rect = el.getBoundingClientRect()
    let y = clientY - rect.top - TOP_DEAD_ZONE
    y = Math.max(0, Math.min(y, 24 * SLOT_HEIGHT - 1))
    const mins = snapToQuarter((y / SLOT_HEIGHT) * 60)
    return Math.max(0, Math.min(mins, 23 * 60 + 45))
  }

  const applyLivePreviewToStore = (eventId: string, preview: { date: string; start_time: number; end_time: number; end_date?: string }) => {
    const { eventsCache } = useEventsStore.getState()
    let fromDateKey: string | null = null
    let sourceEvent: any = null

    for (const [dateKey, events] of Object.entries(eventsCache)) {
      const found = events.find((e: any) => e.id === eventId)
      if (found) {
        fromDateKey = dateKey
        sourceEvent = found
        break
      }
    }

    if (!fromDateKey || !sourceEvent) return

    const toDateKey = preview.date
    const updatedEvent = {
      ...sourceEvent,
      date: preview.date,
      end_date: preview.end_date || preview.date,
      start_time: preview.start_time,
      end_time: preview.end_time,
      updated_at: new Date().toISOString(),
    }

    const nextCache: Record<string, any[]> = { ...eventsCache }

    if (fromDateKey !== toDateKey) {
      nextCache[fromDateKey] = (nextCache[fromDateKey] || []).filter((e: any) => e.id !== eventId)
      if (nextCache[fromDateKey].length === 0) delete nextCache[fromDateKey]
      if (!nextCache[toDateKey]) nextCache[toDateKey] = []
      nextCache[toDateKey] = [...nextCache[toDateKey].filter((e: any) => e.id !== eventId), updatedEvent]
    } else {
      nextCache[fromDateKey] = (nextCache[fromDateKey] || []).map((e: any) => (e.id === eventId ? updatedEvent : e))
    }

    if (nextCache[toDateKey]) {
      nextCache[toDateKey] = [...nextCache[toDateKey]].sort((a: any, b: any) => a.start_time - b.start_time)
    }

    useEventsStore.setState({
      eventsCache: nextCache as any,
      computedEventsCache: {},
      recurringEventsCache: {},
      eventExceptionsCache: {},
    })
  }

  const captureOriginalIfNeeded = (eventId: string) => {
    if (interactionOriginalRef.current[eventId]) return
    const sourceEvent = getEventById(eventId)
    if (!sourceEvent) return
    interactionOriginalRef.current[eventId] = {
      date: sourceEvent.date,
      end_date: sourceEvent.end_date || sourceEvent.date,
      start_time: sourceEvent.start_time,
      end_time: sourceEvent.end_time,
    }
  }

  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      if (!dragState && pendingDrag) {
        const moved = Math.abs(e.clientX - pendingDrag.startX) + Math.abs(e.clientY - pendingDrag.startY)
        if (moved >= 4) {
          const initialPreview = {
            date: pendingDrag.date,
            start_time: pendingDrag.start,
            end_time: pendingDrag.start + pendingDrag.duration,
          }
          setDragState({ id: pendingDrag.id, duration: pendingDrag.duration, offsetMinutes: pendingDrag.offsetMinutes })
          setPreviewById((prev) => ({
            ...prev,
            [pendingDrag.id]: initialPreview,
          }))
          if (selectedEventId === pendingDrag.id) {
            applyLivePreviewToStore(pendingDrag.id, initialPreview)
          }
          setPendingDrag(null)
          return
        }
      }

      if (dragState) {
        const target = findDayByClientX(e.clientX)
        if (!target) return
        const pointerMinutes = getMinutesFromClientY(e.clientY, target.el)
        const start = pointerMinutes - dragState.offsetMinutes
        const maxStart = Math.max(0, 1440 - dragState.duration)
        const clampedStart = Math.max(0, Math.min(start, maxStart))
        const next = {
          date: target.dayKey,
          start_time: clampedStart,
          end_time: clampedStart + dragState.duration,
        }
        setPreviewById((prev) => ({ ...prev, [dragState.id]: next }))
        if (selectedEventId === dragState.id) {
          applyLivePreviewToStore(dragState.id, next)
        }
      } else if (resizeState) {
        const el = dayColumnRefs.current[resizeState.date]
        if (!el) return
        const end = Math.max(resizeState.start + 15, getMinutesFromClientY(e.clientY, el))
        const clampedEnd = Math.min(end, 24 * 60)
        setPreviewById((prev) => ({
          ...prev,
          [resizeState.id]: {
            date: resizeState.date,
            start_time: resizeState.start,
            end_time: clampedEnd,
          },
        }))
        if (selectedEventId === resizeState.id) {
          applyLivePreviewToStore(resizeState.id, {
            date: resizeState.date,
            start_time: resizeState.start,
            end_time: clampedEnd,
          })
        }
      } else if (horizontalResizeState) {
        const target = findDayByClientX(e.clientX)
        if (!target) return
        const clampedDay = toDayStamp(target.dayKey) < toDayStamp(horizontalResizeState.startDate)
          ? horizontalResizeState.startDate
          : target.dayKey
        setPreviewById((prev) => ({
          ...prev,
          [horizontalResizeState.id]: {
            date: horizontalResizeState.startDate,
            start_time: horizontalResizeState.start_time,
            end_time: horizontalResizeState.end_time,
            end_date: clampedDay,
          } as any,
        }))
        if (selectedEventId === horizontalResizeState.id) {
          applyLivePreviewToStore(horizontalResizeState.id, {
            date: horizontalResizeState.startDate,
            start_time: horizontalResizeState.start_time,
            end_time: horizontalResizeState.end_time,
            end_date: clampedDay,
          })
        }
      }
    }

    const onMouseUp = (e: MouseEvent) => {
      let derivedPreview: any = null
      const activeId = dragState?.id || resizeState?.id || horizontalResizeState?.id || pendingDrag?.id
      const pendingMoved =
        pendingDrag
          ? Math.abs(e.clientX - pendingDrag.startX) + Math.abs(e.clientY - pendingDrag.startY)
          : 0

      // Fast-drag fallback: commit using mouse-up position even when no mousemove fired.
      if (!dragState && pendingDrag && pendingMoved >= 4) {
        const target = findDayByClientX(e.clientX)
        if (target) {
          const pointerMinutes = getMinutesFromClientY(e.clientY, target.el)
          const start = pointerMinutes - pendingDrag.offsetMinutes
          const maxStart = Math.max(0, 1440 - pendingDrag.duration)
          const clampedStart = Math.max(0, Math.min(start, maxStart))
          derivedPreview = {
            date: target.dayKey,
            start_time: clampedStart,
            end_time: clampedStart + pendingDrag.duration,
          }
        }
      }

      const hadRealInteraction =
        !!dragState ||
        !!resizeState ||
        !!horizontalResizeState ||
        (!!pendingDrag && pendingMoved >= 4 && !!derivedPreview)

      if (pendingDrag) {
        setPendingDrag(null)
      }
      // Plain click on event body should NOT be treated as drag-drop.
      if (!activeId || !hadRealInteraction) return
      suppressNextClickRef.current = true
      window.setTimeout(() => {
        suppressNextClickRef.current = false
      }, 0)
      const clearInteractionState = () => {
        setDragState(null)
        setResizeState(null)
        setHorizontalResizeState(null)
        setPreviewById((prev) => {
          const next = { ...prev }
          delete next[activeId]
          return next
        })
      }

      const clearInteractionOnly = () => {
        setDragState(null)
        setResizeState(null)
        setHorizontalResizeState(null)
      }

      const preview = derivedPreview || (previewById[activeId] as any)
      if (!preview) {
        const original = interactionOriginalRef.current[activeId]
        if (original) {
          // If drag/resize ended without a valid drop target, restore original event state.
          updateEventFields(activeId, original)
          delete interactionOriginalRef.current[activeId]
        }
        clearInteractionState()
        return
      }

      const commit = {
        date: preview.date,
        end_date: preview.end_date || preview.date,
        start_time: preview.start_time,
        end_time: preview.end_time,
      }

      updateEventFields(activeId, commit)
      delete interactionOriginalRef.current[activeId]
      clearInteractionState()
    }

    window.addEventListener("mousemove", onMouseMove)
    window.addEventListener("mouseup", onMouseUp)
    return () => {
      window.removeEventListener("mousemove", onMouseMove)
      window.removeEventListener("mouseup", onMouseUp)
    }
  }, [pendingDrag, dragState, resizeState, horizontalResizeState, previewById, updateEventFields, weekDateKeys, setDate, selectedEventId, getEventById])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || !selectedEventId) return
      setDismissedEventIds((prev) => {
        const next = new Set(prev)
        next.add(selectedEventId)
        return next
      })
      void deleteEvent(selectedEventId)
      setSelectedEvent(null)
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [selectedEventId, deleteEvent, setSelectedEvent])

  return (
    <div className="h-full w-full bg-[#f3f3f2] flex items-center justify-center overflow-hidden select-none">
      <div className="h-[100%] w-[100%] rounded-l-2xl bg-[#ececeb] shadow-xl flex flex-col overflow-hidden">
        <div className="px-9 pt-32 pb-3 border-b border-white/20 shrink-0">
          <h1 className="text-6xl pb-7 font-semibold text-neutral-800 tracking-tight">
            <span style={{ fontFamily: "SF Pro Display", fontWeight: 700 }} className="text-black">
              {format(weekStart, "d MMM")} - {format(addDays(weekStart, 6), "d MMM")},
            </span>
            <span style={{ fontFamily: "SF Pro Display", fontWeight: 400 }} className="text-neutral-400">
              {" "}
              {format(addDays(weekStart, 6), "yyyy")}
            </span>
          </h1>
        </div>

        <div ref={scrollRef} className="flex-1 overflow-y-auto no-scrollbar">
          <div className="pb-14">
            <div ref={stickyHeaderRef} className="sticky top-0 z-[500] isolate bg-[#e2e2e1] border-b border-black/5">
              <div className="flex relative z-[520] bg-[#e2e2e1]">
                <div className="w-[72px] shrink-0" />
                <div className="flex-1 grid grid-cols-7 gap-0">
                  {weekDays.map((day) => {
                    const dayKey = formatDate(day)
                    const isSelected = selectedDate ? format(day, "yyyy-MM-dd") === format(selectedDate, "yyyy-MM-dd") : false
                    return (
                      <button
                        key={day.toISOString()}
                        type="button"
                        onClick={() => setDate(day)}
                        className={`border-l border-black/5 px-2 py-2 text-left transition-colors ${isSelected ? "bg-[#dcdcd9]" : "bg-transparent hover:bg-[#e9e9e7]"}`}
                      >
                        <div className="text-sm text-neutral-500">{format(day, "EEE")}</div>
                        <div className="text-2xl font-semibold text-neutral-800">{format(day, "d")}</div>
                      </button>
                    )
                  })}
                </div>
              </div>
              <div className="flex border-t border-black/5 bg-[#e2e2e1] relative z-[510]">
                <div className="w-[72px] shrink-0 flex items-start justify-end pr-2 pt-1">
                  {topRowLayout.hasAnyMore ? (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        setShowAllTopEvents((prev) => !prev)
                      }}
                      className="z-30 h-6 rounded-full bg-white/90 hover:bg-white text-neutral-700 flex items-center justify-center border border-black/10 px-2 gap-1"
                      aria-label={showAllTopEvents ? "Collapse events" : "Show all events"}
                      title={showAllTopEvents ? "Show less" : "Show all"}
                    >
                      <span className="text-[10px] font-semibold leading-none">
                        {showAllTopEvents ? "Less" : `+${topRowLayout.hiddenCount}`}
                      </span>
                      <svg
                        className={`h-3 w-3 transition-transform ${showAllTopEvents ? "rotate-180" : ""}`}
                        viewBox="0 0 20 20"
                        fill="none"
                        xmlns="http://www.w3.org/2000/svg"
                      >
                        <path d="M5 8L10 13L15 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </button>
                  ) : null}
                </div>
                <div className="flex-1 grid grid-cols-7 gap-0">
                  {weekDays.map((day, dayIndex) => {
                    const dayKey = formatDate(day)
                    const topEvents = topRowLayout.allByDay[dayKey] || []
                    const visibleTopEvents = topRowLayout.visibleByDay[dayKey] || []

                    return (
                      <div
                        key={`top-${day.toISOString()}`}
                        className="border-l border-black/5 px-2 py-1 relative z-40"
                        style={{ minHeight: `${topRowLayout.rowHeight}px` }}
                      >
                        <div className="relative z-50" style={{ minHeight: `${topRowLayout.rowHeight - 8}px` }}>
                          {visibleTopEvents.map((event) => {
                            const startKey = event.date
                            const endKey = event.end_date || event.date
                            const spanDays = Math.max(1, Math.min(7 - dayIndex, daySpan(startKey, endKey) + 1))
                            const lane = topRowLayout.laneByEventId[event.id] ?? 0
                            const { backgroundColor, textColor } = getEventVisualColors((event as any).goalColor || (event as any).color)
                            return (
                              <div
                                key={`top-sticky-${event.id}`}
                                onClick={(eventClick) => {
                                  eventClick.stopPropagation()
                                  if (!showAllTopEvents && topRowLayout.hasAnyMore) {
                                    setShowAllTopEvents(true)
                                  }
                                  setSelectedEvent(event.id)
                                  setDate(new Date(`${event.date}T00:00:00`))
                                  scrollToEventTime(0)
                                }}
                                className="truncate px-1.5 py-0.5 text-[11px] font-semibold border border-white/60 shadow-sm rounded-md absolute left-0 z-[60] cursor-pointer"
                                style={{
                                  top: `${lane * 22}px`,
                                  backgroundColor,
                                  color: textColor,
                                  width: spanDays > 1 ? `${spanDays * 100}%` : "100%",
                                }}
                              >
                                {event.title}
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>

            <div className="flex relative">
              <div className="w-[72px] shrink-0">
                {hourSlots.map((hour) => (
                    <div key={hour} className="flex items-center justify-end pr-3" style={{ height: `${SLOT_HEIGHT}px` }}>
                    <span className="text-black text-xl">
                      {String(hour).padStart(2, "0")}
                      <span className="text-gray-600 text-lg">:00</span>
                    </span>
                  </div>
                ))}
              </div>

              <div className="flex-1 grid grid-cols-7">
                {weekDays.map((day) => {
                  const dayKey = formatDate(day)
                  const dayTimedEvents = timedWeekEvents
                    .map((event) => {
                      const preview = previewById[event.id] as any
                      if (!preview) return event
                      return {
                        ...event,
                        date: preview.date,
                        end_date: preview.end_date || preview.date,
                        start_time: preview.start_time,
                        end_time: preview.end_time,
                      }
                    })
                    .filter((event) => {
                      const endDate = event.end_date || event.date
                      return event.date <= dayKey && endDate >= dayKey
                    })
                    .filter((event) => {
                      const endDate = event.end_date || event.date
                      const spansMultipleDays = endDate > event.date
                      // Render cross-day timed events once (on their start day) as a single continuous block.
                      if (spansMultipleDays) return event.date === dayKey
                      return true
                    })

                  const uiEvents = dayTimedEvents.map((event) => {
                    const resolvedGoalColor = resolveGoalColorForEvent(goalsStore, event as any)
                    return storeEventToUIEvent(
                      { ...event, color: (event as any).goalColor || resolvedGoalColor || (event as any).color } as any,
                      day
                    )
                  })
                  const positions = calculateEventPositions(uiEvents, selectedEventId)

                  const handleCreateEvent = (e: React.MouseEvent<HTMLDivElement>) => {
                    if (dragState || resizeState || horizontalResizeState) return
                    if (suppressNextClickRef.current) return
                    const target = e.target as HTMLElement
                    if (target.closest("[data-week-event='true']")) return
                    if (selectedEventId) {
                      setSelectedEvent(null)
                      return
                    }

                    const rect = e.currentTarget.getBoundingClientRect()
                    let clickY = e.clientY - rect.top
                    if (clickY < TOP_DEAD_ZONE) return
                    clickY -= TOP_DEAD_ZONE

                    const newUIEvent = addEventOnClick(clickY, uiEvents, day)
                    if (!newUIEvent) return

                    const storeEvent = uiEventToStoreEvent(newUIEvent, formatDate(day))
                    addEventLocal({
                      title: storeEvent.title!,
                      date: storeEvent.date!,
                      end_date: storeEvent.end_date!,
                      start_time: storeEvent.start_time!,
                      end_time: storeEvent.end_time!,
                      description: storeEvent.description,
                      notes: storeEvent.notes,
                      urls: storeEvent.urls,
                      color: storeEvent.color,
                      is_all_day: storeEvent.is_all_day,
                      location: storeEvent.location,
                      id: storeEvent.id,
                    })
                    setDate(day)
                    setSelectedEvent(newUIEvent.id)
                  }

                  return (
                    <div
                      key={day.toISOString()}
                      ref={(el) => { dayColumnRefs.current[dayKey] = el }}
                      onClick={handleCreateEvent}
                      className="relative border-l border-black/5 min-h-[2448px]"
                    >
                      <div className="h-[1px] bg-[#cfcfcb] mt-12" />
                      {gridLines.map((line) => (
                        <div key={line} className="h-[1px] bg-[#cfcfcb]" style={{ marginTop: `${SLOT_HEIGHT - 1}px` }} />
                      ))}

                      <div className="absolute inset-0">
                        {dayKey === todayKey ? (
                          <div className="absolute left-0 right-0 z-20" style={{ top: nowLineTop }}>
                            <div className="absolute -left-1.5 -top-1.5 h-3 w-3 rounded-full bg-red-500 shadow-sm" />
                            <div className="h-[2px] w-full bg-red-500/90" />
                          </div>
                        ) : null}
                        {uiEvents.map((event) => {
                          const sourceEvent = dayTimedEvents.find((entry) => entry.id === event.id)
                          const eventEndDate = (sourceEvent?.end_date || sourceEvent?.date || dayKey)
                          const isStartColumn = (sourceEvent?.date || dayKey) === dayKey
                          const extensionDays = isStartColumn ? daySpan(dayKey, eventEndDate) : 0
                          const isExtendedEvent = extensionDays > 0
                          const isHorizontalResizing = horizontalResizeState?.id === event.id
                          const isRecurringEvent = !!(
                            (sourceEvent as any)?.isRecurringInstance ||
                            ((sourceEvent as any)?.repeat && (sourceEvent as any)?.repeat !== "None")
                          )
                          const position = positions[event.id] || { left: "0", width: "100%", zIndex: 10 }
                          const { backgroundColor, textColor } = getEventVisualColors(event.color)
                          const startMins = event.startHour * 60 + event.startMin
                          const endMins = event.endHour * 60 + event.endMin

                          return (
                            <button
                              key={event.id}
                              type="button"
                              data-week-event="true"
                              onClick={(eventClick) => {
                                eventClick.stopPropagation()
                                if (suppressNextClickRef.current) return
                                setSelectedEvent(event.id)
                                const sourceDate = sourceEvent?.date || dayKey
                                setDate(new Date(`${sourceDate}T00:00:00`))
                                scrollToEventElement(eventClick.currentTarget)
                              }}
                              onMouseDown={(eventMouseDown) => {
                                eventMouseDown.stopPropagation()
                                const start = event.startHour * 60 + event.startMin
                                const end = event.endHour * 60 + event.endMin
                                const duration = Math.max(15, getClockwiseDurationMinutes(start, end))
                                const targetEl = eventMouseDown.currentTarget as HTMLButtonElement
                                const rect = targetEl.getBoundingClientRect()
                                const offsetY = Math.max(0, Math.min(eventMouseDown.clientY - rect.top, rect.height))
                                const offsetMinutes = Math.round((offsetY / SLOT_HEIGHT) * 60 / 15) * 15
                                captureOriginalIfNeeded(event.id)
                                setPendingDrag({
                                  id: event.id,
                                  duration,
                                  offsetMinutes,
                                  startX: eventMouseDown.clientX,
                                  startY: eventMouseDown.clientY,
                                  date: dayKey,
                                  start,
                                })
                              }}
                              className={`group absolute rounded-md border border-white/70 px-2 py-1 text-left shadow-sm ${
                                selectedEventId === event.id &&
                                dragState?.id !== event.id &&
                                pendingDrag?.id !== event.id &&
                                resizeState?.id !== event.id &&
                                horizontalResizeState?.id !== event.id
                                  ? "ring-2 ring-white"
                                  : ""
                              }`}
                              style={{
                                top: event.slot + TOP_DEAD_ZONE,
                                height: event.height,
                                left: isExtendedEvent ? "0%" : position.left,
                                width: isExtendedEvent ? `calc(${extensionDays + 1} * 100%)` : position.width,
                                zIndex: isHorizontalResizing
                                  ? 999
                                  : isExtendedEvent
                                    ? 120
                                    : isRecurringEvent
                                    ? 60
                                    : position.zIndex,
                                backgroundColor,
                                color: textColor,
                                borderColor: "rgba(255,255,255,0.7)",
                                borderWidth: "1px",
                                boxShadow: isHorizontalResizing ? "0 10px 24px rgba(0,0,0,0.24)" : undefined,
                              }}
                            >
                              <div className="truncate text-sm font-bold">{event.title}</div>
                              <div className="truncate text-xs font-medium opacity-95">{formatTime(startMins)} - {formatTime(endMins)}</div>
                              <div
                                onMouseDown={(resizeMouseDown) => {
                                  resizeMouseDown.stopPropagation()
                                  const start = event.startHour * 60 + event.startMin
                                  const end = event.endHour * 60 + event.endMin
                                  captureOriginalIfNeeded(event.id)
                                  setResizeState({ id: event.id, start, date: dayKey })
                                  setPreviewById((prev) => ({
                                    ...prev,
                                    [event.id]: { date: dayKey, start_time: start, end_time: end },
                                  }))
                                }}
                                className="absolute bottom-0 left-0 right-0 h-2 cursor-ns-resize opacity-0 hover:opacity-100 group-hover:opacity-100"
                              />
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default WeekView
