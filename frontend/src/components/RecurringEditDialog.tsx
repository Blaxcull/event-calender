import React from "react"
import { Dialog, DialogContent, DialogHeader, DialogBody } from "./ui/dialog"
import { Button } from "./ui/button"
import type { EventType } from '@/lib/eventUtils'

export type RecurringEditChoice = 'only-this' | 'all-events' | 'this-and-following'

interface RecurringEditDialogProps {
  open: boolean
  onClose: () => void
  onChoice: (choice: RecurringEditChoice) => void
  event: EventType
  field: string
  newValue: any
  oldValue: any
}

const RecurringEditDialog: React.FC<RecurringEditDialogProps> = ({
  open,
  onClose,
  onChoice,
  event,
  field
}) => {
  const handleChoice = (choice: RecurringEditChoice) => {
    onChoice(choice)
    onClose()
  }

  // Determine message based on field type
  const getMessage = () => {
    const truncatedTitle = event.title.length > 30 ? `${event.title.substring(0, 30)}...` : event.title
    const isVirtual = event.isRecurringInstance
    
    if (isVirtual) {
      return `You're editing a recurring event occurrence. Edit only this occurrence or all occurrences in the series?`
    }
    
    if (field === 'date' || field === 'start_time' || field === 'end_time') {
      return `"${truncatedTitle}" is a recurring event. Changing the time/date affects the series. Edit only this occurrence or all occurrences?`
    }
    
    return `"${truncatedTitle}" is a recurring event. Edit only this occurrence or all occurrences?`
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="w-[400px]">
        <DialogHeader>
          <h3 className="text-xl font-semibold text-neutral-800">Edit Recurring Event</h3>
        </DialogHeader>
        
        <DialogBody>
          <div className="space-y-4">
            <p className="text-neutral-600 text-sm">
              {getMessage()}
            </p>
            
            <div className="space-y-2">
              <Button
                onClick={() => handleChoice('only-this')}
                className="w-full justify-start text-left h-auto py-3 px-4 bg-red-500 hover:bg-red-600 text-white"
              >
                <div className="flex flex-col items-start">
                  <span className="font-medium">Only this event</span>
                  <span className="text-sm font-normal opacity-90">
                    Edit only this occurrence. Creates a standalone event.
                  </span>
                </div>
              </Button>
              
              <Button
                onClick={() => handleChoice('all-events')}
                className="w-full justify-start text-left h-auto py-3 px-4 bg-neutral-200 hover:bg-neutral-300 text-neutral-800"
              >
                <div className="flex flex-col items-start">
                  <span className="font-medium">All events in series</span>
                  <span className="text-sm font-normal opacity-90">
                    Edit all occurrences in this recurring series.
                  </span>
                </div>
              </Button>
              
              <Button
                onClick={() => handleChoice('this-and-following')}
                className="w-full justify-start text-left h-auto py-3 px-4 bg-neutral-200 hover:bg-neutral-300 text-neutral-800"
              >
                <div className="flex flex-col items-start">
                  <span className="font-medium">This and all following events</span>
                  <span className="text-sm font-normal opacity-90">
                    Split series and edit from this point forward.
                  </span>
                </div>
              </Button>
            </div>
            
            <div className="pt-2">
              <Button
                onClick={onClose}
                className="w-full bg-transparent hover:bg-neutral-100 text-neutral-600 border border-neutral-300"
              >
                Cancel
              </Button>
            </div>
          </div>
        </DialogBody>
      </DialogContent>
    </Dialog>
  )
}

export default RecurringEditDialog