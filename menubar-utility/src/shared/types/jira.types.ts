export interface JiraProject {
  id: string;
  key: string;
  name: string;
}

export interface JiraIssueType {
  id: string;
  name: string;
  iconUrl?: string;
}

export interface CreateTicketDto {
  projectKey: string;
  issueTypeId: string;
  summary: string;
  description: string;
  assigneeId?: string;
  priority?: string;
  labels?: string[];
  customFields?: Record<string, unknown>;
}

export interface JiraTicketResult {
  id: string;
  key: string;
  self: string;
}

export interface JiraHistoryItem {
  id: string;
  ticketKey: string;
  summary: string;
  projectKey: string;
  issueType: string;
  jiraUrl: string;
  createdAt: string;
}

export interface JiraSearchIssue {
  key: string;
  self: string;
  fields: {
    summary: string;
    status: { name: string; statusCategory: { key: string } };
    updated: string;
  };
}

export interface JiraTransition {
  id: string;
  name: string;
  to: { name: string; statusCategory: { key: string } };
}

export interface JiraConfig {
  baseUrl: string;
  email: string;
  apiToken: string;
}

export interface JiraUser {
  accountId: string;
  displayName: string;
  emailAddress?: string;
  avatarUrl?: string;
}

export interface JiraFieldOption {
  id: string;
  value?: string;
  name?: string;
}

export interface JiraCreateField {
  key: string;
  name: string;
  required: boolean;
  schema: {
    type: string;
    custom?: string;
  };
  allowedValues?: JiraFieldOption[];
  defaultValue?: unknown;
}
