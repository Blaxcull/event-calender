import React from "react"
import { Dialog, DialogContent, DialogHeader, DialogBody } from "./ui/dialog"
import { Button } from "./ui/button"
import type { EventType } from '@/lib/eventUtils'

export type RepeatChangeChoice = 'only-this' | 'this-and-following'

interface RepeatChangeDialogProps {
  open: boolean
  onClose: () => void
  onChoice: (choice: RepeatChangeChoice) => void
  event: EventType
  newRepeat: string
}

const RepeatChangeDialog: React.FC<RepeatChangeDialogProps> = ({
  open,
  onClose,
  onChoice,
  event
}) => {
  const handleChoice = (choice: RepeatChangeChoice) => {
    onChoice(choice)
    onClose()
  }

  const truncatedTitle = event.title.length > 30 ? `${event.title.substring(0, 30)}...` : event.title

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="w-[400px]">
        <DialogHeader>
          <h3 className="text-xl font-semibold text-neutral-800">Remove Repeat</h3>
        </DialogHeader>
        
        <DialogBody>
          <div className="space-y-4">
            <p className="text-neutral-600 text-sm">
              You're removing repeat from "{truncatedTitle}". Do you want to remove repeat from only this occurrence or from this and all future occurrences?
            </p>
            
            <div className="space-y-2">
              <Button
                onClick={() => handleChoice('only-this')}
                className="w-full justify-start text-left h-auto py-3 px-4 bg-red-500 hover:bg-red-600 text-white"
              >
                <div className="flex flex-col items-start">
                  <span className="font-medium">Only this event</span>
                  <span className="text-sm font-normal opacity-90">
                    Remove repeat from just this occurrence. Other occurrences will continue.
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
                    Remove repeat from this and all future occurrences.
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

export default RepeatChangeDialog