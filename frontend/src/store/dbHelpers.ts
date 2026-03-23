/**
 * Helper functions for building Supabase database operation payloads.
 */
import type { Event, NewEvent } from './types'

/**
 * Build a database-ready event object from a NewEvent, excluding undefined fields.
 * Maps camelCase UI fields to snake_case DB columns where they differ.
 */
export function buildEventForDb(
  event: Partial<NewEvent>,
  userId: string
): Record<string, any> {
  const row: Record<string, any> = {
    title: event.title,
    date: event.date,
    end_date: event.end_date || event.date,
    start_time: event.start_time,
    end_time: event.end_time,
    user_id: userId,
  }

  // Only include optional fields when defined (avoids overwriting with null)
  const optionalFields: Array<keyof NewEvent> = [
    'description', 'notes', 'urls', 'color',
    'is_all_day', 'location', 'repeat',
    'series_start_date', 'series_end_date',
  ]

  for (const field of optionalFields) {
    if (event[field] !== undefined) {
      row[field] = event[field]
    }
  }

  // Map camelCase to snake_case for DB columns
  if (event.earlyReminder !== undefined) {
    row.early_reminder = event.earlyReminder
  }

  return row
}

/**
 * Filter an updates object to only include fields valid for the DB schema.
 * Maps camelCase UI field names to snake_case DB column names.
 */
export function filterUpdatesForDb(updates: Partial<NewEvent>): Record<string, any> {
  const filtered: Record<string, any> = {}

  // Direct mapping (same name in DB)
  const directFields = [
    'title', 'date', 'end_date', 'start_time', 'end_time',
    'repeat', 'series_start_date', 'series_end_date',
    'is_all_day', 'description', 'notes', 'urls', 'color', 'location',
  ]

  for (const [key, value] of Object.entries(updates)) {
    if (value === undefined) continue

    if (directFields.includes(key)) {
      filtered[key] = value
    } else if (key === 'earlyReminder') {
      filtered.early_reminder = value
    }
  }

  return filtered
}

/**
 * Convert a DB row (supabase response) to an Event object.
 */
export function dbRowToEvent(row: Record<string, any>): Event {
  return {
    id: row.id,
    user_id: row.user_id,
    title: row.title,
    description: row.description,
    notes: row.notes,
    urls: row.urls,
    date: row.date,
    end_date: row.end_date,
    start_time: row.start_time,
    end_time: row.end_time,
    color: row.color,
    is_all_day: row.is_all_day,
    location: row.location,
    repeat: row.repeat,
    series_start_date: row.series_start_date,
    series_end_date: row.series_end_date,
    earlyReminder: row.early_reminder,
    created_at: row.created_at,
    updated_at: row.updated_at,
  }
}

/**
 * Generate a unique temporary ID for optimistic local events.
 */
export function generateTempId(): string {
  return `local-${Date.now()}-${Math.random().toString(36).slice(2)}`
}
