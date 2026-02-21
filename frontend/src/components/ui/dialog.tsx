import React from "react"
import { X } from "lucide-react"

interface DialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  children: React.ReactNode
}

export function Dialog({ open, onOpenChange, children }: DialogProps) {
  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div 
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={() => onOpenChange(false)}
      />
      <div className="relative z-10">
        {children}
      </div>
    </div>
  )
}

interface DialogContentProps {
  children: React.ReactNode
  className?: string
  onClose?: () => void
}

export function DialogContent({ children, className = "", onClose }: DialogContentProps) {
  return (
    <div className={`bg-neutral-800 border border-neutral-600 rounded-xl shadow-2xl ${className}`}>
      {onClose && (
        <button
          onClick={onClose}
          className="absolute top-3 right-3 text-neutral-400 hover:text-white p-1"
        >
          <X className="h-5 w-5" />
        </button>
      )}
      {children}
    </div>
  )
}

interface DialogHeaderProps {
  children: React.ReactNode
}

export function DialogHeader({ children }: DialogHeaderProps) {
  return (
    <div className="px-4 py-3 border-b border-neutral-600">
      {children}
    </div>
  )
}

interface DialogBodyProps {
  children: React.ReactNode
}

export function DialogBody({ children }: DialogBodyProps) {
  return (
    <div className="p-4">
      {children}
    </div>
  )
}
