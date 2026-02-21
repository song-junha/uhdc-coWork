import { safeStorage } from 'electron';
import * as settingsRepo from '../db/settings.repo';
import type { JiraProject, JiraIssueType, CreateTicketDto, JiraTicketResult, JiraSearchIssue, JiraUser, JiraTransition } from '../../shared/types/jira.types';

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

const CACHE_TTL = 60 * 60 * 1000; // 1 hour

export class JiraService {
  private cache = new Map<string, CacheEntry<unknown>>();

  private getCached<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (entry && entry.expiresAt > Date.now()) return entry.data as T;
    this.cache.delete(key);
    return null;
  }

  private setCache<T>(key: string, data: T): void {
    this.cache.set(key, { data, expiresAt: Date.now() + CACHE_TTL });
  }

  private getConfig() {
    const baseUrl = settingsRepo.getSetting('jira_base_url');
    const email = settingsRepo.getSetting('jira_email');
    const encryptedToken = settingsRepo.getSetting('jira_api_token');

    if (!baseUrl || !email || !encryptedToken) {
      throw new Error('Jira is not configured. Please set up Jira in Settings.');
    }

    let apiToken: string;
    try {
      apiToken = safeStorage.isEncryptionAvailable()
        ? safeStorage.decryptString(Buffer.from(encryptedToken, 'base64'))
        : encryptedToken;
    } catch {
      apiToken = encryptedToken;
    }

    return { baseUrl: baseUrl.replace(/\/$/, ''), email, apiToken };
  }

  private getAuthHeader(): string {
    const { email, apiToken } = this.getConfig();
    return `Basic ${Buffer.from(`${email}:${apiToken}`).toString('base64')}`;
  }

  private async request<T>(path: string, options?: RequestInit): Promise<T> {
    const { baseUrl } = this.getConfig();
    const response = await fetch(`${baseUrl}${path}`, {
      ...options,
      headers: {
        'Authorization': this.getAuthHeader(),
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        ...options?.headers,
      },
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Jira API error (${response.status}): ${body}`);
    }

    if (response.status === 204) return undefined as T;
    return response.json() as Promise<T>;
  }

  async getProjects(): Promise<JiraProject[]> {
    const cached = this.getCached<JiraProject[]>('projects');
    if (cached) return cached;

    const data = await this.request<JiraProject[]>('/rest/api/3/project');
    const projects = data.map(p => ({ id: p.id, key: p.key, name: p.name }));
    this.setCache('projects', projects);
    return projects;
  }

  async getIssueTypes(projectKey: string): Promise<JiraIssueType[]> {
    const cacheKey = `issueTypes:${projectKey}`;
    const cached = this.getCached<JiraIssueType[]>(cacheKey);
    if (cached) return cached;

    const data = await this.request<{ issueTypes: JiraIssueType[] }>(
      `/rest/api/3/project/${projectKey}`
    );
    const types = data.issueTypes.map(t => ({ id: t.id, name: t.name, iconUrl: t.iconUrl }));
    this.setCache(cacheKey, types);
    return types;
  }

  async getMyself(): Promise<{ accountId: string; displayName: string }> {
    return this.request<{ accountId: string; displayName: string }>('/rest/api/3/myself');
  }

  async createTicket(data: CreateTicketDto): Promise<JiraTicketResult> {
    // Reporter = assignee (담당자가 보고자)
    const reporterId = data.assigneeId || (await this.getMyself()).accountId;

    const fields: Record<string, unknown> = {
      project: { key: data.projectKey },
      issuetype: { id: data.issueTypeId },
      summary: data.summary,
      reporter: { accountId: reporterId },
      description: {
        type: 'doc',
        version: 1,
        content: [{
          type: 'paragraph',
          content: [{ type: 'text', text: data.description || ' ' }],
        }],
      },
    };

    if (data.assigneeId) fields.assignee = { accountId: data.assigneeId };
    if (data.priority) fields.priority = { name: data.priority };
    if (data.labels?.length) fields.labels = data.labels;
    if (data.customFields) {
      for (const [key, value] of Object.entries(data.customFields)) {
        fields[key] = value;
      }
    }

    return this.request<JiraTicketResult>('/rest/api/3/issue', {
      method: 'POST',
      body: JSON.stringify({ fields }),
    });
  }

  async searchTickets(jql: string, maxResults = 10): Promise<JiraSearchIssue[]> {
    const params = new URLSearchParams({
      jql,
      maxResults: String(maxResults),
      fields: 'summary,status,updated',
    });
    const result = await this.request<{ issues: JiraSearchIssue[] }>(
      `/rest/api/3/search/jql?${params.toString()}`
    );
    return result.issues;
  }

  async searchUsers(query: string): Promise<JiraUser[]> {
    const params = new URLSearchParams({ query, maxResults: '10' });
    const data = await this.request<Array<{
      accountId: string;
      displayName: string;
      emailAddress?: string;
      avatarUrls?: Record<string, string>;
      accountType?: string;
    }>>(`/rest/api/3/user/search?${params.toString()}`);

    return data
      .filter(u => u.accountType === 'atlassian')
      .map(u => ({
        accountId: u.accountId,
        displayName: u.displayName,
        emailAddress: u.emailAddress,
        avatarUrl: u.avatarUrls?.['24x24'],
      }));
  }

  async getTransitions(issueKey: string): Promise<JiraTransition[]> {
    const data = await this.request<{ transitions: JiraTransition[] }>(
      `/rest/api/3/issue/${issueKey}/transitions`
    );
    return data.transitions.map(t => ({
      id: t.id,
      name: t.name,
      to: { name: t.to.name, statusCategory: { key: t.to.statusCategory.key } },
    }));
  }

  async doTransition(issueKey: string, transitionId: string): Promise<void> {
    await this.request<void>(`/rest/api/3/issue/${issueKey}/transitions`, {
      method: 'POST',
      body: JSON.stringify({ transition: { id: transitionId } }),
    });
  }

  async testConnection(): Promise<boolean> {
    try {
      await this.request('/rest/api/3/myself');
      return true;
    } catch {
      return false;
    }
  }
}
