-- ============================================
-- MenuBar Utility - Supabase Schema
-- Run this in Supabase SQL Editor (Dashboard > SQL)
-- ============================================

-- =====================
-- STEP 1: Create Tables
-- =====================

-- 1. Profiles (extends auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
  id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email       TEXT NOT NULL,
  display_name TEXT NOT NULL DEFAULT '',
  avatar_url  TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Teams
CREATE TABLE IF NOT EXISTS public.teams (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  type        TEXT NOT NULL DEFAULT 'default' CHECK (type IN ('default', 'spot')),
  description TEXT DEFAULT '',
  created_by  UUID NOT NULL REFERENCES auth.users(id),
  is_archived BOOLEAN NOT NULL DEFAULT false,
  archived_at TIMESTAMPTZ,
  member_count INTEGER DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. Team Members
CREATE TABLE IF NOT EXISTS public.team_members (
  id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id   UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  user_id   UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role      TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('admin', 'member')),
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(team_id, user_id)
);

-- 4. Invitations
CREATE TABLE IF NOT EXISTS public.invitations (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id       UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  invited_email TEXT NOT NULL,
  invited_by    UUID NOT NULL REFERENCES auth.users(id),
  status        TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at    TIMESTAMPTZ NOT NULL
);

-- 5. Shared Todos (sync target)
CREATE TABLE IF NOT EXISTS public.shared_todos (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  local_id      TEXT,
  team_id       UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  title         TEXT NOT NULL,
  description   TEXT DEFAULT '',
  status        TEXT NOT NULL DEFAULT 'todo' CHECK (status IN ('todo', 'in_progress', 'done')),
  priority      TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  due_date      TEXT,
  assignee_name TEXT DEFAULT '',
  assignee_id   TEXT,
  sort_order    INTEGER DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_shared_todos_team ON public.shared_todos(team_id);

-- ==========================
-- STEP 2: Enable RLS on all
-- ==========================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shared_todos ENABLE ROW LEVEL SECURITY;

-- ========================
-- STEP 3: RLS Policies
-- ========================

-- Profiles
CREATE POLICY "Users can view all profiles"
  ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile"
  ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- Teams
CREATE POLICY "Team members can view their teams"
  ON public.teams FOR SELECT
  USING (id IN (SELECT team_id FROM public.team_members WHERE user_id = auth.uid()));
CREATE POLICY "Authenticated users can create teams"
  ON public.teams FOR INSERT WITH CHECK (auth.uid() = created_by);
CREATE POLICY "Team admins can update teams"
  ON public.teams FOR UPDATE
  USING (id IN (SELECT team_id FROM public.team_members WHERE user_id = auth.uid() AND role = 'admin'));

-- Team Members
CREATE POLICY "Team members can view their team members"
  ON public.team_members FOR SELECT
  USING (team_id IN (SELECT tm.team_id FROM public.team_members tm WHERE tm.user_id = auth.uid()));
CREATE POLICY "Team admins can insert members"
  ON public.team_members FOR INSERT
  WITH CHECK (
    team_id IN (SELECT tm.team_id FROM public.team_members tm WHERE tm.user_id = auth.uid() AND tm.role = 'admin')
    OR user_id = auth.uid()
  );
CREATE POLICY "Team admins can delete members"
  ON public.team_members FOR DELETE
  USING (team_id IN (SELECT tm.team_id FROM public.team_members tm WHERE tm.user_id = auth.uid() AND tm.role = 'admin'));

-- Invitations
CREATE POLICY "Team members can view invitations"
  ON public.invitations FOR SELECT
  USING (team_id IN (SELECT team_id FROM public.team_members WHERE user_id = auth.uid()));
CREATE POLICY "Team admins can create invitations"
  ON public.invitations FOR INSERT
  WITH CHECK (team_id IN (SELECT team_id FROM public.team_members WHERE user_id = auth.uid() AND role = 'admin'));

-- Shared Todos
CREATE POLICY "Team members can view shared todos"
  ON public.shared_todos FOR SELECT
  USING (team_id IN (SELECT team_id FROM public.team_members WHERE user_id = auth.uid()));
CREATE POLICY "Team members can insert shared todos"
  ON public.shared_todos FOR INSERT
  WITH CHECK (team_id IN (SELECT team_id FROM public.team_members WHERE user_id = auth.uid()));
CREATE POLICY "Team members can update shared todos"
  ON public.shared_todos FOR UPDATE
  USING (team_id IN (SELECT team_id FROM public.team_members WHERE user_id = auth.uid()));
CREATE POLICY "Team members can delete shared todos"
  ON public.shared_todos FOR DELETE
  USING (team_id IN (SELECT team_id FROM public.team_members WHERE user_id = auth.uid()));

-- ========================
-- STEP 4: Triggers
-- ========================

CREATE OR REPLACE FUNCTION update_team_member_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.teams SET member_count = (SELECT count(*) FROM public.team_members WHERE team_id = NEW.team_id) WHERE id = NEW.team_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.teams SET member_count = (SELECT count(*) FROM public.team_members WHERE team_id = OLD.team_id) WHERE id = OLD.team_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_update_member_count
AFTER INSERT OR DELETE ON public.team_members
FOR EACH ROW EXECUTE FUNCTION update_team_member_count();

-- ========================
-- STEP 5: Realtime
-- ========================

ALTER PUBLICATION supabase_realtime ADD TABLE public.shared_todos;
ALTER PUBLICATION supabase_realtime ADD TABLE public.team_members;
ALTER PUBLICATION supabase_realtime ADD TABLE public.invitations;
