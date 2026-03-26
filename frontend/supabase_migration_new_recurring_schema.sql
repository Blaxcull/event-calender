-- New Recurring Events Schema
-- Run this in Supabase SQL Editor to create new tables for recurring events

BEGIN;

-- ============================================
-- Table: recurring_series
-- Stores the master recurring event definition
-- ============================================
CREATE TABLE IF NOT EXISTS recurring_series (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  notes TEXT,
  urls TEXT[],
  start_date DATE NOT NULL,
  end_date DATE,  -- NULL = indefinite
  repeat_type VARCHAR(20) NOT NULL DEFAULT 'Daily',
  start_time INTEGER NOT NULL DEFAULT 0,
  end_time INTEGER NOT NULL DEFAULT 60,
  color TEXT DEFAULT '#3b82f6',
  is_all_day BOOLEAN DEFAULT false,
  location TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT valid_repeat_type CHECK (repeat_type IN ('Daily', 'Weekly', 'Monthly', 'Yearly', 'None')),
  CONSTRAINT valid_date_range CHECK (start_date >= '2020-01-01' AND start_date <= '2100-12-31')
);

-- Indexes for recurring_series
CREATE INDEX IF NOT EXISTS idx_recurring_series_user_id ON recurring_series(user_id);
CREATE INDEX IF NOT EXISTS idx_recurring_series_user_date ON recurring_series(user_id, start_date);

-- ============================================
-- Table: event_exceptions
-- Stores overrides for specific dates in a recurring series
-- ============================================
CREATE TABLE IF NOT EXISTS event_exceptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  series_id UUID REFERENCES recurring_series(id) ON DELETE CASCADE NOT NULL,
  date DATE NOT NULL,
  title TEXT,  -- Override title (NULL = use series title)
  notes TEXT,  -- Override notes
  urls TEXT[],  -- Override URLs
  start_time INTEGER,  -- Override start time (NULL = use series time)
  end_time INTEGER,    -- Override end time
  color TEXT,          -- Override color
  is_all_day BOOLEAN,  -- Override all-day flag
  location TEXT,       -- Override location
  is_cancelled BOOLEAN DEFAULT false,  -- true = don't show this date
  is_deleted BOOLEAN DEFAULT false,     -- true = event was deleted on this date
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT unique_series_date UNIQUE (series_id, date),
  CONSTRAINT valid_exception_date CHECK (date >= '2020-01-01' AND date <= '2100-12-31')
);

-- Indexes for event_exceptions
CREATE INDEX IF NOT EXISTS idx_event_exceptions_series_id ON event_exceptions(series_id);
CREATE INDEX IF NOT EXISTS idx_event_exceptions_series_date ON event_exceptions(series_id, date);

-- ============================================
-- Update existing events table
-- Add series_id foreign key to link events to recurring_series
-- Add series_start_date and series_end_date for recurring events
-- ============================================
ALTER TABLE events 
ADD COLUMN IF NOT EXISTS series_id UUID REFERENCES recurring_series(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS series_start_date DATE,  -- Start date of the recurring series
ADD COLUMN IF NOT EXISTS series_end_date DATE;   -- End date of the recurring series

-- Create index for events linked to series
CREATE INDEX IF NOT EXISTS idx_events_series_id ON events(series_id);
CREATE INDEX IF NOT EXISTS idx_events_series_dates ON events(series_start_date, series_end_date);

-- ============================================
-- Enable RLS on new tables
-- ============================================
ALTER TABLE recurring_series ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_exceptions ENABLE ROW LEVEL SECURITY;

-- RLS Policies for recurring_series (use IF NOT EXISTS to handle re-runs)
DROP POLICY IF EXISTS "Users can view own recurring_series" ON recurring_series;
DROP POLICY IF EXISTS "Users can insert own recurring_series" ON recurring_series;
DROP POLICY IF EXISTS "Users can update own recurring_series" ON recurring_series;
DROP POLICY IF EXISTS "Users can delete own recurring_series" ON recurring_series;

CREATE POLICY "Users can view own recurring_series" 
  ON recurring_series FOR SELECT 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own recurring_series" 
  ON recurring_series FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own recurring_series" 
  ON recurring_series FOR UPDATE 
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own recurring_series" 
  ON recurring_series FOR DELETE 
  USING (auth.uid() = user_id);

-- RLS Policies for event_exceptions
DROP POLICY IF EXISTS "Users can view own event_exceptions" ON event_exceptions;
DROP POLICY IF EXISTS "Users can insert own event_exceptions" ON event_exceptions;
DROP POLICY IF EXISTS "Users can update own event_exceptions" ON event_exceptions;
DROP POLICY IF EXISTS "Users can delete own event_exceptions" ON event_exceptions;

CREATE POLICY "Users can view own event_exceptions" 
  ON event_exceptions FOR SELECT 
  USING (
    EXISTS (
      SELECT 1 FROM recurring_series 
      WHERE recurring_series.id = event_exceptions.series_id 
      AND recurring_series.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert own event_exceptions" 
  ON event_exceptions FOR INSERT 
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM recurring_series 
      WHERE recurring_series.id = event_exceptions.series_id 
      AND recurring_series.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update own event_exceptions" 
  ON event_exceptions FOR UPDATE 
  USING (
    EXISTS (
      SELECT 1 FROM recurring_series 
      WHERE recurring_series.id = event_exceptions.series_id 
      AND recurring_series.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete own event_exceptions" 
  ON event_exceptions FOR DELETE 
  USING (
    EXISTS (
      SELECT 1 FROM recurring_series 
      WHERE recurring_series.id = event_exceptions.series_id 
      AND recurring_series.user_id = auth.uid()
    )
  );

-- ============================================
-- Function to get events for a date (including recurring)
-- ============================================
CREATE OR REPLACE FUNCTION get_events_for_date_range(
  p_user_id UUID,
  p_start_date DATE,
  p_end_date DATE
)
RETURNS TABLE (
  id UUID,
  title TEXT,
  description TEXT,
  notes TEXT,
  urls TEXT[],
  date DATE,
  end_date DATE,
  start_time INTEGER,
  end_time INTEGER,
  color TEXT,
  is_all_day BOOLEAN,
  location TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  series_id UUID,
  is_recurring_instance BOOLEAN,
  original_event_id UUID
) AS $$
BEGIN
  RETURN QUERY
  WITH recurring_occurrences AS (
    -- Generate all occurrences from recurring_series within date range
    SELECT 
      rs.id AS series_id,
      rs.title,
      rs.description,
      rs.notes,
      rs.urls,
      generate_series(rs.start_date, COALESCE(rs.end_date, p_end_date), 
        CASE rs.repeat_type
          WHEN 'Daily' THEN INTERVAL '1 day'
          WHEN 'Weekly' THEN INTERVAL '7 days'
          WHEN 'Monthly' THEN INTERVAL '1 month'
          WHEN 'Yearly' THEN INTERVAL '1 year'
          ELSE INTERVAL '1 day'
        END
      )::DATE AS occurrence_date,
      rs.start_time,
      rs.end_time,
      rs.color,
      rs.is_all_day,
      rs.location,
      rs.created_at,
      rs.updated_at
    FROM recurring_series rs
    WHERE rs.user_id = p_user_id
      AND rs.start_date <= p_end_date
      AND (rs.end_date IS NULL OR rs.end_date >= p_start_date)
  )
  SELECT 
    CASE 
      WHEN e.id IS NOT NULL THEN e.id
      ELSE ro.series_id || '-' || ro.occurrence_date::TEXT
    END AS id,
    COALESCE(e.title, ro.title) AS title,
    COALESCE(e.description, ro.description) AS description,
    COALESCE(e.notes, ro.notes) AS notes,
    COALESCE(e.urls, ro.urls) AS urls,
    COALESCE(e.date, ro.occurrence_date) AS date,
    COALESCE(e.date, ro.occurrence_date) AS end_date,
    COALESCE(e.start_time, ro.start_time) AS start_time,
    COALESCE(e.end_time, ro.end_time) AS end_time,
    COALESCE(e.color, ro.color) AS color,
    COALESCE(e.is_all_day, ro.is_all_day) AS is_all_day,
    COALESCE(e.location, ro.location) AS location,
    COALESCE(e.created_at, ro.created_at) AS created_at,
    COALESCE(e.updated_at, ro.updated_at) AS updated_at,
    ro.series_id,
    CASE WHEN e.id IS NULL THEN true ELSE false END AS is_recurring_instance,
    NULL::UUID AS original_event_id
  FROM recurring_occurrences ro
  LEFT JOIN event_exceptions exc ON exc.series_id = ro.series_id 
    AND exc.date = ro.occurrence_date
    AND (exc.is_cancelled = true OR exc.is_deleted = true)
  LEFT JOIN events e ON e.series_id = ro.series_id 
    AND e.date = ro.occurrence_date
  WHERE exc.id IS NULL  -- Exclude cancelled/deleted dates
    AND ro.occurrence_date BETWEEN p_start_date AND p_end_date
  ORDER BY COALESCE(e.start_time, ro.start_time);
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- Migration helper: Convert existing recurring events
-- Run this to migrate data from events table to new schema
-- ============================================
CREATE OR REPLACE FUNCTION migrate_existing_recurring_events()
RETURNS void AS $$
DECLARE
  event_record RECORD;
BEGIN
  -- Loop through events with repeat != 'None'
  FOR event_record IN 
    SELECT * FROM events 
    WHERE repeat IS NOT NULL 
      AND repeat != 'None'
      AND repeat != 'None'::VARCHAR
  LOOP
    -- Insert into recurring_series
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
      location
    ) VALUES (
      COALESCE(event_record.series_id, event_record.id),
      event_record.user_id,
      event_record.title,
      event_record.description,
      event_record.notes,
      event_record.urls,
      event_record.date,
      event_record.repeat_end_date,
      event_record.repeat,
      event_record.start_time,
      event_record.end_time,
      event_record.color,
      event_record.is_all_day,
      event_record.location
    )
    ON CONFLICT DO NOTHING;
    
    -- Update events table to link to series
    UPDATE events 
    SET series_id = COALESCE(event_record.series_id, event_record.id)
    WHERE id = event_record.id;
  END LOOP;
  
  RAISE NOTICE 'Migration completed';
END;
$$ LANGUAGE plpgsql;

COMMIT;

-- ============================================
-- Verification queries
-- ============================================

-- Check new tables exist
SELECT 
  table_name, 
  table_type 
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name IN ('recurring_series', 'event_exceptions');

-- Check columns in recurring_series
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'recurring_series'
ORDER BY ordinal_position;

-- Check columns in event_exceptions  
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'event_exceptions'
ORDER BY ordinal_position;

-- Check if events table has series_id
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'events' AND column_name = 'series_id';