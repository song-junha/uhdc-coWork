import { getDatabase } from './index';
import type { JiraHistoryItem } from '../../shared/types/jira.types';

function rowToHistory(row: Record<string, unknown>): JiraHistoryItem {
  return {
    id: row.id as string,
    ticketKey: row.ticket_key as string,
    summary: row.summary as string,
    projectKey: row.project_key as string,
    issueType: row.issue_type as string,
    jiraUrl: row.jira_url as string,
    createdAt: row.created_at as string,
  };
}

export function addHistory(item: Omit<JiraHistoryItem, 'id' | 'createdAt'>): JiraHistoryItem {
  const db = getDatabase();
  const info = db.prepare(`
    INSERT INTO jira_history (ticket_key, summary, project_key, issue_type, jira_url)
    VALUES (?, ?, ?, ?, ?)
  `).run(item.ticketKey, item.summary, item.projectKey, item.issueType, item.jiraUrl);

  // Keep only latest 10
  db.prepare(`
    DELETE FROM jira_history WHERE id NOT IN (
      SELECT id FROM jira_history ORDER BY created_at DESC LIMIT 10
    )
  `).run();

  return rowToHistory(
    db.prepare('SELECT * FROM jira_history WHERE rowid = ?').get(info.lastInsertRowid) as Record<string, unknown>
  );
}

export function getHistory(): JiraHistoryItem[] {
  const db = getDatabase();
  return (db.prepare('SELECT * FROM jira_history ORDER BY created_at DESC LIMIT 10').all() as Record<string, unknown>[])
    .map(rowToHistory);
}

export function deleteHistory(id: string): void {
  getDatabase().prepare('DELETE FROM jira_history WHERE id = ?').run(id);
}

export function clearAllHistory(): void {
  getDatabase().prepare('DELETE FROM jira_history').run();
}

export function fixHistoryUrls(baseUrl: string): void {
  const db = getDatabase();
  const rows = db.prepare('SELECT id, ticket_key, jira_url FROM jira_history WHERE jira_url LIKE \'%/rest/api/%\'').all() as Record<string, unknown>[];
  const stmt = db.prepare('UPDATE jira_history SET jira_url = ? WHERE id = ?');
  const fix = db.transaction(() => {
    for (const row of rows) {
      const browseUrl = `${baseUrl.replace(/\/$/, '')}/browse/${row.ticket_key}`;
      stmt.run(browseUrl, row.id);
    }
  });
  fix();
}
