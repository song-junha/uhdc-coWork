import { create } from 'zustand';
import type { AuthUser, Team, TeamMember, CreateGroupDto } from '../../../shared/types/team.types';

type TeamView = 'list' | 'members' | 'createGroup' | 'invite';

interface TeamStore {
  user: AuthUser | null;
  teams: Team[];
  activeTeamId: string | null;
  members: TeamMember[];
  isConfigured: boolean;
  isLoading: boolean;
  error: string | null;
  view: TeamView;

  checkConfigured: () => Promise<void>;
  checkAuth: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, displayName: string) => Promise<void>;
  signOut: () => Promise<void>;
  fetchTeams: () => Promise<void>;
  fetchMembers: (teamId: string) => Promise<void>;
  createGroup: (data: CreateGroupDto) => Promise<void>;
  archiveGroup: (groupId: string) => Promise<void>;
  invite: (teamId: string, email: string) => Promise<void>;
  removeMember: (teamId: string, userId: string) => Promise<void>;
  setActiveTeam: (teamId: string) => void;
  setView: (view: TeamView) => void;
  clearError: () => void;
}

export const useTeamStore = create<TeamStore>((set, get) => ({
  user: null,
  teams: [],
  activeTeamId: null,
  members: [],
  isConfigured: false,
  isLoading: false,
  error: null,
  view: 'list',

  checkConfigured: async () => {
    const url = await window.electronAPI.settings.get('supabase_url') || import.meta.env.VITE_SUPABASE_URL;
    const key = await window.electronAPI.settings.get('supabase_anon_key') || import.meta.env.VITE_SUPABASE_ANON_KEY;
    set({ isConfigured: !!(url && key) });
  },

  checkAuth: async () => {
    set({ isLoading: true });
    try {
      const user = await window.electronAPI.auth.getSession();
      set({ user });
      if (user) await get().fetchTeams();
    } catch {
      set({ user: null });
    } finally {
      set({ isLoading: false });
    }
  },

  signIn: async (email, password) => {
    set({ isLoading: true, error: null });
    try {
      const user = await window.electronAPI.auth.signIn(email, password);
      set({ user });
      await get().fetchTeams();
    } catch (err) {
      set({ error: (err as Error).message });
      throw err;
    } finally {
      set({ isLoading: false });
    }
  },

  signUp: async (email, password, displayName) => {
    set({ isLoading: true, error: null });
    try {
      const user = await window.electronAPI.auth.signUp(email, password, displayName);
      set({ user });
      await get().fetchTeams();
    } catch (err) {
      set({ error: (err as Error).message });
      throw err;
    } finally {
      set({ isLoading: false });
    }
  },

  signOut: async () => {
    await window.electronAPI.auth.signOut();
    set({ user: null, teams: [], activeTeamId: null, members: [], view: 'list' });
  },

  fetchTeams: async () => {
    try {
      const teams = await window.electronAPI.team.getMyTeams();
      set({ teams });
    } catch {
      set({ teams: [] });
    }
  },

  fetchMembers: async (teamId) => {
    set({ isLoading: true });
    try {
      const members = await window.electronAPI.team.getMembers(teamId);
      set({ members });
    } catch {
      set({ members: [] });
    } finally {
      set({ isLoading: false });
    }
  },

  createGroup: async (data) => {
    set({ isLoading: true, error: null });
    try {
      await window.electronAPI.team.createSpotGroup(data);
      await get().fetchTeams();
      set({ view: 'list' });
    } catch (err) {
      set({ error: (err as Error).message });
    } finally {
      set({ isLoading: false });
    }
  },

  archiveGroup: async (groupId) => {
    await window.electronAPI.team.archiveGroup(groupId);
    await get().fetchTeams();
    set({ view: 'list', activeTeamId: null });
  },

  invite: async (teamId, email) => {
    set({ error: null });
    try {
      await window.electronAPI.team.invite(teamId, email);
    } catch (err) {
      set({ error: (err as Error).message });
    }
  },

  removeMember: async (teamId, userId) => {
    await window.electronAPI.team.removeMember(teamId, userId);
    await get().fetchMembers(teamId);
  },

  setActiveTeam: (teamId) => {
    set({ activeTeamId: teamId, view: 'members' });
    get().fetchMembers(teamId);
  },

  setView: (view) => set({ view }),
  clearError: () => set({ error: null }),
}));
