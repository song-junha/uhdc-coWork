import { contextBridge, ipcRenderer } from 'electron';
import type { ElectronAPI } from '../shared/types/ipc.types';

const api: ElectronAPI = {
  todo: {
    getAll: (filter) => ipcRenderer.invoke('todo:getAll', filter),
    create: (data) => ipcRenderer.invoke('todo:create', data),
    update: (id, data) => ipcRenderer.invoke('todo:update', id, data),
    delete: (id) => ipcRenderer.invoke('todo:delete', id),
    reorder: (ids) => ipcRenderer.invoke('todo:reorder', ids),
    getRecentAssignees: () => ipcRenderer.invoke('todo:getRecentAssignees'),
  },
  memo: {
    getFolders: () => ipcRenderer.invoke('memo:getFolders'),
    createFolder: (data) => ipcRenderer.invoke('memo:createFolder', data),
    updateFolder: (id, data) => ipcRenderer.invoke('memo:updateFolder', id, data),
    deleteFolder: (id) => ipcRenderer.invoke('memo:deleteFolder', id),
    getMemos: (folderId) => ipcRenderer.invoke('memo:getMemos', folderId),
    createMemo: (data) => ipcRenderer.invoke('memo:createMemo', data),
    updateMemo: (id, data) => ipcRenderer.invoke('memo:updateMemo', id, data),
    deleteMemo: (id) => ipcRenderer.invoke('memo:deleteMemo', id),
    moveMemo: (id, targetFolderId) => ipcRenderer.invoke('memo:moveMemo', id, targetFolderId),
    reorderMemos: (ids) => ipcRenderer.invoke('memo:reorderMemos', ids),
    reorderFolders: (ids) => ipcRenderer.invoke('memo:reorderFolders', ids),
    search: (query) => ipcRenderer.invoke('memo:search', query),
  },
  jira: {
    getProjects: () => ipcRenderer.invoke('jira:getProjects'),
    getIssueTypes: (projectKey) => ipcRenderer.invoke('jira:getIssueTypes', projectKey),
    getCreateFields: (projectKey, issueTypeId) => ipcRenderer.invoke('jira:getCreateFields', projectKey, issueTypeId),
    createTicket: (data) => ipcRenderer.invoke('jira:createTicket', data),
    searchTickets: (jql, maxResults) => ipcRenderer.invoke('jira:searchTickets', jql, maxResults),
    testConnection: () => ipcRenderer.invoke('jira:testConnection'),
    getMyself: () => ipcRenderer.invoke('jira:getMyself'),
    searchUsers: (query) => ipcRenderer.invoke('jira:searchUsers', query),
    getTransitions: (issueKey) => ipcRenderer.invoke('jira:getTransitions', issueKey),
    doTransition: (issueKey, transitionId) => ipcRenderer.invoke('jira:doTransition', issueKey, transitionId),
  },
  calendar: {
    getEvents: (year, month) => ipcRenderer.invoke('calendar:getEvents', year, month),
    createEvent: (data) => ipcRenderer.invoke('calendar:createEvent', data),
    updateEvent: (id, data) => ipcRenderer.invoke('calendar:updateEvent', id, data),
    deleteEvent: (id) => ipcRenderer.invoke('calendar:deleteEvent', id),
    getTodayAlerts: () => ipcRenderer.invoke('calendar:getTodayAlerts'),
    snooze: (id, minutes) => ipcRenderer.invoke('calendar:snooze', id, minutes),
  },
  team: {
    getMyTeams: () => ipcRenderer.invoke('team:getMyTeams'),
    getMembers: (teamId) => ipcRenderer.invoke('team:getMembers', teamId),
    createGroup: (data) => ipcRenderer.invoke('team:createGroup', data),
    archiveGroup: (groupId) => ipcRenderer.invoke('team:archiveGroup', groupId),
    deleteGroup: (groupId) => ipcRenderer.invoke('team:deleteGroup', groupId),
    renameGroup: (groupId, name) => ipcRenderer.invoke('team:renameGroup', groupId, name),
    addMember: (teamId, jiraAccountId, displayName, email) => ipcRenderer.invoke('team:addMember', teamId, jiraAccountId, displayName, email),
    removeMember: (teamId, memberId) => ipcRenderer.invoke('team:removeMember', teamId, memberId),
  },
  auth: {
    autoAuth: () => ipcRenderer.invoke('auth:autoAuth'),
    signOut: () => ipcRenderer.invoke('auth:signOut'),
  },
  sync: {
    pushTodos: (teamId) => ipcRenderer.invoke('sync:pushTodos', teamId),
    pullTodos: (teamId) => ipcRenderer.invoke('sync:pullTodos', teamId),
    pushPersonalTodos: () => ipcRenderer.invoke('sync:pushPersonalTodos'),
    pullPersonalTodos: () => ipcRenderer.invoke('sync:pullPersonalTodos'),
    pushMemoFolders: () => ipcRenderer.invoke('sync:pushMemoFolders'),
    pullMemoFolders: () => ipcRenderer.invoke('sync:pullMemoFolders'),
    pushMemos: () => ipcRenderer.invoke('sync:pushMemos'),
    pullMemos: () => ipcRenderer.invoke('sync:pullMemos'),
    pushCalendarEvents: () => ipcRenderer.invoke('sync:pushCalendarEvents'),
    pullCalendarEvents: () => ipcRenderer.invoke('sync:pullCalendarEvents'),
    pushAllPersonal: () => ipcRenderer.invoke('sync:pushAllPersonal'),
    pullAllPersonal: () => ipcRenderer.invoke('sync:pullAllPersonal'),
    sendDirectTodo: (data) => ipcRenderer.invoke('sync:sendDirectTodo', data),
    pullDirectTodos: (myJiraId) => ipcRenderer.invoke('sync:pullDirectTodos', myJiraId),
  },
  settings: {
    get: (key) => ipcRenderer.invoke('settings:get', key),
    set: (key, value) => ipcRenderer.invoke('settings:set', key, value),
    getAll: () => ipcRenderer.invoke('settings:getAll'),
  },
  shell: {
    openExternal: (url) => ipcRenderer.invoke('shell:openExternal', url),
  },
  app: {
    quit: () => ipcRenderer.invoke('app:quit'),
    resetData: () => ipcRenderer.invoke('app:resetData'),
    installUpdate: () => ipcRenderer.invoke('app:installUpdate'),
  },
  on: (channel, callback) => {
    ipcRenderer.on(channel, (_event, ...args) => callback(...args));
  },
  off: (channel) => {
    ipcRenderer.removeAllListeners(channel);
  },
};

contextBridge.exposeInMainWorld('electronAPI', api);
