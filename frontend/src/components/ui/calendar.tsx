import * as React from "react"
import {
  DayPicker,
  getDefaultClassNames,
  type DayButton,
  type DayPickerProps,
  type PropsSingle,
} from "react-day-picker"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"

type CalendarProps = DayPickerProps & PropsSingle

function Calendar({
  className,
  showOutsideDays = true,
  formatters,
  components,
  selected,
  ...props
}: CalendarProps) {
  const defaultClassNames = getDefaultClassNames()

  const [month, setMonth] = React.useState<Date | undefined>(
    selected instanceof Date ? selected : undefined
  )

  React.useEffect(() => {
    if (selected instanceof Date) {
      setMonth(selected)
    }
  }, [selected])

  return (
    <DayPicker
      {...props}
      mode="single"
      selected={selected}
      month={month}
      onMonthChange={setMonth}
      fixedWeeks
      showOutsideDays={showOutsideDays}
      captionLayout="label"
      className={cn(className)}
      formatters={{
        formatWeekdayName: (date) =>
          date.toLocaleDateString("en-US", { weekday: "narrow" }),
        ...formatters,
      }}
      classNames={{
        root: "rdp-root bg-neutral-800 text-slate-100 rounded-md w-fit",

        caption: "hidden",
        month_caption: "hidden",
        caption_label: "hidden",
        nav: "hidden",

        months: cn("flex flex-col", defaultClassNames.months),
        month: cn("flex flex-col w-full gap-2", defaultClassNames.month),

        table: "w-full border-collapse",
        weekdays: cn("flex gap-x-6", defaultClassNames.weekdays),
        weekday: cn(
          "text-s text-slate-300 font-bold tracking-wide flex-1 text-center select-none mb-4",
          defaultClassNames.weekday
        ),
        week: cn("flex w-full mt-0 gap-x-6 px-0 py-0", defaultClassNames.week),

        day: cn(
          "relative w-full h-full p-0 aspect-square select-none",
          defaultClassNames.day
        ),

        day_outside: "text-neutral-500 opacity-50",
        day_selected: "bg-slate-600 text-white",
      }}
      components={{
        DayButton: CalendarDayButton,
        WeekNumber: ({ children, ...weekProps }) => (
          <td {...weekProps}>
            <div className="flex size-(--cell-size) items-center justify-center text-center">
              {children}
            </div>
          </td>
        ),
        ...components,
      }}
    />
  )
}

function CalendarDayButton({
  className,
  day,
  modifiers,
  ...props
}: React.ComponentProps<typeof DayButton>) {
  const defaultClassNames = getDefaultClassNames()
  const ref = React.useRef<HTMLButtonElement>(null)

  const isWeekend =
    day.date.getDay() === 0 || day.date.getDay() === 6

  React.useEffect(() => {
    if (modifiers.focused) ref.current?.focus()
  }, [modifiers.focused])

  return (
    <Button
      ref={ref}
      variant="ghost"
      data-day={day.date.toLocaleDateString()}
      data-selected-single={
        modifiers.selected &&
        !modifiers.range_start &&
        !modifiers.range_end &&
        !modifiers.range_middle
      }
      className={cn(
        "h-10 w-10 rounded-full text-lg font-sf font-bold transition-colors",

        modifiers.outside
          ? "text-neutral-500 hover:bg-neutral-600/80"
          : isWeekend
          ? "text-rose-400 hover:bg-rose-500/80"
          : "text-slate-200 hover:bg-neutral-300",

        modifiers.selected && modifiers.outside
          ? "bg-neutral-700 text-neutral-300"
          : "data-[selected-single=true]:bg-slate-600 data-[selected-single=true]:text-white",

        defaultClassNames.day,
        className
      )}
      {...props}
    />
  )
}

export { Calendar, CalendarDayButton }
