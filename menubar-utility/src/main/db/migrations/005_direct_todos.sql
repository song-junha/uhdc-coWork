-- Add is_direct flag to todos: 1 = received from someone else via direct_todos
ALTER TABLE todos ADD COLUMN is_direct INTEGER NOT NULL DEFAULT 0;
