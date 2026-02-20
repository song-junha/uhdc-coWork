-- Add assignee_name column for display name (free text, before Supabase user sync)
ALTER TABLE todos ADD COLUMN assignee_name TEXT DEFAULT '';
