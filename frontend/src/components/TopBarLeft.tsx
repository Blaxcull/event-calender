import { Button } from "@/components/ui/button"

interface TopBarLeftProps {
  onAddClick?: () => void
}

export function TopBarLeft({ onAddClick }: TopBarLeftProps) {
  return (
    <div className="fixed top-4 left-4 z-50 flex items-center gap-3">

      {/* grouped icons */}
      <div className="group flex items-center border-[1px]  rounded-full shadow-sm">

        <div className="h-16 w-16 flex items-center justify-center hover:shadow-xl cursor-pointer  rounded-full transition-all duration-150 hover:scale-105 active:scale-95">
        <img src="/src/assets/goal.png" alt="goals" className="w-9 h-9 opacity-80" />
        </div>

        {/* divider */}
        <div className="w-px h-9 bg-gray-300 transition-opacity duration-150 group-hover:opacity-0" />

        <div className="h-16 w-16 flex items-center justify-center cursor-pointer hover:shadow-xl rounded-full transition-all duration-150 hover:scale-105 active:scale-95">
          <img src="/src/assets/calendar2.png" alt="Calendar" className="w-7 h-7 opacity-80" />
        </div>

      </div>

      {/* plus button */}
<Button
  variant="ghost"
  onClick={onAddClick}
  className="
  h-16 w-16
  rounded-full
  shadow-lg
  border-[1px]
  text-slate-600
  transition-all duration-200 ease-out
  hover:text-slate-800
  hover:scale-110
  hover:shadow-xl
  active:scale-95
  flex items-center justify-center"
>

          <img src="/src/assets/plus.png" alt="Calendar" className="w-7 h-7 opacity-80" />
</Button>
</div>
  )
}
