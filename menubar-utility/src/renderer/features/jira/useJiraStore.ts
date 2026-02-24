import { create } from 'zustand';
import type { JiraProject, JiraIssueType, JiraSearchIssue, JiraCreateField } from '../../../shared/types/jira.types';

type TicketTab = 'created' | 'open' | 'done';

interface JiraStore {
  projects: JiraProject[];
  issueTypes: JiraIssueType[];
  history: JiraSearchIssue[];
  openTickets: JiraSearchIssue[];
  doneTickets: JiraSearchIssue[];
  activeTab: TicketTab;
  isConfigured: boolean;
  isLoading: boolean;
  showCreateForm: boolean;
  ticketsLoading: boolean;
  createFields: JiraCreateField[];
  createFieldsLoading: boolean;

  checkConfig: () => Promise<void>;
  fetchProjects: () => Promise<void>;
  fetchIssueTypes: (projectKey: string) => Promise<void>;
  fetchCreateFields: (projectKey: string, issueTypeId: string) => Promise<void>;
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
  createFields: [],
  createFieldsLoading: false,

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

  fetchCreateFields: async (projectKey, issueTypeId) => {
    set({ createFieldsLoading: true, createFields: [] });
    try {
      const fields = await window.electronAPI.jira.getCreateFields(projectKey, issueTypeId);
      set({ createFields: fields });
    } catch {
      set({ createFields: [] });
    } finally {
      set({ createFieldsLoading: false });
    }
  },

  fetchHistory: async () => {
    try {
      const tickets = await window.electronAPI.jira.searchTickets(
        'reporter = currentUser() AND created >= -2d ORDER BY created DESC',
        15
      );
      set({ history: tickets });
    } catch {
      set({ history: [] });
    }
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
