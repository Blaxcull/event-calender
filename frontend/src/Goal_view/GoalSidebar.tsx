import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronRight, CircleDot, Palette, Shapes, Target } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./select";
import { useGoals } from "./useGoals";
import type { Goal } from "./goal";
import { DEFAULT_GOAL_ICON, GOAL_COLORS, GOAL_ICONS, normalizeGoalIcon } from "./goal";

interface GoalSidebarProps {
  isOpen: boolean;
  onToggle: () => void;
  prefillName: string;
  prefillNotes?: string;
  prefillColor?: string;
  prefillIcon?: string;
  prefillTargetValue?: number;
  prefillTargetPeriod?: Goal["targetPeriod"];
  prefillStatus?: Goal["status"];
  onSave: (data: {
    text: string;
    notes: string;
    color: string;
    icon: string;
    targetValue: number;
    targetPeriod: Goal["targetPeriod"];
    status: Goal["status"];
  }) => void;
  onClearPrefill: () => void;
}

const GoalSidebar = ({
  isOpen,
  onToggle,
  prefillName,
  prefillNotes,
  prefillColor,
  prefillIcon,
  prefillTargetValue,
  prefillTargetPeriod,
  prefillStatus,
  onSave,
  onClearPrefill,
}: GoalSidebarProps) => {
  const { addGoal, updateGoal } = useGoals();
  const sidebarRef = useRef<HTMLDivElement>(null);
  const [editingGoal, setEditingGoal] = useState<Goal | null>(null);

  const [name, setName] = useState("");
  const [color, setColor] = useState(GOAL_COLORS[0].value);
  const [targetValue, setTargetValue] = useState("7");
  const [targetPeriod, setTargetPeriod] = useState<Goal["targetPeriod"]>("week");
  const [status, setStatus] = useState<Goal["status"]>("active");
  const [description, setDescription] = useState("");
  const [icon, setIcon] = useState(DEFAULT_GOAL_ICON);

  useEffect(() => {
    if (prefillName) {
      setName(prefillName);
      setColor(prefillColor || GOAL_COLORS[0].value);
      setTargetValue(prefillTargetValue ? String(prefillTargetValue) : "7");
      setTargetPeriod(prefillTargetPeriod || "week");
      setStatus(prefillStatus || "active");
      setDescription(prefillNotes || "");
      setIcon(normalizeGoalIcon(prefillIcon));
      setEditingGoal(null);
    }
  }, [prefillName, prefillNotes, prefillColor, prefillIcon, prefillTargetValue, prefillTargetPeriod, prefillStatus]);

  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.closest("[data-goal-sidebar-trigger='true']")) {
        return;
      }
      if (sidebarRef.current && !sidebarRef.current.contains(event.target as Node)) {
        onToggle();
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen, onToggle]);

  const resetForm = () => {
    setName("");
    setColor(GOAL_COLORS[0].value);
    setTargetValue("7");
    setTargetPeriod("week");
    setStatus("active");
    setDescription("");
    setIcon(DEFAULT_GOAL_ICON);
    setEditingGoal(null);
  };

  const handleSave = () => {
    if (!name.trim()) return;

    if (!editingGoal && prefillName) {
      onSave({
        text: name.trim(),
        notes: description.trim(),
        color,
        icon,
        targetValue: parseInt(targetValue) || 1,
        targetPeriod,
        status,
      });
      resetForm();
      onClearPrefill();
      onToggle();
      return;
    }

    const data = {
      name: name.trim(),
      color,
      targetValue: parseInt(targetValue) || 1,
      targetPeriod,
      status,
      description: description.trim() || undefined,
      icon,
    };

    if (editingGoal) updateGoal(editingGoal.id, data);
    else addGoal(data);

    resetForm();
    onToggle();
  };

  const title = prefillName ? "Edit Goal" : "Create Goal";

  return (
    <>
      <AnimatePresence>
        {!isOpen && (
          <motion.button
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 10 }}
            onClick={onToggle}
            className="fixed right-0 top-1/2 z-50 -translate-y-1/2 rounded-l-lg border border-gray-300 bg-neutral-200 p-2 shadow-sm transition-all duration-200 ease-out hover:scale-110 hover:bg-neutral-300"
          >
            <ChevronRight className="h-4 w-4 rotate-180 text-neutral-700" />
          </motion.button>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            ref={sidebarRef}
            initial={{ x: 570 }}
            animate={{ x: 0 }}
            exit={{ x: 570 }}
            transition={{ duration: 0.3, ease: [0.25, 0.1, 0.25, 1] }}
            className="fixed right-0 top-0 bottom-0 z-50 flex w-[570px] flex-col overflow-hidden border-l border-gray-300 bg-neutral-100 text-neutral-800"
          >
            <div className="px-4 pb-3 pt-4 shrink-0">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="mt-2 text-[28px] font-semibold text-neutral-800">{title}</h2>
                </div>
                <button
                  onClick={onToggle}
                  className="rounded-full bg-neutral-200 p-2 text-neutral-700 transition-all duration-200 ease-out hover:scale-110 hover:bg-neutral-300 hover:shadow-md active:scale-95"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="flex-1 mt-10 overflow-y-auto no-scrollbar px-4 pb-4">
              <div className="w-full rounded-[52px] border border-neutral-100 bg-[#ececec] px-5 py-6 shadow-none">
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Goal Name"
                  autoFocus
                  className="w-full bg-transparent border-none outline-none text-5xl font-bold leading-tight text-neutral-600 placeholder:text-neutral-600"
                />
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Notes"
                  rows={3}
                  className="mt-3 w-full resize-none bg-transparent border-none outline-none text-xl font-bold leading-7 text-neutral-500 placeholder:text-neutral-500 [&::-webkit-scrollbar]:hidden"
                />
              </div>

              <div className="mt-5 w-full rounded-[52px] border border-neutral-100 bg-[#ececec] pl-5 pr-6 py-6 shadow-none">
                <div className="flex items-center justify-between py-1 px-0">
                  <div className="flex items-center gap-3">
                    <Palette className="w-7 h-7 text-neutral-600 opacity-30" />
                    <span className="pl-2 text-2xl shrink-0 text-neutral-800">Color</span>
                  </div>

                  <div className="flex items-center gap-2">
                    {GOAL_COLORS.map((c) => (
                      <button
                        key={c.value}
                        onClick={() => setColor(c.value)}
                        className={`h-6 w-6 rounded-full transition-all ${
                          color === c.value ? "ring-2 ring-neutral-500 ring-offset-2 ring-offset-[#ececec]" : "hover:scale-110"
                        }`}
                        style={{ backgroundColor: `hsl(${c.value})` }}
                      />
                    ))}
                  </div>
                </div>

                <hr className="border-neutral-300 border-t-[2px] my-3" />

                <div className="flex items-center justify-between py-1 px-0">
                  <div className="flex items-center gap-3">
                    <Target className="w-7 h-7 text-neutral-600 opacity-30" />
                    <span className="pl-2 text-2xl shrink-0 text-neutral-800">Target</span>
                  </div>

                  <div className="flex items-center gap-2 text-2xl text-neutral-700">
                    <input
                      type="number"
                      min="1"
                      value={targetValue}
                      onChange={(e) => setTargetValue(e.target.value)}
                      className="w-12 bg-transparent border-none outline-none text-right text-2xl text-neutral-700"
                    />
                    <span>hrs /</span>
                    <Select value={targetPeriod} onValueChange={(v) => setTargetPeriod(v as Goal["targetPeriod"])}>
                      <SelectTrigger className="h-auto w-auto gap-1 border-none bg-transparent p-0 text-2xl text-neutral-700 shadow-none [&>svg]:h-4 [&>svg]:w-4 [&>svg]:text-neutral-600">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="week">Week</SelectItem>
                        <SelectItem value="month">Month</SelectItem>
                        <SelectItem value="year">Year</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <hr className="border-neutral-300 border-t-[2px] my-3" />

                <div className="flex items-center justify-between py-1 px-0">
                  <div className="flex items-center gap-3">
                    <CircleDot className="w-7 h-7 text-neutral-600 opacity-30" />
                    <span className="pl-2 text-2xl shrink-0 text-neutral-800">Status</span>
                  </div>

                  <Select value={status} onValueChange={(v) => setStatus(v as Goal["status"])}>
                    <SelectTrigger className="h-auto w-auto gap-1 border-none bg-transparent p-0 text-2xl text-neutral-700 shadow-none [&>svg]:h-4 [&>svg]:w-4 [&>svg]:text-neutral-600">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="paused">Paused</SelectItem>
                      <SelectItem value="completed">Completed</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="mt-5 w-full rounded-[52px] border border-neutral-100 bg-[#ececec] pl-5 pr-6 py-6 shadow-none">
                <div className="flex items-center justify-between py-1 px-0">
                  <div className="flex items-center gap-3">
                    <Shapes className="w-7 h-7 text-neutral-600 opacity-30" />
                    <span className="pl-2 text-2xl shrink-0 text-neutral-800">Icon</span>
                  </div>
                  <span className="text-xl text-neutral-600">
                    {GOAL_ICONS.find((item) => item.value === icon)?.label ?? "Select"}
                  </span>
                </div>

                <hr className="border-neutral-300 border-t-[2px] my-3" />

                <div className="flex flex-wrap gap-2 pt-1">
                  {GOAL_ICONS.map((item) => {
                    const Icon = item.icon;
                    const isSelected = icon === item.value;

                    return (
                      <button
                        key={item.value}
                        onClick={() => setIcon(item.value)}
                        title={item.label}
                        className={`flex h-14 w-14 items-center justify-center rounded-full transition-all ${
                          isSelected
                            ? "bg-red-500 text-white shadow-sm"
                            : "bg-neutral-300 text-neutral-700 hover:bg-neutral-400"
                        }`}
                      >
                        <Icon className="h-5 w-5" />
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="mt-auto border-t border-gray-200 bg-neutral-100 px-4 pb-4 pt-4">
              <button
                onClick={handleSave}
                disabled={!name.trim()}
                className="w-full rounded-full bg-red-600 px-8 py-3 text-lg font-semibold text-white transition-all duration-200 ease-out hover:bg-red-700 hover:shadow-md active:scale-95 disabled:cursor-not-allowed disabled:bg-gray-400"
              >
                Save
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export default GoalSidebar;
