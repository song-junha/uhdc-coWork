import { create } from 'zustand';
import type { AuthUser, Team, TeamMember, CreateGroupDto } from '../../../shared/types/team.types';

type TeamView = 'list' | 'members' | 'createGroup' | 'invite';

interface TeamStore {
  user: AuthUser | null;
  teams: Team[];
  activeTeamId: string | null;
  members: TeamMember[];
  isJiraConfigured: boolean;
  isLoading: boolean;
  error: string | null;
  view: TeamView;

  checkAndAuth: () => Promise<void>;
  signOut: () => Promise<void>;
  fetchTeams: () => Promise<void>;
  fetchMembers: (teamId: string) => Promise<void>;
  createGroup: (data: CreateGroupDto) => Promise<void>;
  archiveGroup: (groupId: string) => Promise<void>;
  deleteGroup: (groupId: string) => Promise<void>;
  renameGroup: (groupId: string, name: string) => Promise<void>;
  addMember: (teamId: string, jiraAccountId: string, displayName: string, email: string) => Promise<void>;
  removeMember: (teamId: string, memberId: string) => Promise<void>;
  setActiveTeam: (teamId: string) => void;
  setView: (view: TeamView) => void;
  clearError: () => void;
}

export const useTeamStore = create<TeamStore>((set, get) => ({
  user: null,
  teams: [],
  activeTeamId: null,
  members: [],
  isJiraConfigured: false,
  isLoading: false,
  error: null,
  view: 'list',

  // Jira 설정 확인 → 자동 Supabase 인증 → 팀 로드
  checkAndAuth: async () => {
    set({ isLoading: true });
    try {
      const jiraUrl = await window.electronAPI.settings.get('jira_base_url');
      const jiraEmail = await window.electronAPI.settings.get('jira_email');
      const jiraToken = await window.electronAPI.settings.get('jira_api_token');
      const jiraOk = !!(jiraUrl && jiraEmail && jiraToken);
      set({ isJiraConfigured: jiraOk });

      if (!jiraOk) {
        set({ user: null });
        return;
      }

      // Jira가 설정되어 있으면 자동 인증
      const user = await window.electronAPI.auth.autoAuth();
      set({ user });
      if (user) {
        await get().fetchTeams();
      } else {
        set({ error: 'auth.supabaseAuthFailed' });
      }
    } catch (err) {
      set({ user: null, error: (err as Error).message });
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
      await window.electronAPI.team.createGroup(data);
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

  deleteGroup: async (groupId) => {
    set({ isLoading: true, error: null });
    try {
      await window.electronAPI.team.deleteGroup(groupId);
      await get().fetchTeams();
      set({ view: 'list', activeTeamId: null });
    } catch (err) {
      set({ error: (err as Error).message });
    } finally {
      set({ isLoading: false });
    }
  },

  renameGroup: async (groupId, name) => {
    await window.electronAPI.team.renameGroup(groupId, name);
    await get().fetchTeams();
  },

  addMember: async (teamId, jiraAccountId, displayName, email) => {
    set({ error: null });
    try {
      await window.electronAPI.team.addMember(teamId, jiraAccountId, displayName, email);
      await get().fetchMembers(teamId);
    } catch (err) {
      set({ error: (err as Error).message });
    }
  },

  removeMember: async (teamId, memberId) => {
    await window.electronAPI.team.removeMember(teamId, memberId);
    await get().fetchMembers(teamId);
  },

  setActiveTeam: (teamId) => {
    set({ activeTeamId: teamId, view: 'members' });
    get().fetchMembers(teamId);
  },

  setView: (view) => set({ view }),
  clearError: () => set({ error: null }),
}));
