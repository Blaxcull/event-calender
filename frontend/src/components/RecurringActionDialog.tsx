import React from "react"
import { Dialog, DialogContent } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"

export type RecurringActionChoice =
  | "only-this"
  | "all-events"
  | "this-and-following"
  | "cancel"

export type RecurringActionType = "edit" | "delete"

interface RecurringActionDialogProps {
  open: boolean
  onChoice: (choice: RecurringActionChoice) => void
  actionType: RecurringActionType
  eventTitle: string
}

const RecurringActionDialog: React.FC<RecurringActionDialogProps> = ({
  open,
  onChoice,
  actionType,
  eventTitle,
}) => {
  if (!open) return null

  const isDelete = actionType === "delete"
  const title = isDelete ? "Delete" : "Edit"

  return (
    <Dialog open={open} onOpenChange={() => onChoice("cancel")}>
      <DialogContent
        className="
          w-[360px] p-0 overflow-hidden rounded-2xl shadow-xl border border-neutral-200
        "
      >
        {/* HEADER */}
        <div className="px-6 pt-5 pb-3">
          <h2 className="text-lg font-semibold text-neutral-900">
            {title} event
          </h2>
          <p className="text-sm text-neutral-500 truncate mt-1">
            "{eventTitle}"
          </p>
        </div>

        {/* OPTIONS */}
        <div className="px-2 pb-2">
          <button
            onClick={() => onChoice("only-this")}
            className="w-full text-left px-4 py-3 rounded-xl text-sm font-medium text-neutral-700 hover:bg-neutral-100 transition-all duration-150 active:scale-[0.98]"
          >
            Only this event
          </button>
          <button
            onClick={() => onChoice("this-and-following")}
            className="w-full text-left px-4 py-3 rounded-xl text-sm font-medium text-neutral-700 hover:bg-neutral-100 transition-all duration-150 active:scale-[0.98]"
          >
            This and following
          </button>
          <button
            onClick={() => onChoice("all-events")}
            className={`w-full text-left px-4 py-3 rounded-xl text-sm font-medium transition-all duration-150 active:scale-[0.98] ${
              isDelete
                ? "text-red-600 hover:bg-red-50"
                : "text-neutral-700 hover:bg-neutral-100"
            }`}
          >
            All events
          </button>
        </div>

        {/* DIVIDER */}
        <div className="h-px bg-neutral-200 mx-4" />

        {/* CANCEL */}
        <div className="p-2">
          <Button
            variant="ghost"
            className="w-full h-11 rounded-xl text-neutral-500 hover:text-neutral-700 hover:bg-neutral-100 transition"
            onClick={() => onChoice("cancel")}
          >
            Cancel
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

export default RecurringActionDialog
