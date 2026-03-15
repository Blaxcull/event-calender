-- Exceptions table for overrides/deletes on specific dates per series
CREATE TABLE IF NOT EXISTS exceptions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  series_id UUID REFERENCES events(id) ON DELETE CASCADE NOT NULL,
  date DATE NOT NULL,
  title TEXT,
  start_time INTEGER,
  end_time INTEGER,
  deleted BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(series_id, date)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_exceptions_series_date ON exceptions(series_id, date);
CREATE INDEX IF NOT EXISTS idx_exceptions_date ON exceptions(date);
CREATE INDEX IF NOT EXISTS idx_exceptions_series ON exceptions(series_id);

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_exceptions_updated_at ON exceptions;
CREATE TRIGGER update_exceptions_updated_at BEFORE UPDATE
ON exceptions FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
