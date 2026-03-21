import React from "react"
import { Dialog, DialogContent } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"

export type RecurringActionChoice = "only-this" | "all-events" | "this-and-following" | "cancel"

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

  const actionText = actionType === "edit" ? "change" : "delete"
  const title = actionType === "edit" 
    ? `Edit "${eventTitle}"` 
    : `Delete "${eventTitle}"`

  return (
    <Dialog open={open} onOpenChange={() => onChoice("cancel")}>
      <DialogContent className="w-[400px] p-6 dialog-no-transition" onClose={() => onChoice("cancel")}>
        <div className="space-y-4">
          <h2 className="text-xl font-semibold text-neutral-800">{title}</h2>
          <p className="text-neutral-600">
            This is a recurring event. How would you like to {actionText} it?
          </p>
          
          <div className="space-y-2 pt-2">
            <Button
              variant="secondary"
              className="w-full justify-start text-left h-auto py-3 px-4"
              onClick={() => onChoice("only-this")}
            >
              <div>
                <span className="font-medium">1. Only this event</span>
                <p className="text-sm text-neutral-500 font-normal">
                  {actionText === "delete" 
                    ? "Delete only this occurrence" 
                    : "Change only this occurrence"}
                </p>
              </div>
            </Button>
            
            <Button
              variant="secondary"
              className="w-full justify-start text-left h-auto py-3 px-4"
              onClick={() => onChoice("all-events")}
            >
              <div>
                <span className="font-medium">2. All events</span>
                <p className="text-sm text-neutral-500 font-normal">
                  {actionText === "delete"
                    ? "Delete entire series"
                    : "Change all occurrences"}
                </p>
              </div>
            </Button>
            
            <Button
              variant="secondary"
              className="w-full justify-start text-left h-auto py-3 px-4"
              onClick={() => onChoice("this-and-following")}
            >
              <div>
                <span className="font-medium">3. This and following</span>
                <p className="text-sm text-neutral-500 font-normal">
                  {actionText === "delete"
                    ? "Delete this and future occurrences"
                    : "Change this and future occurrences"}
                </p>
              </div>
            </Button>

            <Button
              variant="outline"
              className="w-full justify-center mt-4"
              onClick={() => onChoice("cancel")}
            >
              Cancel
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

export default RecurringActionDialog
