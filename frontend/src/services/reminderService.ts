import { useEventsStore } from '@/store/eventsStore'
import { subMinutes } from 'date-fns'

const REMINDER_MINUTES: Record<string, number> = {
  '5 minutes before': 5,
  '10 minutes before': 10,
  '15 minutes before': 15,
  '30 minutes before': 30,
  '1 hour before': 60,
  '1 day before': 1440,
}

const alertedEvents = new Set<string>()
let intervalId: number | null = null

function checkAndAlert() {
  const now = new Date()
  const { eventsCache } = useEventsStore.getState()

  console.log('[Reminder] Checking at', now.toISOString())
  console.log('[Reminder] Events in cache:', Object.keys(eventsCache).length, 'dates')

  Object.entries(eventsCache).forEach(([, events]) => {
    events.forEach(event => {
      console.log('[Reminder] Event:', event.title, 'date:', event.date, 'time:', event.start_time, 'reminder:', event.earlyReminder)
      
      if (!event.earlyReminder || event.earlyReminder === 'None') return
      if (event.is_all_day) return
      if (alertedEvents.has(event.id)) return

      const reminderMinutes = REMINDER_MINUTES[event.earlyReminder]
      if (reminderMinutes === undefined) return

      const eventDateTime = new Date(`${event.date}T${minutesToTimeString(event.start_time)}:00`)
      const reminderTime = subMinutes(eventDateTime, reminderMinutes)

      const nowMs = now.getTime()
      const reminderMs = reminderTime.getTime()
      const eventMs = eventDateTime.getTime()

      // Only trigger when reminder time has passed AND event hasn't happened yet
      const isAfterReminder = nowMs >= reminderMs
      const isBeforeEvent = nowMs <= eventMs
      const shouldAlert = isAfterReminder && isBeforeEvent

      if (shouldAlert) {
        console.log('[Reminder] TRIGGERED for:', event.title)
        window.alert(`Reminder: "${event.title}" is ${event.earlyReminder}!`)
        alertedEvents.add(event.id)
      }
    })
  })
}

function minutesToTimeString(minutes: number): string {
  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60
  return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`
}

export function startReminderService() {
  if (intervalId !== null) return
  
  alertedEvents.clear()
  intervalId = window.setInterval(checkAndAlert, 10000)
  console.log('Reminder service started')
}

export function stopReminderService() {
  if (intervalId !== null) {
    clearInterval(intervalId)
    intervalId = null
    console.log('Reminder service stopped')
  }
}
