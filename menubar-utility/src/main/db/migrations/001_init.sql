-- Todo (local + sync target)
CREATE TABLE IF NOT EXISTS todos (
  id            TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  title         TEXT NOT NULL,
  description   TEXT DEFAULT '',
  status        TEXT NOT NULL DEFAULT 'todo' CHECK(status IN ('todo', 'in_progress', 'done')),
  priority      TEXT NOT NULL DEFAULT 'medium' CHECK(priority IN ('low', 'medium', 'high', 'urgent')),
  due_date      TEXT,
  assignee_id   TEXT,
  team_id       TEXT,
  sort_order    INTEGER NOT NULL DEFAULT 0,
  remote_id     TEXT,
  synced_at     TEXT,
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_todos_team ON todos(team_id);
CREATE INDEX IF NOT EXISTS idx_todos_status ON todos(status);

-- Memo folders (tree structure)
CREATE TABLE IF NOT EXISTS memo_folders (
  id            TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  parent_id     TEXT REFERENCES memo_folders(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  sort_order    INTEGER NOT NULL DEFAULT 0,
  is_expanded   INTEGER NOT NULL DEFAULT 1,
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_memo_folders_parent ON memo_folders(parent_id);

-- Memos
CREATE TABLE IF NOT EXISTS memos (
  id            TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  folder_id     TEXT NOT NULL REFERENCES memo_folders(id) ON DELETE CASCADE,
  title         TEXT NOT NULL,
  content       TEXT DEFAULT '',
  sort_order    INTEGER NOT NULL DEFAULT 0,
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_memos_folder ON memos(folder_id);

-- Calendar events
CREATE TABLE IF NOT EXISTS calendar_events (
  id            TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  title         TEXT NOT NULL,
  memo          TEXT DEFAULT '',
  event_date    TEXT NOT NULL,
  event_time    TEXT NOT NULL,
  repeat_type   TEXT DEFAULT 'none' CHECK(repeat_type IN ('none', 'daily', 'weekly', 'monthly')),
  alert_before  INTEGER NOT NULL DEFAULT 0,
  is_snoozed    INTEGER NOT NULL DEFAULT 0,
  snooze_until  TEXT,
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_calendar_date ON calendar_events(event_date);

-- Jira ticket history
CREATE TABLE IF NOT EXISTS jira_history (
  id            TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  ticket_key    TEXT NOT NULL,
  summary       TEXT NOT NULL,
  project_key   TEXT NOT NULL,
  issue_type    TEXT NOT NULL,
  jira_url      TEXT NOT NULL,
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

-- App settings (key-value)
CREATE TABLE IF NOT EXISTS settings (
  key           TEXT PRIMARY KEY,
  value         TEXT NOT NULL
);

-- Default settings
INSERT OR IGNORE INTO settings (key, value) VALUES
  ('theme', 'system'),
  ('jira_base_url', ''),
  ('jira_email', ''),
  ('jira_api_token', ''),
  ('supabase_url', ''),
  ('supabase_anon_key', ''),
  ('global_hotkey', 'CommandOrControl+Shift+M');
