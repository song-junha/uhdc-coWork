import { create } from 'zustand';
import type { JiraProject, JiraIssueType, JiraHistoryItem, JiraSearchIssue } from '../../../shared/types/jira.types';

type TicketTab = 'created' | 'open' | 'done';

interface JiraStore {
  projects: JiraProject[];
  issueTypes: JiraIssueType[];
  history: JiraHistoryItem[];
  openTickets: JiraSearchIssue[];
  doneTickets: JiraSearchIssue[];
  activeTab: TicketTab;
  isConfigured: boolean;
  isLoading: boolean;
  showCreateForm: boolean;
  ticketsLoading: boolean;

  checkConfig: () => Promise<void>;
  fetchProjects: () => Promise<void>;
  fetchIssueTypes: (projectKey: string) => Promise<void>;
  fetchHistory: () => Promise<void>;
  fetchMyTickets: () => Promise<void>;
  setActiveTab: (tab: TicketTab) => void;
  setShowCreateForm: (show: boolean) => void;
}

export const useJiraStore = create<JiraStore>((set, get) => ({
  projects: [],
  issueTypes: [],
  history: [],
  openTickets: [],
  doneTickets: [],
  activeTab: 'created',
  isConfigured: false,
  isLoading: false,
  showCreateForm: false,
  ticketsLoading: false,

  checkConfig: async () => {
    const baseUrl = await window.electronAPI.settings.get('jira_base_url');
    set({ isConfigured: !!baseUrl });
    if (baseUrl) {
      await get().fetchHistory();
      get().fetchMyTickets();
    }
  },

  fetchProjects: async () => {
    set({ isLoading: true });
    try {
      const projects = await window.electronAPI.jira.getProjects();
      set({ projects });
    } finally {
      set({ isLoading: false });
    }
  },

  fetchIssueTypes: async (projectKey) => {
    const types = await window.electronAPI.jira.getIssueTypes(projectKey);
    set({ issueTypes: types });
  },

  fetchHistory: async () => {
    const all = await window.electronAPI.jira.getHistory();
    const twoDaysAgo = Date.now() - 2 * 24 * 60 * 60 * 1000;
    const history = all.filter(item => new Date(item.createdAt).getTime() >= twoDaysAgo);
    set({ history });
  },

  fetchMyTickets: async () => {
    set({ ticketsLoading: true });
    try {
      const [openTickets, doneTickets] = await Promise.all([
        window.electronAPI.jira.searchTickets(
          'assignee = currentUser() AND statusCategory not in (Done) ORDER BY updated DESC',
          15
        ),
        window.electronAPI.jira.searchTickets(
          'assignee = currentUser() AND statusCategory = Done ORDER BY updated DESC',
          10
        ),
      ]);
      set({ openTickets, doneTickets });
    } catch {
      // Jira not configured or network error - ignore
    } finally {
      set({ ticketsLoading: false });
    }
  },

  setActiveTab: (tab) => set({ activeTab: tab }),
  setShowCreateForm: (show) => set({ showCreateForm: show }),
}));
