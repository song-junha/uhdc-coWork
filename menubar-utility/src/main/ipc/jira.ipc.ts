import { ipcMain } from 'electron';
import { JiraService } from '../services/jira.service';
import * as jiraRepo from '../db/jira.repo';
import * as settingsRepo from '../db/settings.repo';
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

  ipcMain.handle('jira:createTicket', async (_event, data: CreateTicketDto) => {
    const result = await getJiraService().createTicket(data);

    // Build browse URL (not REST API URL)
    const baseUrl = (settingsRepo.getSetting('jira_base_url') || '').replace(/\/$/, '');
    const browseUrl = `${baseUrl}/browse/${result.key}`;

    jiraRepo.addHistory({
      ticketKey: result.key,
      summary: data.summary,
      projectKey: data.projectKey,
      issueType: data.issueTypeId,
      jiraUrl: browseUrl,
    });

    return result;
  });

  ipcMain.handle('jira:searchTickets', async (_event, jql: string, maxResults?: number) => {
    return getJiraService().searchTickets(jql, maxResults);
  });

  ipcMain.handle('jira:getHistory', () => {
    return jiraRepo.getHistory();
  });

  ipcMain.handle('jira:deleteHistory', (_event, id: string) => {
    jiraRepo.deleteHistory(id);
  });

  // Fix legacy REST API URLs in history
  const baseUrl = settingsRepo.getSetting('jira_base_url');
  if (baseUrl) {
    jiraRepo.fixHistoryUrls(baseUrl);
  }

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
