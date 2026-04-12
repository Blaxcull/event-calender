<<<<<<< HEAD
<<<<<<< HEAD
const GoalView = () => {
  return (
    <div className="h-full w-full flex items-center justify-center bg-gray-100">
      <p className="text-2xl text-neutral-400">Goal View - Coming Soon</p>
    </div>
  )
=======
import { useState, useRef, useEffect, useCallback } from "react";
import { ChevronLeft, ChevronRight, GripVertical } from "lucide-react";
=======
import { useState, useRef, useEffect } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
>>>>>>> 5cce8be (goal tab sidebar and some issues with the repeat)
import { startOfWeek, endOfWeek, addWeeks, addMonths, addYears, format } from "date-fns";
import { motion, AnimatePresence } from "framer-motion";
import GoalSidebar from "./GoalSidebar";
import { getGoalIcon } from "./goal";
import type { Goal } from "./goal";

interface TodoItem {
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

type ColumnType = 'week' | 'month' | 'year' | 'life';

type TodoStore = Record<string, TodoItem[]>;

interface DragState {
  itemId: string;
  sourceColumnType: ColumnType;
  dropTarget: { columnType: ColumnType; itemId: string; position: 'before' | 'after' } | null;
}

const generateId = () => Math.random().toString(36).substring(2, 9);

const getKey = (type: ColumnType, date: Date): string => {
  if (type === "life") return "life";
  if (type === "year") return `year-${date.getFullYear()}`;
  if (type === "month") return `month-${date.getFullYear()}-${date.getMonth()}`;
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  return `week-${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
};

const slideVariants = {
  enter: (dir: number) => ({
    x: dir > 0 ? 80 : -80,
    opacity: 0,
    scale: 0.98,
  }),
  center: {
    x: 0,
    opacity: 1,
    scale: 1,
  },
  exit: (dir: number) => ({
    x: dir > 0 ? -80 : 80,
    opacity: 0,
    scale: 0.98,
  }),
};

interface GoalColumnProps {
  title: string;
  columnType: ColumnType;
  items: TodoItem[];
  direction: number;
  onToggle: (id: string) => void;
  onAdd: (text: string) => void;
  onPrev: () => void;
  onNext: () => void;
  onToday: () => void;
  showNav?: boolean;
  dragState: DragState | null;
  onDragStart: (itemId: string, sourceColumnType: ColumnType, initialDropTarget: DragState['dropTarget']) => void;
  onDragMove: (dropTarget: DragState['dropTarget']) => void;
  onDragEnd: (targetColumnType: ColumnType | null) => void;
  columnItemRefs: React.MutableRefObject<Map<ColumnType, Map<string, HTMLElement>>>;
  columnItemHeights: React.MutableRefObject<Map<ColumnType, number>>;
  onGoalClick: (item: TodoItem) => void;
}

function GoalColumn({ title, columnType, items, direction, onToggle, onAdd, onPrev, onNext, onToday, showNav = true, dragState, onDragStart, onDragMove, onDragEnd, columnItemRefs, columnItemHeights, onGoalClick }: GoalColumnProps) {
  const [isAdding, setIsAdding] = useState(false);
  const [newText, setNewText] = useState("");
  const [isHovering, setIsHovering] = useState(false);
  const [isColumnHovered, setIsColumnHovered] = useState(false);
  const [isAreaHovering, setIsAreaHovering] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const blurTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const isDragging = dragState !== null;
  const isDragSource = dragState?.sourceColumnType === columnType;
  const isDropTarget = dragState?.dropTarget?.columnType === columnType;
  const dropTarget = isDropTarget ? dragState!.dropTarget : null;
  const draggedItemId = dragState?.itemId ?? null;
  const itemHeight = columnItemHeights.current.get(columnType) || 0;

  useEffect(() => {
    if (isAdding && inputRef.current) inputRef.current.focus();
  }, [isAdding]);

  const handleSubmit = () => {
    if (newText.trim()) onAdd(newText.trim());
    setNewText("");
    setIsAdding(false);
  };

  const handleBlur = () => {
    blurTimerRef.current = setTimeout(() => {
      if (newText.trim()) onAdd(newText.trim());
      setNewText("");
      setIsAdding(false);
    }, 0);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleSubmit();
    if (e.key === "Escape") { setNewText(""); setIsAdding(false); }
  };

  const getDropTarget = (clientY: number, excludeId: string, targetColumnType: ColumnType): DragState['dropTarget'] => {
    let closest: { itemId: string; position: 'before' | 'after'; distance: number } | null = null;
    const columnRefs = columnItemRefs.current.get(targetColumnType);

    if (!columnRefs) return null;

    columnRefs.forEach((el, itemId) => {
      if (itemId === excludeId) return;
      const rect = el.getBoundingClientRect();
      const midY = rect.top + rect.height / 2;
      const position: 'before' | 'after' = clientY < midY ? 'before' : 'after';
      const dist = position === 'before' ? Math.abs(clientY - rect.top) : Math.abs(rect.bottom - clientY);

      if (closest === null || dist < closest.distance) {
        closest = { itemId, position, distance: dist };
      }
    });

    if (!closest) return null;
    const c = closest as { itemId: string; position: 'before' | 'after'; distance: number };
    return { columnType: targetColumnType, itemId: c.itemId, position: c.position };
  };

  const handleMouseDown = (itemId: string, e: React.MouseEvent) => {
    const source = e.currentTarget as HTMLElement;
    const rect = source.getBoundingClientRect();

    const dragIndex = items.findIndex(i => i.id === itemId);
    let initialDropTarget: DragState['dropTarget'] = null;
    if (dragIndex < items.length - 1) {
      initialDropTarget = { columnType, itemId: items[dragIndex + 1].id, position: 'before' };
    } else if (dragIndex > 0) {
      initialDropTarget = { columnType, itemId: items[dragIndex - 1].id, position: 'after' };
    }

    const startX = e.clientX;
    const startY = e.clientY;
    let hasDragged = false;

    const ghost = source.cloneNode(true) as HTMLElement;
    const computed = getComputedStyle(source);
    ghost.style.cssText = "";
    for (let i = 0; i < computed.length; i++) {
      const prop = computed[i];
      ghost.style.setProperty(prop, computed.getPropertyValue(prop));
    }
    ghost.style.position = "fixed";
    ghost.style.pointerEvents = "none";
    ghost.style.zIndex = "9999";
    ghost.style.transition = "none";
    ghost.style.left = rect.left + "px";
    ghost.style.top = rect.top + "px";
    ghost.style.width = rect.width + "px";
    ghost.style.height = rect.height + "px";
    ghost.style.margin = "0";
    ghost.style.opacity = "1";
    ghost.style.backgroundColor = "#f0f0f0";
    ghost.querySelectorAll("*").forEach(el => {
      (el as HTMLElement).style.opacity = "1";
    });

    const offsetX = e.clientX - rect.left;
    const offsetY = e.clientY - rect.top;

    const handleMouseMove = (ev: MouseEvent) => {
      if (!hasDragged && Math.abs(ev.clientX - startX) < 4 && Math.abs(ev.clientY - startY) < 4) return;
      if (!hasDragged) {
        hasDragged = true;
        document.body.appendChild(ghost);
        onDragStart(itemId, columnType, initialDropTarget);
        document.body.style.cursor = "grabbing";
        document.body.style.userSelect = "none";
        document.addEventListener("selectstart", preventSelect);
      }
      ghost.style.left = ev.clientX - offsetX + "px";
      ghost.style.top = ev.clientY - offsetY + "px";

      const el = document.elementFromPoint(ev.clientX, ev.clientY);
      const dropZone = el?.closest("[data-column-type]");
      const hoverColumnType = dropZone?.getAttribute("data-column-type") as ColumnType | null;
      if (hoverColumnType) {
        const target = getDropTarget(ev.clientY, itemId, hoverColumnType);
        if (target) {
          onDragMove(target);
        } else if (columnType !== hoverColumnType) {
          onDragMove(null);
        }
      }
    };

    const handleMouseUp = (ev: MouseEvent) => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      document.removeEventListener("selectstart", preventSelect);

      if (!hasDragged) {
        ghost.remove();
        const clickedItem = items.find(i => i.id === itemId);
        onGoalClick(clickedItem || { id: itemId, text: "", completed: false });
      } else {
        const el = document.elementFromPoint(ev.clientX, ev.clientY);
        const dropZone = el?.closest("[data-column-type]");
        const toType = dropZone?.getAttribute("data-column-type") as ColumnType | null;
        ghost.remove();
        onDragEnd(toType);
      }
    };

    const preventSelect = (e: Event) => e.preventDefault();
    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
  };

  return (
      <div
  className="flex flex-col flex-1 transition-all duration-200"
  data-column-type={columnType}
  onMouseEnter={() => {
    setIsHovering(true);
    setIsColumnHovered(true);
  }}
  onMouseLeave={() => {
    setIsHovering(false);
    setIsColumnHovered(false);
  }}
>
      <div className="flex-1 flex flex-col relative px-2 pt-4 overflow-hidden">
        <AnimatePresence mode="popLayout" initial={false} custom={direction}>
          <motion.div
            key={title}
            custom={direction}
            variants={slideVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
            className="flex flex-col h-full"
          >
          <h2 className="text-5xl font-bold tracking-tight leading-tight bg-gradient-to-b from-black to-neutral-500 bg-clip-text text-transparent mb-3">
              {title}
            </h2>

            <div className="flex flex-col overflow-y-auto no-scrollbar">
              {items.map((item) => {
                const isDraggedItem = draggedItemId === item.id;
                const showGapBefore = isDragging && dropTarget?.itemId === item.id && dropTarget?.position === 'before';
                const showGapAfter = isDragging && dropTarget?.itemId === item.id && dropTarget?.position === 'after';

                return (
                  <div key={item.id}>
                    <div
                      className="overflow-hidden"
                      style={{ height: showGapBefore ? itemHeight : 0 }}
                    />
                    <motion.div
                      data-goal-sidebar-trigger="true"
                      ref={(el) => {
                        if (el) {
                          if (!columnItemRefs.current.has(columnType)) {
                            columnItemRefs.current.set(columnType, new Map());
                          }
                          columnItemRefs.current.get(columnType)!.set(item.id, el);
                          if (!columnItemHeights.current.has(columnType)) {
                            columnItemHeights.current.set(columnType, el.offsetHeight);
                          }
                        } else {
                          columnItemRefs.current.get(columnType)?.delete(item.id);
                        }
                      }}
                      onMouseDown={(isDragSource || !isDragging) ? (e) => handleMouseDown(item.id, e) : undefined}
                      style={{ cursor: "grab", display: isDraggedItem && isDragSource ? 'none' : undefined, boxShadow: isDragging && isDropTarget && dropTarget?.itemId === item.id ? "0 4px 12px rgba(0,0,0,0.08)" : "none" }}
                      className={`flex items-center gap-3 py-2 px-2 rounded-lg select-none ${!isDragging ? 'hover:bg-black/5' : ''} group transition-all duration-200`}
                    >
                      <input
                        type="checkbox"
                        checked={item.completed}
                        onChange={() => onToggle(item.id)}
                        onMouseDown={(e) => e.stopPropagation()}
                        className={`h-5 w-5 shrink-0 cursor-pointer transition-all duration-200 accent-black ${item.completed ? "opacity-30" : ""}`}
                      />
                      {item.icon ? (
                        (() => {
                          const Icon = getGoalIcon(item.icon).icon;
                          return <Icon className="h-5 w-5 shrink-0 text-slate-700" />;
                        })()
                      ) : null}
                      <span className={`text-lg transition-all duration-200 ${item.completed ? "text-muted-foreground" : "text-foreground"}`}>
                        {item.text}
                      </span>
                    </motion.div>
                    <div
                      className="overflow-hidden"
                      style={{ height: showGapAfter ? itemHeight : 0 }}
                    />
                  </div>
                );
              })}


              {isDragging && items.length === 0 && isColumnHovered && (
  <div style={{ height: itemHeight || 32 }} />
)}

              {isAdding ? (
                  <div className="flex items-center gap-2 py-1.5 border border-black/20 rounded shadow-sm focus-within:shadow-md transition-shadow">
                  <input type="checkbox" disabled className="h-5 ml-1 w-5 opacity-30" />

                  <input
                    ref={inputRef}
                    value={newText}
                    onChange={(e) => setNewText(e.target.value)}
                    onBlur={handleBlur}
                    onKeyDown={handleKeyDown}
                    className="bg-transparent border-none outline-none text-lg text-foreground w-full"
                    placeholder="Type here..."
                  />
                </div>
              ) : (
                <div
                  onClick={() => setIsAdding(true)}
                  className={`flex items-center gap-2 py-2 px-2 rounded-lg cursor-pointer transition-all duration-200
                    ${isAreaHovering
                      ? "text-foreground bg-black/5"
                      : "text-muted-foreground hover:text-foreground hover:bg-black/5"
                    }`}
                >
                  <input
                    type="checkbox"
                    disabled
                    className="h-5 w-5 opacity-30 pointer-events-none"
                  />
                  <span className="text-lg">
                    Add...
                  </span>
                </div>
              )}
            </div>

            <div
              className="flex-1 min-h-0 cursor-pointer"
              onMouseEnter={() => setIsAreaHovering(true)}
              onMouseLeave={() => setIsAreaHovering(false)}
              onMouseDown={(e) => {
                e.preventDefault();
                clearTimeout(blurTimerRef.current);
                setIsAdding(prev => !prev);
              }}
            />
          </motion.div>
        </AnimatePresence>
      </div>

      {showNav && (
        <div className={`flex items-center justify-center gap-3 px-4 py-2.5 transition-opacity duration-200 ${isHovering ? "opacity-100" : "opacity-0"}`}>
          <button onClick={onPrev} className="h-9 w-9 flex items-center justify-center rounded-full bg-white shadow-sm border border-black/5 hover:shadow-md backdrop-blur-md transition-all duration-200 ease-out hover:scale-110 active:scale-90">
            <ChevronLeft className="h-5 w-5 text-[#404040]" />
          </button>
          <button onClick={onToday} className="px-5 py-2 rounded-full bg-white shadow-sm border border-black/5 hover:shadow-md backdrop-blur-md text-sm font-semibold text-[#404040] transition-all duration-200 ease-out hover:scale-105 active:scale-90">
            Today
          </button>
          <button onClick={onNext} className="h-9 w-9 flex items-center justify-center rounded-full bg-white shadow-sm border border-black/5 hover:shadow-md backdrop-blur-md transition-all duration-200 ease-out hover:scale-110 active:scale-90">
            <ChevronRight className="h-5 w-5 text-[#404040]" />
          </button>
        </div>
      )}
    </div>
  );
}

const GoalView = () => {
  const [currentDate, setCurrentDate] = useState(() => new Date());
  const [yearDate, setYearDate] = useState(() => new Date());
  const [direction, setDirection] = useState(1);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarItemId, setSidebarItemId] = useState("");
  const [sidebarPrefillName, setSidebarPrefillName] = useState("");
  const [sidebarColumnType, setSidebarColumnType] = useState<ColumnType | null>(null);
  const [sidebarItemData, setSidebarItemData] = useState<{ notes?: string; color?: string; icon?: string; targetValue?: number; targetPeriod?: Goal["targetPeriod"]; status?: Goal["status"] }>({});
  const [dragState, setDragState] = useState<DragState | null>(null);
  const [store, setStore] = useState<TodoStore>(() => {
    try {
      const saved = localStorage.getItem("todo-store");
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  const columnItemRefs = useRef<Map<ColumnType, Map<string, HTMLElement>>>(new Map());
  const columnItemHeights = useRef<Map<ColumnType, number>>(new Map());

  const save = (newStore: TodoStore) => {
    setStore(newStore);
    localStorage.setItem("todo-store", JSON.stringify(newStore));
  };

  const getDate = (type: ColumnType) => type === "year" ? yearDate : currentDate;

  const getItems = (type: ColumnType): TodoItem[] => {
    const key = getKey(type, getDate(type));
    return store[key] || [];
  };

  const addItem = (type: ColumnType, text: string) => {
    const key = getKey(type, getDate(type));
    const items = store[key] || [];
    save({ ...store, [key]: [...items, { id: generateId(), text, completed: false }] });
  };

  const toggleItem = (type: ColumnType, id: string) => {
    const key = getKey(type, getDate(type));
    const items = (store[key] || []).map(item =>
      item.id === id ? { ...item, completed: !item.completed } : item
    );
    save({ ...store, [key]: items });
  };

  const handleSidebarSave = (data: { text: string; notes: string; color: string; icon: string; targetValue: number; targetPeriod: Goal["targetPeriod"]; status: Goal["status"] }) => {
    if (!sidebarItemId || !sidebarColumnType) return;
    const key = getKey(sidebarColumnType, getDate(sidebarColumnType));
    const items = store[key] || [];
    const updated = items.map(item =>
      item.id === sidebarItemId ? { ...item, text: data.text, notes: data.notes, color: data.color, icon: data.icon, targetValue: data.targetValue, targetPeriod: data.targetPeriod, status: data.status } : item
    );
    save({ ...store, [key]: updated });
    setSidebarOpen(false);
  };

  useEffect(() => {
    if (!sidebarOpen || !sidebarItemId || !sidebarColumnType) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;

      const key = getKey(sidebarColumnType, getDate(sidebarColumnType));
      const items = store[key] || [];
      const updated = items.filter((item) => item.id !== sidebarItemId);
      save({ ...store, [key]: updated });
      setSidebarOpen(false);
      setSidebarItemId("");
      setSidebarPrefillName("");
      setSidebarColumnType(null);
      setSidebarItemData({});
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [sidebarOpen, sidebarItemId, sidebarColumnType, store, currentDate, yearDate]);

  const moveItem = (fromType: ColumnType, toType: ColumnType, itemId: string, dropTarget?: DragState['dropTarget']) => {
    const fromKey = getKey(fromType, getDate(fromType));
    const toKey = getKey(toType, getDate(toType));
    const fromItems = store[fromKey] || [];
    const toItems = [...(store[toKey] || [])];
    const item = fromItems.find(i => i.id === itemId);
    if (!item || fromKey === toKey) return;

    if (dropTarget && dropTarget.columnType === toType) {
      let idx = toItems.findIndex(i => i.id === dropTarget.itemId);
      if (idx !== -1) {
        if (dropTarget.position === 'after') idx += 1;
        toItems.splice(idx, 0, item);
      } else {
        toItems.push(item);
      }
    } else {
      toItems.push(item);
    }

    save({
      ...store,
      [fromKey]: fromItems.filter(i => i.id !== itemId),
      [toKey]: toItems,
    });
  };

  const reorderItems = (colType: ColumnType, itemId: string, targetItemId: string, position: 'before' | 'after') => {
    const key = getKey(colType, getDate(colType));
    const items = [...(store[key] || [])];
    const draggedIndex = items.findIndex(i => i.id === itemId);
    const targetIndex = items.findIndex(i => i.id === targetItemId);
    if (draggedIndex === -1 || targetIndex === -1 || itemId === targetItemId) return;

    const [item] = items.splice(draggedIndex, 1);
    let insertAt = items.findIndex(i => i.id === targetItemId);
    if (position === 'after') insertAt += 1;
    items.splice(insertAt, 0, item);

    save({ ...store, [key]: items });
  };

  const dragStateRef = useRef<DragState | null>(null);

  const handleDragStart = (itemId: string, sourceColumnType: ColumnType, initialDropTarget: DragState['dropTarget']) => {
    const state: DragState = { itemId, sourceColumnType, dropTarget: initialDropTarget };
    dragStateRef.current = state;
    setSidebarOpen(false);
    setDragState(state);
  };

  const handleDragMove = (dropTarget: DragState['dropTarget']) => {
    setDragState(prev => {
      const next = prev ? { ...prev, dropTarget } : null;
      dragStateRef.current = next;
      return next;
    });
  };

  const handleDragEnd = (targetColumnType: ColumnType | null) => {
    const current = dragStateRef.current;
    if (current) {
      if (targetColumnType && targetColumnType !== current.sourceColumnType) {
        moveItem(current.sourceColumnType, targetColumnType, current.itemId, current.dropTarget);
      } else if (current.dropTarget) {
        reorderItems(current.dropTarget.columnType, current.itemId, current.dropTarget.itemId, current.dropTarget.position);
      }
    }
    dragStateRef.current = null;
    setDragState(null);
  };

  const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(currentDate, { weekStartsOn: 1 });
  const weekLabel = `${format(weekStart, "d")}–${format(weekEnd, "d MMM")}`;
  const monthLabel = format(currentDate, "MMMM");
  const yearLabel = format(yearDate, "yyyy");

  const goToToday = () => { setDirection(1); setCurrentDate(new Date()); setYearDate(new Date()); };

  const navigate = (fn: (d: Date) => Date, dir: number) => {
    setDirection(dir);
    setCurrentDate(fn);
  };

  const navigateYear = (fn: (d: Date) => Date, dir: number) => {
    setDirection(dir);
    setYearDate(fn);
  };

  return (
    <div className="flex w-full min-h-screen bg-gradient-to-br from-neutral-100 via-neutral-50 to-neutral-200 p-4 pt-[120px] gap-4">
      <div data-column-type="week" className="flex-1 flex flex-col min-w-0 rounded-2xl border border-black/5 bg-white/60 backdrop-blur-xl shadow-[0_8px_30px_rgba(0,0,0,0.06)] overflow-hidden">
        <GoalColumn title={weekLabel} columnType="week" items={getItems("week")} direction={direction} onToggle={(id) => toggleItem("week", id)} onAdd={(text) => addItem("week", text)} onPrev={() => navigate(d => addWeeks(d, -1), -1)} onNext={() => navigate(d => addWeeks(d, 1), 1)} onToday={goToToday} dragState={dragState} onDragStart={handleDragStart} onDragMove={handleDragMove} onDragEnd={handleDragEnd} columnItemRefs={columnItemRefs} columnItemHeights={columnItemHeights} onGoalClick={(item) => { setSidebarItemId(item.id); setSidebarPrefillName(item.text); setSidebarColumnType("week"); setSidebarItemData({ notes: item.notes, color: item.color, icon: item.icon, targetValue: item.targetValue, targetPeriod: item.targetPeriod, status: item.status }); setSidebarOpen(true); }} />
      </div>
      <div data-column-type="month" className="flex-1 flex flex-col min-w-0 rounded-2xl border border-black/5 bg-white/60 backdrop-blur-xl shadow-[0_8px_30px_rgba(0,0,0,0.06)] overflow-hidden">
        <GoalColumn title={monthLabel} columnType="month" items={getItems("month")} direction={direction} onToggle={(id) => toggleItem("month", id)} onAdd={(text) => addItem("month", text)} onPrev={() => navigate(d => addMonths(d, -1), -1)} onNext={() => navigate(d => addMonths(d, 1), 1)} onToday={goToToday} dragState={dragState} onDragStart={handleDragStart} onDragMove={handleDragMove} onDragEnd={handleDragEnd} columnItemRefs={columnItemRefs} columnItemHeights={columnItemHeights} onGoalClick={(item) => { setSidebarItemId(item.id); setSidebarPrefillName(item.text); setSidebarColumnType("month"); setSidebarItemData({ notes: item.notes, color: item.color, icon: item.icon, targetValue: item.targetValue, targetPeriod: item.targetPeriod, status: item.status }); setSidebarOpen(true); }} />
      </div>
      <div data-column-type="year" className="flex-1 flex flex-col min-w-0 rounded-2xl border border-black/5 bg-white/60 backdrop-blur-xl shadow-[0_8px_30px_rgba(0,0,0,0.06)] overflow-hidden">
        <GoalColumn title={yearLabel} columnType="year" items={getItems("year")} direction={direction} onToggle={(id) => toggleItem("year", id)} onAdd={(text) => addItem("year", text)} onPrev={() => navigateYear(d => addYears(d, -1), -1)} onNext={() => navigateYear(d => addYears(d, 1), 1)} onToday={goToToday} dragState={dragState} onDragStart={handleDragStart} onDragMove={handleDragMove} onDragEnd={handleDragEnd} columnItemRefs={columnItemRefs} columnItemHeights={columnItemHeights} onGoalClick={(item) => { setSidebarItemId(item.id); setSidebarPrefillName(item.text); setSidebarColumnType("year"); setSidebarItemData({ notes: item.notes, color: item.color, icon: item.icon, targetValue: item.targetValue, targetPeriod: item.targetPeriod, status: item.status }); setSidebarOpen(true); }} />
      </div>
      <div data-column-type="life" className="flex-1 flex flex-col min-w-0 rounded-2xl border border-black/5 bg-white/60 backdrop-blur-xl shadow-[0_8px_30px_rgba(0,0,0,0.06)] overflow-hidden">
        <GoalColumn title="Life" columnType="life" items={getItems("life")} direction={direction} onToggle={(id) => toggleItem("life", id)} onAdd={(text) => addItem("life", text)} onPrev={() => {}} onNext={() => {}} onToday={goToToday} dragState={dragState} onDragStart={handleDragStart} onDragMove={handleDragMove} onDragEnd={handleDragEnd} columnItemRefs={columnItemRefs} columnItemHeights={columnItemHeights} showNav={false} onGoalClick={(item) => { setSidebarItemId(item.id); setSidebarPrefillName(item.text); setSidebarColumnType("life"); setSidebarItemData({ notes: item.notes, color: item.color, icon: item.icon, targetValue: item.targetValue, targetPeriod: item.targetPeriod, status: item.status }); setSidebarOpen(true); }} />
      </div>
      <GoalSidebar isOpen={sidebarOpen} onToggle={() => setSidebarOpen(!sidebarOpen)} prefillName={sidebarPrefillName} prefillNotes={sidebarItemData.notes} prefillColor={sidebarItemData.color} prefillIcon={sidebarItemData.icon} prefillTargetValue={sidebarItemData.targetValue} prefillTargetPeriod={sidebarItemData.targetPeriod} prefillStatus={sidebarItemData.status} onSave={handleSidebarSave} onClearPrefill={() => { setSidebarItemId(""); setSidebarPrefillName(""); setSidebarColumnType(null); setSidebarItemData({}); }} />
    </div>
  );
>>>>>>> bec4af2 (started goal tab)
}

export default GoalView
