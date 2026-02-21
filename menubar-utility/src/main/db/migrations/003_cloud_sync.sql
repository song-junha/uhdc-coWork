-- Add cloud sync fields to memo_folders
ALTER TABLE memo_folders ADD COLUMN remote_id TEXT;
ALTER TABLE memo_folders ADD COLUMN synced_at TEXT;
ALTER TABLE memo_folders ADD COLUMN updated_at TEXT NOT NULL DEFAULT (datetime('now'));

-- Add cloud sync fields to memos
ALTER TABLE memos ADD COLUMN remote_id TEXT;
ALTER TABLE memos ADD COLUMN synced_at TEXT;

-- Default setting for cloud sync (OFF by default)
INSERT OR IGNORE INTO settings (key, value) VALUES ('cloud_sync_enabled', 'false');
