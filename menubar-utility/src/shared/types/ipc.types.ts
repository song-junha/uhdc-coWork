import type { Todo, CreateTodoDto, UpdateTodoDto, TodoFilter } from './todo.types';
import type { MemoFolder, Memo, CreateFolderDto, UpdateFolderDto, CreateMemoDto, UpdateMemoDto } from './memo.types';
import type { JiraProject, JiraIssueType, CreateTicketDto, JiraTicketResult, JiraHistoryItem, JiraSearchIssue } from './jira.types';
import type { CalendarEvent, CreateEventDto, UpdateEventDto } from './calendar.types';
import type { Team, TeamMember, CreateGroupDto, AuthUser } from './team.types';

export interface ElectronAPI {
  todo: {
    getAll: (filter: TodoFilter) => Promise<Todo[]>;
    create: (data: CreateTodoDto) => Promise<Todo>;
    update: (id: string, data: UpdateTodoDto) => Promise<Todo>;
    delete: (id: string) => Promise<void>;
    reorder: (ids: string[]) => Promise<void>;
    getRecentAssignees: () => Promise<string[]>;
  };
  memo: {
    getFolders: () => Promise<MemoFolder[]>;
    createFolder: (data: CreateFolderDto) => Promise<MemoFolder>;
    updateFolder: (id: string, data: UpdateFolderDto) => Promise<MemoFolder>;
    deleteFolder: (id: string) => Promise<void>;
    getMemos: (folderId: string) => Promise<Memo[]>;
    createMemo: (data: CreateMemoDto) => Promise<Memo>;
    updateMemo: (id: string, data: UpdateMemoDto) => Promise<Memo>;
    deleteMemo: (id: string) => Promise<void>;
    moveMemo: (id: string, targetFolderId: string) => Promise<void>;
    reorderMemos: (ids: string[]) => Promise<void>;
    reorderFolders: (ids: string[]) => Promise<void>;
    search: (query: string) => Promise<Memo[]>;
  };
  jira: {
    getProjects: () => Promise<JiraProject[]>;
    getIssueTypes: (projectKey: string) => Promise<JiraIssueType[]>;
    createTicket: (data: CreateTicketDto) => Promise<JiraTicketResult>;
    getHistory: () => Promise<JiraHistoryItem[]>;
    deleteHistory: (id: string) => Promise<void>;
    searchTickets: (jql: string, maxResults?: number) => Promise<JiraSearchIssue[]>;
    testConnection: () => Promise<boolean>;
    getMyself: () => Promise<{ accountId: string; displayName: string }>;
  };
  calendar: {
    getEvents: (year: number, month: number) => Promise<CalendarEvent[]>;
    createEvent: (data: CreateEventDto) => Promise<CalendarEvent>;
    updateEvent: (id: string, data: UpdateEventDto) => Promise<CalendarEvent>;
    deleteEvent: (id: string) => Promise<void>;
    getTodayAlerts: () => Promise<CalendarEvent[]>;
    snooze: (id: string, minutes: number) => Promise<void>;
  };
  team: {
    getMyTeams: () => Promise<Team[]>;
    getMembers: (teamId: string) => Promise<TeamMember[]>;
    createSpotGroup: (data: CreateGroupDto) => Promise<Team>;
    archiveGroup: (groupId: string) => Promise<void>;
    invite: (teamId: string, email: string) => Promise<void>;
    removeMember: (teamId: string, userId: string) => Promise<void>;
  };
  auth: {
    autoAuth: () => Promise<AuthUser | null>;
    signOut: () => Promise<void>;
  };
  sync: {
    pushTodos: (teamId: string) => Promise<void>;
    pullTodos: (teamId: string) => Promise<void>;
  };
  settings: {
    get: (key: string) => Promise<string | null>;
    set: (key: string, value: string) => Promise<void>;
    getAll: () => Promise<Record<string, string>>;
  };
  shell: {
    openExternal: (url: string) => Promise<void>;
  };
  on: (channel: string, callback: (...args: unknown[]) => void) => void;
  off: (channel: string) => void;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}
