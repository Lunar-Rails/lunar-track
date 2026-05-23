-- Add mood tracking columns to monthly check-ins
-- energy: 'terrible' | 'meh' | 'okay' | 'great'
-- productivity: 'waste' | 'fine' | 'ludicrous'
ALTER TABLE checkins
  ADD COLUMN IF NOT EXISTS mood_energy TEXT CHECK (mood_energy IN ('terrible', 'meh', 'okay', 'great')),
  ADD COLUMN IF NOT EXISTS mood_productivity TEXT CHECK (mood_productivity IN ('waste', 'fine', 'ludicrous'));
