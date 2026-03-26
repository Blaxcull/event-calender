-- Supabase Migration: Add Recurring Events Support
-- Run this SQL in your Supabase SQL Editor to add recurring events functionality

-- ============================================
-- IMPORTANT: Backup your database before running!
-- ============================================

BEGIN;

-- 1. Add new columns for series tracking
ALTER TABLE events 
ADD COLUMN IF NOT EXISTS series_id UUID,
ADD COLUMN IF NOT EXISTS is_series_master BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS series_position INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS repeat VARCHAR(20) DEFAULT 'None',
ADD COLUMN IF NOT EXISTS repeat_end_date DATE,
ADD COLUMN IF NOT EXISTS original_event_id UUID;

-- 2. Update existing data to maintain consistency
-- Each existing event becomes its own standalone series
UPDATE events 
SET 
  series_id = id,  -- Use event ID as series ID for standalone events
  is_series_master = true,
  series_position = 0,
  repeat = COALESCE(repeat, 'None'),  -- Ensure repeat has a value
  repeat_end_date = NULL
WHERE series_id IS NULL;

-- 3. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_events_series_id ON events(series_id);
CREATE INDEX IF NOT EXISTS idx_events_date_series ON events(date, series_id);
CREATE INDEX IF NOT EXISTS idx_events_repeat ON events(repeat) WHERE repeat != 'None';

-- 4. Optional: Add foreign key constraint for series_id (cascade delete)
-- Uncomment if you want to delete all events in a series when master is deleted
-- ALTER TABLE events 
-- ADD CONSTRAINT fk_events_series 
-- FOREIGN KEY (series_id) 
-- REFERENCES events(id) 
-- ON DELETE CASCADE;

-- 5. Optional: Add data integrity constraints
-- Uncomment these if you want strict data validation
-- ALTER TABLE events 
-- ADD CONSTRAINT check_series_id_for_recurring 
-- CHECK (
--   (repeat = 'None' AND series_id IS NULL) OR 
--   (repeat != 'None' AND series_id IS NOT NULL)
-- );

-- ALTER TABLE events 
-- ADD CONSTRAINT check_master_series 
-- CHECK (
--   (is_series_master = true AND series_position = 0) OR
--   (is_series_master = false AND series_position > 0)
-- );

COMMIT;

-- ============================================
-- VERIFICATION QUERIES (Run after migration)
-- ============================================

-- Check if columns were added successfully
SELECT 
  column_name, 
  data_type, 
  is_nullable,
  column_default
FROM information_schema.columns 
WHERE table_name = 'events' 
  AND column_name IN ('series_id', 'is_series_master', 'series_position', 'repeat', 'repeat_end_date', 'original_event_id')
ORDER BY column_name;

-- Check data consistency
SELECT 
  COUNT(*) as total_events,
  COUNT(CASE WHEN repeat != 'None' THEN 1 END) as recurring_events,
  COUNT(CASE WHEN series_id IS NULL THEN 1 END) as events_without_series_id,
  COUNT(CASE WHEN is_series_master IS NULL THEN 1 END) as events_without_master_flag
FROM events;

-- Sample query to see recurring events
SELECT 
  id,
  title,
  date,
  repeat,
  series_id,
  is_series_master,
  series_position
FROM events 
WHERE repeat != 'None'
ORDER BY series_id, series_position
LIMIT 10;