import { useState, useCallback } from 'react'
import type { EventType } from '@/lib/eventUtils'
import { isVirtualEventId, parseVirtualEventId } from '@/lib/eventUtils'

export type RecurringEditChoice = 'only-this' | 'all-events' | 'this-and-following'
export type DeleteRecurringChoice = 'only-this' | 'all-events' | 'this-and-following'

interface RecurringEditOptions {
  event: EventType
  field: string
  newValue: any
  oldValue: any
}

export const useRecurringEvents = () => {
  const [showEditDialog, setShowEditDialog] = useState(false)
  const [showRepeatDialog, setShowRepeatDialog] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [pendingEdit, setPendingEdit] = useState<RecurringEditOptions | null>(null)
  const [pendingRepeatChange, setPendingRepeatChange] = useState<{event: EventType, newRepeat: string} | null>(null)
  const [pendingDelete, setPendingDelete] = useState<EventType | null>(null)

  const isRecurringEvent = useCallback((event: EventType): boolean => {
    // An event is recurring if it has a series_id or if it's a virtual recurrence
    return !!(event.series_id || event.isRecurringInstance)
  }, [])

  const getMasterEventId = useCallback((event: EventType): string => {
    if (isVirtualEventId(event.id)) {
      const parsed = parseVirtualEventId(event.id)
      return parsed ? parsed.masterId : event.id
    }
    return event.id
  }, [])

  const handleFieldChange = useCallback((event: EventType, field: string, newValue: any, directUpdate: (id: string, field: string, value: any) => void) => {
    const oldValue = (event as any)[field]
    
    // If event is not recurring, update directly
    if (!isRecurringEvent(event)) {
      directUpdate(event.id, field, newValue)
      return
    }

    // For recurring events, show dialog
    setPendingEdit({
      event,
      field,
      newValue,
      oldValue
    })
    setShowEditDialog(true)
  }, [isRecurringEvent])

  const handleRepeatChange = useCallback((event: EventType, newRepeat: string, directUpdate: (id: string, field: string, value: any) => void) => {
    const oldRepeat = (event as any).repeat || 'None'
    
    // If changing from non-None to None, show special dialog
    if (oldRepeat !== 'None' && newRepeat === 'None') {
      setPendingRepeatChange({ event, newRepeat })
      setShowRepeatDialog(true)
      return
    }

    // For other repeat changes, update directly
    directUpdate(event.id, 'repeat', newRepeat)
  }, [])

  const handleDelete = useCallback((event: EventType, directDelete: (id: string) => void) => {
    // If event is not recurring, delete directly
    if (!isRecurringEvent(event)) {
      directDelete(event.id)
      return
    }

    // For recurring events, show dialog
    setPendingDelete(event)
    setShowDeleteDialog(true)
  }, [isRecurringEvent])

  const cancelDialog = useCallback(() => {
    setShowEditDialog(false)
    setShowRepeatDialog(false)
    setShowDeleteDialog(false)
    setPendingEdit(null)
    setPendingRepeatChange(null)
    setPendingDelete(null)
  }, [])

  return {
    showEditDialog,
    showRepeatDialog,
    showDeleteDialog,
    pendingEdit,
    pendingRepeatChange,
    pendingDelete,
    isRecurringEvent,
    getMasterEventId,
    handleFieldChange,
    handleRepeatChange,
    handleDelete,
    cancelDialog
  }
}