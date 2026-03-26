import { useState, useRef, useEffect, useCallback } from "react";
import { ChevronLeft, ChevronRight, GripVertical } from "lucide-react";
import { startOfWeek, endOfWeek, addWeeks, addMonths, addYears, format } from "date-fns";
import { motion, AnimatePresence } from "framer-motion";

interface TodoItem {
  id: string;
  text: string;
  completed: boolean;
}

type ColumnType = 'week' | 'month' | 'year' | 'life';

type TodoStore = Record<string, TodoItem[]>;

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
  enter: (dir: number) => ({ x: dir > 0 ? 450 : -450, opacity: 1 }),
  center: { x: 0, opacity: 1 },
  exit: (dir: number) => ({ x: dir > 0 ? -450 : 450, opacity: 1 }),
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
  onDrop: (fromType: ColumnType, toType: ColumnType, itemId: string) => void;
  showNav?: boolean;
}

function GoalColumn({ title, columnType, items, direction, onToggle, onAdd, onPrev, onNext, onToday, onDrop, showNav = true }: GoalColumnProps) {
  const [isAdding, setIsAdding] = useState(false);
  const [newText, setNewText] = useState("");
  const [isHovering, setIsHovering] = useState(false);
  const [isAreaHovering, setIsAreaHovering] = useState(false);
  const draggingRef = useRef<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const blurTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

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

  const handleMouseDown = useCallback((itemId: string, e: React.MouseEvent) => {
    draggingRef.current = itemId;
    (e.currentTarget as HTMLElement).style.opacity = "0.4";

    const source = e.currentTarget as HTMLElement;
    const rect = source.getBoundingClientRect();

    const ghost = document.createElement("div");
    ghost.style.cssText = `position:fixed;pointer-events:none;z-index:9999;width:${rect.width}px;height:${rect.height}px;background:${getComputedStyle(source).background};border-radius:8px;display:flex;align-items:center;padding:0 4px;gap:8px;box-shadow:0 8px 24px rgba(0,0,0,0.2);opacity:0.9;font-size:14px;`;
    ghost.innerHTML = source.innerHTML;
    ghost.style.left = rect.left + "px";
    ghost.style.top = rect.top + "px";
    document.body.appendChild(ghost);

    const offsetX = e.clientX - rect.left;
    const offsetY = e.clientY - rect.top;

    const handleMouseMove = (ev: MouseEvent) => {
      ghost.style.left = ev.clientX - offsetX + "px";
      ghost.style.top = ev.clientY - offsetY + "px";
    };

    const handleMouseUp = (ev: MouseEvent) => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "";
      ghost.remove();
      source.style.opacity = "";

      const el = document.elementFromPoint(ev.clientX, ev.clientY);
      const dropZone = el?.closest("[data-column-type]");
      if (dropZone) {
        const toType = dropZone.getAttribute("data-column-type") as ColumnType;
        if (toType !== columnType) {
          onDrop(columnType, toType, itemId);
        }
      }
      draggingRef.current = null;
    };

    document.body.style.cursor = "grabbing";
    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
  }, [columnType, onDrop]);

  return (
    <div
      className="flex flex-col flex-1 transition-all duration-200"
      data-column-type={columnType}
      onMouseEnter={() => setIsHovering(true)}
      onMouseLeave={() => setIsHovering(false)}
    >
      <div className="flex-1 flex flex-col relative px-4 pt-4 overflow-hidden">
        <AnimatePresence mode="popLayout" initial={false} custom={direction}>
          <motion.div
            key={title}
            custom={direction}
            variants={slideVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.25, ease: "easeOut" }}
            className="flex flex-col h-full"
          >
            <h2 className="text-6xl font-extrabold tracking-tight text-foreground mb-3">
              {title}
            </h2>

            <div className="flex flex-col gap-0.5 overflow-y-auto no-scrollbar">
              {items.map((item) => (
                <div
                  key={item.id}
                  onMouseDown={(e) => handleMouseDown(item.id, e)}
                  style={{ cursor: "grab" }}
                  className="flex items-center gap-2 py-1.5 px-1 rounded select-none hover:bg-foreground/10 group"
                >
                  <GripVertical className="h-3 w-3 text-muted-foreground/0 group-hover:text-muted-foreground/60 transition-colors shrink-0" />
                  <input
                    type="checkbox"
                    checked={item.completed}
                    onChange={() => onToggle(item.id)}
                    className="h-4 w-4 shrink-0 accent-primary cursor-pointer"
                  />
                  <span className={`text-sm transition-all duration-200 ${item.completed ? "line-through text-muted-foreground" : "text-foreground"}`}>
                    {item.text}
                  </span>
                </div>
              ))}

              {isAdding ? (
                <div className="flex items-center gap-2 py-1.5 px-1">
                  <div className="w-3" />
                  <input type="checkbox" disabled className="h-4 w-4 opacity-30" />
                  <input
                    ref={inputRef}
                    value={newText}
                    onChange={(e) => setNewText(e.target.value)}
                    onBlur={handleBlur}
                    onKeyDown={handleKeyDown}
                    className="bg-transparent border-none outline-none text-sm text-foreground w-full"
                    placeholder="Type here..."
                  />
                </div>
              ) : (
                <button onClick={(e) => { e.stopPropagation(); setIsAdding(true); }} className={`text-sm py-1.5 px-2 text-left rounded transition-colors ml-5 ${isAreaHovering ? "text-foreground bg-foreground/10" : "text-muted-foreground hover:text-foreground hover:bg-foreground/10"}`}>
                  Add...
                </button>
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
          <button onClick={onPrev} className="h-9 w-9 flex items-center justify-center rounded-full bg-[#e2e2e1] hover:bg-[#d6d6d5] transition-all duration-200 ease-out hover:scale-110 hover:shadow-md active:scale-95">
            <ChevronLeft className="h-5 w-5 text-[#404040]" />
          </button>
          <button onClick={onToday} className="px-5 py-2 rounded-full bg-[#e2e2e1] hover:bg-[#d6d6d5] text-sm font-semibold text-[#404040] transition-all duration-200 ease-out hover:scale-105 hover:shadow-md active:scale-95">
            Today
          </button>
          <button onClick={onNext} className="h-9 w-9 flex items-center justify-center rounded-full bg-[#e2e2e1] hover:bg-[#d6d6d5] transition-all duration-200 ease-out hover:scale-110 hover:shadow-md active:scale-95">
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
  const [store, setStore] = useState<TodoStore>(() => {
    try {
      const saved = localStorage.getItem("todo-store");
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

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

  const moveItem = (fromType: ColumnType, toType: ColumnType, itemId: string) => {
    const fromKey = getKey(fromType, getDate(fromType));
    const toKey = getKey(toType, getDate(toType));
    const fromItems = store[fromKey] || [];
    const toItems = store[toKey] || [];
    const item = fromItems.find(i => i.id === itemId);
    if (!item || fromKey === toKey) return;
    save({
      ...store,
      [fromKey]: fromItems.filter(i => i.id !== itemId),
      [toKey]: [...toItems, item],
    });
  };

  const handleDrop = (fromType: ColumnType, toType: ColumnType, itemId: string) => {
    moveItem(fromType, toType, itemId);
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
    <div className="flex w-full min-h-screen bg-background p-4 pt-[120px] gap-4">
      <div data-column-type="week" className="flex-1 flex flex-col min-w-0 rounded-xl border border-border bg-card shadow-sm overflow-hidden">
        <GoalColumn title={weekLabel} columnType="week" items={getItems("week")} direction={direction} onToggle={(id) => toggleItem("week", id)} onAdd={(text) => addItem("week", text)} onPrev={() => navigate(d => addWeeks(d, -1), -1)} onNext={() => navigate(d => addWeeks(d, 1), 1)} onToday={goToToday} onDrop={handleDrop} />
      </div>
      <div data-column-type="month" className="flex-1 flex flex-col min-w-0 rounded-xl border border-border bg-card shadow-sm overflow-hidden">
        <GoalColumn title={monthLabel} columnType="month" items={getItems("month")} direction={direction} onToggle={(id) => toggleItem("month", id)} onAdd={(text) => addItem("month", text)} onPrev={() => navigate(d => addMonths(d, -1), -1)} onNext={() => navigate(d => addMonths(d, 1), 1)} onToday={goToToday} onDrop={handleDrop} />
      </div>
      <div data-column-type="year" className="flex-1 flex flex-col min-w-0 rounded-xl border border-border bg-card shadow-sm overflow-hidden">
        <GoalColumn title={yearLabel} columnType="year" items={getItems("year")} direction={direction} onToggle={(id) => toggleItem("year", id)} onAdd={(text) => addItem("year", text)} onPrev={() => navigateYear(d => addYears(d, -1), -1)} onNext={() => navigateYear(d => addYears(d, 1), 1)} onToday={() => { setDirection(1); setYearDate(new Date()); }} onDrop={handleDrop} />
      </div>
      <div data-column-type="life" className="flex-1 flex flex-col min-w-0 rounded-xl border border-border bg-card shadow-sm overflow-hidden">
        <GoalColumn title="Life" columnType="life" items={getItems("life")} direction={direction} onToggle={(id) => toggleItem("life", id)} onAdd={(text) => addItem("life", text)} onPrev={() => {}} onNext={() => {}} onToday={goToToday} onDrop={handleDrop} showNav={false} />
      </div>
    </div>
  );
}

export default GoalView
