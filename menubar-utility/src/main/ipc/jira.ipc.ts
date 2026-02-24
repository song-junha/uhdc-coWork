import { ipcMain } from 'electron';
import { JiraService } from '../services/jira.service';
import type { CreateTicketDto } from '../../shared/types/jira.types';

let jiraService: JiraService | null = null;

function getJiraService(): JiraService {
  if (!jiraService) {
    jiraService = new JiraService();
  }
  return jiraService;
}

export function registerJiraHandlers(): void {
  ipcMain.handle('jira:getProjects', async () => {
    return getJiraService().getProjects();
  });

  ipcMain.handle('jira:getIssueTypes', async (_event, projectKey: string) => {
    return getJiraService().getIssueTypes(projectKey);
  });

  ipcMain.handle('jira:getCreateFields', async (_event, projectKey: string, issueTypeId: string) => {
    return getJiraService().getCreateFields(projectKey, issueTypeId);
  });

  ipcMain.handle('jira:createTicket', async (_event, data: CreateTicketDto) => {
    return getJiraService().createTicket(data);
  });

  ipcMain.handle('jira:searchTickets', async (_event, jql: string, maxResults?: number) => {
    return getJiraService().searchTickets(jql, maxResults);
  });

  ipcMain.handle('jira:testConnection', async () => {
    return getJiraService().testConnection();
  });

  ipcMain.handle('jira:getMyself', async () => {
    return getJiraService().getMyself();
  });

  ipcMain.handle('jira:searchUsers', async (_event, query: string) => {
    return getJiraService().searchUsers(query);
  });

  ipcMain.handle('jira:getTransitions', async (_event, issueKey: string) => {
    return getJiraService().getTransitions(issueKey);
  });

  ipcMain.handle('jira:doTransition', async (_event, issueKey: string, transitionId: string) => {
    return getJiraService().doTransition(issueKey, transitionId);
  });
}

export function resetJiraService(): void {
  jiraService = null;
}
