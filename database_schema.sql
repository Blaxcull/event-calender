-- Events Calendar Database Schema for Supabase
-- Run this in Supabase SQL Editor

-- Drop existing table and related objects if they exist
DROP TRIGGER IF EXISTS update_events_updated_at ON events;
DROP FUNCTION IF EXISTS update_updated_at_column();
DROP FUNCTION IF EXISTS get_events_for_date(DATE);
DROP TABLE IF EXISTS events;

-- Create events table with new fields
CREATE TABLE IF NOT EXISTS events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  description TEXT,                    -- Event details/notes
  notes TEXT,                          -- Additional notes for event editor
  urls TEXT[],                         -- Array of URLs for event
  date DATE NOT NULL,                  -- Calendar date (YYYY-MM-DD)
  end_date DATE,                       -- End date for multi-day events (YYYY-MM-DD), nullable for backward compatibility
  start_time INTEGER NOT NULL,         -- Minutes since midnight (0-1439)
  end_time INTEGER NOT NULL,           -- Minutes since midnight
  color TEXT DEFAULT '#3b82f6',        -- Event color (hex code)
  is_all_day BOOLEAN DEFAULT false,    -- All-day event flag
  location TEXT,                       -- Event location
  early_reminder TEXT,                 -- Early reminder setting (e.g., "5 minutes before")
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Validation constraints
  CHECK (start_time >= 0 AND start_time < 1440),
  CHECK ((end_time > start_time AND end_time <= 1440) OR (end_time >= 0 AND end_time < start_time)),
  CHECK (date >= '2020-01-01' AND date <= '2100-12-31')
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS events_user_id_idx ON events(user_id);
CREATE INDEX IF NOT EXISTS events_date_idx ON events(date);
CREATE INDEX IF NOT EXISTS events_user_date_idx ON events(user_id, date);

-- Function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger to update updated_at on row update
CREATE TRIGGER update_events_updated_at
  BEFORE UPDATE ON events
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Enable Row Level Security (RLS)
ALTER TABLE events ENABLE ROW LEVEL SECURITY;

-- Row Level Security Policies

-- Users can view their own events
CREATE POLICY "Users can view own events" 
  ON events FOR SELECT 
  USING (auth.uid() = user_id);

-- Users can insert their own events
CREATE POLICY "Users can insert own events" 
  ON events FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own events
CREATE POLICY "Users can update own events" 
  ON events FOR UPDATE 
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Users can delete their own events
CREATE POLICY "Users can delete own events" 
  ON events FOR DELETE 
  USING (auth.uid() = user_id);

-- Helper function to get events for a specific date range
CREATE OR REPLACE FUNCTION get_events_for_date_range(
  p_start_date DATE,
  p_end_date DATE
)
RETURNS TABLE (
  id UUID,
  title TEXT,
  description TEXT,
  date DATE,
  start_time INTEGER,
  end_time INTEGER,
  color TEXT,
  is_all_day BOOLEAN,
  location TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    e.id,
    e.title,
    e.description,
    e.date,
    e.start_time,
    e.end_time,
    e.color,
    e.is_all_day,
    e.location,
    e.created_at,
    e.updated_at
  FROM events e
  WHERE e.user_id = auth.uid()
    AND e.date >= p_start_date
    AND e.date <= p_end_date
  ORDER BY e.date, e.start_time;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Helper function to get events for a specific date
CREATE OR REPLACE FUNCTION get_events_for_date(p_date DATE)
RETURNS TABLE (
  id UUID,
  title TEXT,
  description TEXT,
  date DATE,
  start_time INTEGER,
  end_time INTEGER,
  color TEXT,
  is_all_day BOOLEAN,
  location TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    e.id,
    e.title,
    e.description,
    e.date,
    e.start_time,
    e.end_time,
    e.color,
    e.is_all_day,
    e.location,
    e.created_at,
    e.updated_at
  FROM events e
  WHERE e.user_id = auth.uid()
    AND e.date = p_date
  ORDER BY e.start_time;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Sample data for testing (optional)
-- INSERT INTO events (user_id, title, description, date, start_time, end_time, color, is_all_day, location) VALUES
--   ('00000000-0000-0000-0000-000000000000', 'Team Meeting', 'Weekly standup meeting', '2025-02-16', 540, 600, '#3b82f6', false, 'Conference Room A'),  -- 9:00-10:00
--   ('00000000-0000-0000-0000-000000000000', 'Lunch Break', 'Team lunch', '2025-02-16', 720, 780, '#22c55e', false, 'Cafeteria'),   -- 12:00-13:00
--   ('00000000-0000-0000-0000-000000000000', 'Project Review', 'Q1 project review', '2025-02-16', 840, 900, '#f59e0b', false, 'Meeting Room B'), -- 14:00-15:00
--   ('00000000-0000-0000-0000-000000000000', 'Holiday', 'Company holiday', '2025-02-17', 0, 1440, '#ef4444', true, NULL); -- All day
