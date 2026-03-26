-- ESSENTIAL Supabase Migration for Recurring Events
-- Minimal commands needed for the recurring events system to work

-- ============================================
-- RUN THESE COMMANDS IN SUPABASE SQL EDITOR
-- ============================================

-- 1. Add required columns
ALTER TABLE events 
ADD COLUMN IF NOT EXISTS series_id UUID,
ADD COLUMN IF NOT EXISTS is_series_master BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS series_position INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS repeat VARCHAR(20) DEFAULT 'None',
ADD COLUMN IF NOT EXISTS repeat_end_date DATE;

-- 2. Update existing data
UPDATE events 
SET 
  series_id = id,
  is_series_master = true,
  series_position = 0,
  repeat = COALESCE(repeat, 'None'),
  repeat_end_date = NULL
WHERE series_id IS NULL;

-- 3. Create index for performance
CREATE INDEX IF NOT EXISTS idx_events_series_id ON events(series_id);

-- Done! The recurring events system should now work.