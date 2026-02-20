import { getDatabase } from '../db/index';
import { supabaseService } from './supabase.service';
import type { Todo } from '../../shared/types/todo.types';

function rowToTodo(row: Record<string, unknown>): Todo {
  return {
    id: row.id as string,
    title: row.title as string,
    description: row.description as string,
    status: row.status as Todo['status'],
    priority: row.priority as Todo['priority'],
    dueDate: row.due_date as string | null,
    assigneeName: (row.assignee_name as string) || '',
    assigneeId: row.assignee_id as string | null,
    teamId: row.team_id as string | null,
    sortOrder: row.sort_order as number,
    remoteId: row.remote_id as string | null,
    syncedAt: row.synced_at as string | null,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

export async function pushTodos(teamId: string): Promise<void> {
  if (!supabaseService.isConfigured()) return;

  const db = getDatabase();
  const client = supabaseService.getClient();

  // Find local todos that need pushing (updated after last sync, or never synced)
  const rows = db.prepare(
    `SELECT * FROM todos WHERE team_id = ? AND (synced_at IS NULL OR updated_at > synced_at)`
  ).all(teamId);

  for (const row of rows) {
    const todo = rowToTodo(row as Record<string, unknown>);
    const remoteData = {
      local_id: todo.id,
      team_id: teamId,
      title: todo.title,
      description: todo.description,
      status: todo.status,
      priority: todo.priority,
      due_date: todo.dueDate,
      assignee_name: todo.assigneeName,
      assignee_id: todo.assigneeId,
      sort_order: todo.sortOrder,
      updated_at: todo.updatedAt,
    };

    try {
      if (todo.remoteId) {
        // Update existing remote
        await client.from('shared_todos').update(remoteData).eq('id', todo.remoteId);
      } else {
        // Insert new remote
        const { data } = await client
          .from('shared_todos')
          .insert(remoteData)
          .select('id')
          .single();

        if (data) {
          db.prepare('UPDATE todos SET remote_id = ?, synced_at = datetime(\'now\') WHERE id = ?')
            .run(data.id, todo.id);
          continue;
        }
      }

      // Mark as synced
      db.prepare('UPDATE todos SET synced_at = datetime(\'now\') WHERE id = ?').run(todo.id);
    } catch (err) {
      console.error(`Sync push failed for todo ${todo.id}:`, err);
    }
  }
}

export async function pullTodos(teamId: string): Promise<void> {
  if (!supabaseService.isConfigured()) return;

  const db = getDatabase();
  const client = supabaseService.getClient();

  try {
    const { data: remoteTodos, error } = await client
      .from('shared_todos')
      .select('*')
      .eq('team_id', teamId);

    if (error) {
      console.error('Sync pull failed:', error.message);
      return;
    }

    if (!remoteTodos) return;

    for (const remote of remoteTodos) {
      const localByRemoteId = db.prepare('SELECT * FROM todos WHERE remote_id = ?')
        .get(remote.id) as Record<string, unknown> | undefined;

      const localByLocalId = remote.local_id
        ? db.prepare('SELECT * FROM todos WHERE id = ?').get(remote.local_id) as Record<string, unknown> | undefined
        : undefined;

      const local = localByRemoteId || localByLocalId;

      if (local) {
        // LWW: only update if remote is newer
        const localUpdated = new Date(local.updated_at as string).getTime();
        const remoteUpdated = new Date(remote.updated_at as string).getTime();

        if (remoteUpdated > localUpdated) {
          db.prepare(`
            UPDATE todos SET
              title = ?, description = ?, status = ?, priority = ?,
              due_date = ?, assignee_name = ?, assignee_id = ?,
              sort_order = ?, remote_id = ?, synced_at = datetime('now'),
              updated_at = ?
            WHERE id = ?
          `).run(
            remote.title, remote.description ?? '', remote.status, remote.priority,
            remote.due_date, remote.assignee_name ?? '', remote.assignee_id,
            remote.sort_order ?? 0, remote.id, remote.updated_at,
            local.id as string,
          );
        }
      } else {
        // Insert new from remote
        db.prepare(`
          INSERT INTO todos (title, description, status, priority, due_date, assignee_name, assignee_id, team_id, sort_order, remote_id, synced_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), ?)
        `).run(
          remote.title, remote.description ?? '', remote.status, remote.priority,
          remote.due_date, remote.assignee_name ?? '', remote.assignee_id,
          teamId, remote.sort_order ?? 0, remote.id, remote.updated_at,
        );
      }
    }
  } catch (err) {
    console.error('Sync pull error:', err);
  }
}

export async function syncAll(teamIds: string[]): Promise<void> {
  for (const teamId of teamIds) {
    await pushTodos(teamId);
    await pullTodos(teamId);
  }
}
