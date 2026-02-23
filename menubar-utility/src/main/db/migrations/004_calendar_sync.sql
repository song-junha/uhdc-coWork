-- Add cloud sync fields to calendar_events
ALTER TABLE calendar_events ADD COLUMN remote_id TEXT;
ALTER TABLE calendar_events ADD COLUMN synced_at TEXT;
ALTER TABLE calendar_events ADD COLUMN updated_at TEXT NOT NULL DEFAULT '';
