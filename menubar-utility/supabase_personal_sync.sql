-- ═══════════════════════════════════════════════════════════════
-- Personal Cloud Sync Tables for MenuBar Utility
-- Run this in Supabase SQL Editor (Dashboard > SQL Editor)
-- ═══════════════════════════════════════════════════════════════

-- 1. User Todos (personal, no team_id)
CREATE TABLE IF NOT EXISTS user_todos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  local_id TEXT,
  title TEXT NOT NULL,
  description TEXT DEFAULT '',
  status TEXT NOT NULL DEFAULT 'todo' CHECK (status IN ('todo', 'in_progress', 'done')),
  priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  due_date TEXT,
  assignee_name TEXT DEFAULT '',
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_user_todos_user ON user_todos(user_id);

-- 2. User Memo Folders
CREATE TABLE IF NOT EXISTS user_memo_folders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  local_id TEXT,
  parent_remote_id UUID,
  name TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_expanded BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_user_memo_folders_user ON user_memo_folders(user_id);

-- 3. User Memos
CREATE TABLE IF NOT EXISTS user_memos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  local_id TEXT,
  folder_remote_id UUID REFERENCES user_memo_folders(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  content TEXT DEFAULT '',
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_user_memos_user ON user_memos(user_id);
CREATE INDEX IF NOT EXISTS idx_user_memos_folder ON user_memos(folder_remote_id);

-- ═══════════════════════════════════════════════════════════════
-- RLS Policies (each user can only access their own data)
-- ═══════════════════════════════════════════════════════════════

ALTER TABLE user_todos ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_memo_folders ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_memos ENABLE ROW LEVEL SECURITY;

-- user_todos policies
CREATE POLICY "Users can read own todos"
  ON user_todos FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own todos"
  ON user_todos FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own todos"
  ON user_todos FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own todos"
  ON user_todos FOR DELETE
  USING (auth.uid() = user_id);

-- user_memo_folders policies
CREATE POLICY "Users can read own folders"
  ON user_memo_folders FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own folders"
  ON user_memo_folders FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own folders"
  ON user_memo_folders FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own folders"
  ON user_memo_folders FOR DELETE
  USING (auth.uid() = user_id);

-- user_memos policies
CREATE POLICY "Users can read own memos"
  ON user_memos FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own memos"
  ON user_memos FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own memos"
  ON user_memos FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own memos"
  ON user_memos FOR DELETE
  USING (auth.uid() = user_id);

-- ═══════════════════════════════════════════════════════════════
-- Enable Realtime
-- ═══════════════════════════════════════════════════════════════

ALTER PUBLICATION supabase_realtime ADD TABLE user_todos;
ALTER PUBLICATION supabase_realtime ADD TABLE user_memo_folders;
ALTER PUBLICATION supabase_realtime ADD TABLE user_memos;
