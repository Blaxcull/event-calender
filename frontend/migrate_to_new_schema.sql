-- Migration: Move existing recurring events to new schema
-- Run this in Supabase SQL Editor

-- Step 1: Migrate existing recurring events from events table to recurring_series
-- Handle events that have series_id (new splits) and events that are masters
INSERT INTO recurring_series (
  id,
  user_id,
  title,
  description,
  notes,
  urls,
  start_date,
  end_date,
  repeat_type,
  start_time,
  end_time,
  color,
  is_all_day,
  location,
  created_at,
  updated_at
)
SELECT 
  id as id,
  user_id,
  title,
  description,
  notes,
  ARRAY[]::text[] as urls,
  date as start_date,
  repeat_end_date as end_date,
  COALESCE(repeat, 'Daily')::varchar as repeat_type,
  COALESCE(start_time, 0) as start_time,
  COALESCE(end_time, 60) as end_time,
  COALESCE(color, '#3b82f6') as color,
  COALESCE(is_all_day, false) as is_all_day,
  location,
  COALESCE(created_at, NOW()) as created_at,
  NOW() as updated_at
FROM events
WHERE repeat IS NOT NULL 
  AND repeat != 'None'
  AND id NOT IN (SELECT id FROM recurring_series)
ON CONFLICT DO NOTHING;

-- Step 2: Verify migration
SELECT 'recurring_series migration' as info, COUNT(*) as count FROM recurring_series
UNION ALL
SELECT 'events with repeat' as info, COUNT(*) FROM events WHERE repeat IS NOT NULL AND repeat != 'None';

-- Step 3: Show migrated data
SELECT id, user_id, title, start_date, end_date, repeat_type 
FROM recurring_series 
ORDER BY created_at DESC 
LIMIT 10;
