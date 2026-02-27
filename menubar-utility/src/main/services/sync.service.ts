import { getDatabase } from '../db/index';
import { supabaseService } from './supabase.service';
import { rowToFolder, rowToMemo } from '../db/memo.repo';
import { rowToEvent } from '../db/calendar.repo';
import * as settingsRepo from '../db/settings.repo';
import type { Todo, SendDirectTodoDto } from '../../shared/types/todo.types';
import type { MemoFolder, Memo } from '../../shared/types/memo.types';
import type { CalendarEvent } from '../../shared/types/calendar.types';

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

// ─── Team Todo Sync (existing) ──────────────────────────────────

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

// ─── Personal Cloud Sync ────────────────────────────────────────

function isCloudSyncEnabled(): boolean {
  return settingsRepo.getSetting('cloud_sync_enabled') === 'true';
}

/** Push personal (team_id IS NULL) todos to user_todos */
export async function pushPersonalTodos(): Promise<void> {
  if (!supabaseService.isConfigured()) return;

  const db = getDatabase();
  const client = supabaseService.getClient();
  const { data: { user } } = await client.auth.getUser();
  if (!user) return;

  const rows = db.prepare(
    `SELECT * FROM todos WHERE team_id IS NULL AND (synced_at IS NULL OR updated_at > synced_at)`
  ).all();

  for (const row of rows) {
    const todo = rowToTodo(row as Record<string, unknown>);
    const remoteData = {
      user_id: user.id,
      local_id: todo.id,
      title: todo.title,
      description: todo.description,
      status: todo.status,
      priority: todo.priority,
      due_date: todo.dueDate,
      assignee_name: todo.assigneeName,
      sort_order: todo.sortOrder,
      updated_at: todo.updatedAt,
    };

    try {
      if (todo.remoteId) {
        await client.from('user_todos').update(remoteData).eq('id', todo.remoteId);
      } else {
        const { data } = await client
          .from('user_todos')
          .insert(remoteData)
          .select('id')
          .single();

        if (data) {
          db.prepare("UPDATE todos SET remote_id = ?, synced_at = datetime('now') WHERE id = ?")
            .run(data.id, todo.id);
          continue;
        }
      }
      db.prepare("UPDATE todos SET synced_at = datetime('now') WHERE id = ?").run(todo.id);
    } catch (err) {
      console.error(`Personal todo push failed for ${todo.id}:`, err);
    }
  }

  // Handle remote deletes: find remote items that no longer exist locally
  try {
    const { data: remoteAll } = await client
      .from('user_todos')
      .select('id, local_id')
      .eq('user_id', user.id);

    if (remoteAll) {
      for (const remote of remoteAll) {
        const localExists = db.prepare('SELECT id FROM todos WHERE id = ? OR remote_id = ?')
          .get(remote.local_id, remote.id);
        if (!localExists) {
          await client.from('user_todos').delete().eq('id', remote.id);
        }
      }
    }
  } catch {}
}

/** Pull personal todos from user_todos */
export async function pullPersonalTodos(): Promise<void> {
  if (!supabaseService.isConfigured()) return;

  const db = getDatabase();
  const client = supabaseService.getClient();
  const { data: { user } } = await client.auth.getUser();
  if (!user) return;

  try {
    const { data: remoteTodos, error } = await client
      .from('user_todos')
      .select('*')
      .eq('user_id', user.id);

    if (error || !remoteTodos) return;

    const remoteIds = new Set(remoteTodos.map(r => r.id as string));

    for (const remote of remoteTodos) {
      const localByRemoteId = db.prepare('SELECT * FROM todos WHERE remote_id = ?')
        .get(remote.id) as Record<string, unknown> | undefined;
      const localByLocalId = remote.local_id
        ? db.prepare('SELECT * FROM todos WHERE id = ? AND team_id IS NULL').get(remote.local_id) as Record<string, unknown> | undefined
        : undefined;

      const local = localByRemoteId || localByLocalId;

      if (local) {
        const localUpdated = new Date(local.updated_at as string).getTime();
        const remoteUpdated = new Date(remote.updated_at as string).getTime();

        if (remoteUpdated > localUpdated) {
          db.prepare(`
            UPDATE todos SET
              title = ?, description = ?, status = ?, priority = ?,
              due_date = ?, assignee_name = ?,
              sort_order = ?, remote_id = ?, synced_at = datetime('now'),
              updated_at = ?
            WHERE id = ?
          `).run(
            remote.title, remote.description ?? '', remote.status, remote.priority,
            remote.due_date, remote.assignee_name ?? '',
            remote.sort_order ?? 0, remote.id, remote.updated_at,
            local.id as string,
          );
        } else if (!local.remote_id) {
          // Link local to remote
          db.prepare("UPDATE todos SET remote_id = ?, synced_at = datetime('now') WHERE id = ?")
            .run(remote.id, local.id as string);
        }
      } else {
        db.prepare(`
          INSERT INTO todos (title, description, status, priority, due_date, assignee_name, sort_order, remote_id, synced_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), ?)
        `).run(
          remote.title, remote.description ?? '', remote.status, remote.priority,
          remote.due_date, remote.assignee_name ?? '',
          remote.sort_order ?? 0, remote.id, remote.updated_at,
        );
      }
    }

    // Remove local personal todos that were deleted on remote (have remote_id but remote_id not in remote set)
    const localSynced = db.prepare('SELECT id, remote_id FROM todos WHERE team_id IS NULL AND remote_id IS NOT NULL')
      .all() as { id: string; remote_id: string }[];

    for (const local of localSynced) {
      if (!remoteIds.has(local.remote_id)) {
        db.prepare('DELETE FROM todos WHERE id = ?').run(local.id);
      }
    }
  } catch (err) {
    console.error('Personal todo pull error:', err);
  }
}

/** Push memo folders to user_memo_folders */
export async function pushMemoFolders(): Promise<void> {
  if (!supabaseService.isConfigured()) return;

  const db = getDatabase();
  const client = supabaseService.getClient();
  const { data: { user } } = await client.auth.getUser();
  if (!user) return;

  const rows = db.prepare(
    `SELECT * FROM memo_folders WHERE (synced_at IS NULL OR updated_at > synced_at)`
  ).all();

  for (const row of rows) {
    const folder = rowToFolder(row as Record<string, unknown>);
    // Resolve parent's remote_id
    let parentRemoteId: string | null = null;
    if (folder.parentId) {
      const parentRow = db.prepare('SELECT remote_id FROM memo_folders WHERE id = ?').get(folder.parentId) as { remote_id: string | null } | undefined;
      parentRemoteId = parentRow?.remote_id ?? null;
    }

    const remoteData = {
      user_id: user.id,
      local_id: folder.id,
      parent_remote_id: parentRemoteId,
      name: folder.name,
      sort_order: folder.sortOrder,
      is_expanded: folder.isExpanded,
      updated_at: folder.updatedAt,
    };

    try {
      if (folder.remoteId) {
        await client.from('user_memo_folders').update(remoteData).eq('id', folder.remoteId);
      } else {
        const { data } = await client
          .from('user_memo_folders')
          .insert(remoteData)
          .select('id')
          .single();

        if (data) {
          db.prepare("UPDATE memo_folders SET remote_id = ?, synced_at = datetime('now') WHERE id = ?")
            .run(data.id, folder.id);
          continue;
        }
      }
      db.prepare("UPDATE memo_folders SET synced_at = datetime('now') WHERE id = ?").run(folder.id);
    } catch (err) {
      console.error(`Memo folder push failed for ${folder.id}:`, err);
    }
  }

  // Handle remote deletes
  try {
    const { data: remoteAll } = await client
      .from('user_memo_folders')
      .select('id, local_id')
      .eq('user_id', user.id);

    if (remoteAll) {
      for (const remote of remoteAll) {
        const localExists = db.prepare('SELECT id FROM memo_folders WHERE id = ? OR remote_id = ?')
          .get(remote.local_id, remote.id);
        if (!localExists) {
          await client.from('user_memo_folders').delete().eq('id', remote.id);
        }
      }
    }
  } catch {}
}

/** Pull memo folders from user_memo_folders (2-pass for parent resolution) */
export async function pullMemoFolders(): Promise<void> {
  if (!supabaseService.isConfigured()) return;

  const db = getDatabase();
  const client = supabaseService.getClient();
  const { data: { user } } = await client.auth.getUser();
  if (!user) return;

  try {
    const { data: remoteFolders, error } = await client
      .from('user_memo_folders')
      .select('*')
      .eq('user_id', user.id);

    if (error || !remoteFolders) return;

    const remoteIds = new Set(remoteFolders.map(r => r.id as string));

    // Pass 1: upsert all folders (without parent_id)
    for (const remote of remoteFolders) {
      const localByRemoteId = db.prepare('SELECT * FROM memo_folders WHERE remote_id = ?')
        .get(remote.id) as Record<string, unknown> | undefined;
      const localByLocalId = remote.local_id
        ? db.prepare('SELECT * FROM memo_folders WHERE id = ?').get(remote.local_id) as Record<string, unknown> | undefined
        : undefined;

      const local = localByRemoteId || localByLocalId;

      if (local) {
        const localUpdated = new Date(local.updated_at as string).getTime();
        const remoteUpdated = new Date(remote.updated_at as string).getTime();

        if (remoteUpdated > localUpdated) {
          db.prepare(`
            UPDATE memo_folders SET
              name = ?, sort_order = ?, is_expanded = ?,
              remote_id = ?, synced_at = datetime('now'), updated_at = ?
            WHERE id = ?
          `).run(
            remote.name, remote.sort_order ?? 0, remote.is_expanded ? 1 : 0,
            remote.id, remote.updated_at,
            local.id as string,
          );
        } else if (!local.remote_id) {
          db.prepare("UPDATE memo_folders SET remote_id = ?, synced_at = datetime('now') WHERE id = ?")
            .run(remote.id, local.id as string);
        }
      } else {
        db.prepare(`
          INSERT INTO memo_folders (name, sort_order, is_expanded, remote_id, synced_at, updated_at)
          VALUES (?, ?, ?, ?, datetime('now'), ?)
        `).run(
          remote.name, remote.sort_order ?? 0, remote.is_expanded ? 1 : 0,
          remote.id, remote.updated_at,
        );
      }
    }

    // Pass 2: resolve parent_id from parent_remote_id
    for (const remote of remoteFolders) {
      if (!remote.parent_remote_id) continue;

      const localFolder = db.prepare('SELECT id FROM memo_folders WHERE remote_id = ?')
        .get(remote.id) as { id: string } | undefined;
      const parentFolder = db.prepare('SELECT id FROM memo_folders WHERE remote_id = ?')
        .get(remote.parent_remote_id) as { id: string } | undefined;

      if (localFolder && parentFolder) {
        db.prepare('UPDATE memo_folders SET parent_id = ? WHERE id = ?')
          .run(parentFolder.id, localFolder.id);
      }
    }

    // Remove locally synced folders that were deleted remotely
    const localSynced = db.prepare('SELECT id, remote_id FROM memo_folders WHERE remote_id IS NOT NULL')
      .all() as { id: string; remote_id: string }[];

    for (const local of localSynced) {
      if (!remoteIds.has(local.remote_id)) {
        db.prepare('DELETE FROM memo_folders WHERE id = ?').run(local.id);
      }
    }
  } catch (err) {
    console.error('Memo folder pull error:', err);
  }
}

/** Push memos to user_memos */
export async function pushMemos(): Promise<void> {
  if (!supabaseService.isConfigured()) return;

  const db = getDatabase();
  const client = supabaseService.getClient();
  const { data: { user } } = await client.auth.getUser();
  if (!user) return;

  const rows = db.prepare(
    `SELECT * FROM memos WHERE (synced_at IS NULL OR updated_at > synced_at)`
  ).all();

  for (const row of rows) {
    const memo = rowToMemo(row as Record<string, unknown>);
    // Get folder's remote_id
    const folderRow = db.prepare('SELECT remote_id FROM memo_folders WHERE id = ?')
      .get(memo.folderId) as { remote_id: string | null } | undefined;
    const folderRemoteId = folderRow?.remote_id ?? null;

    const remoteData = {
      user_id: user.id,
      local_id: memo.id,
      folder_remote_id: folderRemoteId,
      title: memo.title,
      content: memo.content,
      sort_order: memo.sortOrder,
      updated_at: memo.updatedAt,
    };

    try {
      if (memo.remoteId) {
        await client.from('user_memos').update(remoteData).eq('id', memo.remoteId);
      } else {
        const { data } = await client
          .from('user_memos')
          .insert(remoteData)
          .select('id')
          .single();

        if (data) {
          db.prepare("UPDATE memos SET remote_id = ?, synced_at = datetime('now') WHERE id = ?")
            .run(data.id, memo.id);
          continue;
        }
      }
      db.prepare("UPDATE memos SET synced_at = datetime('now') WHERE id = ?").run(memo.id);
    } catch (err) {
      console.error(`Memo push failed for ${memo.id}:`, err);
    }
  }

  // Handle remote deletes
  try {
    const { data: remoteAll } = await client
      .from('user_memos')
      .select('id, local_id')
      .eq('user_id', user.id);

    if (remoteAll) {
      for (const remote of remoteAll) {
        const localExists = db.prepare('SELECT id FROM memos WHERE id = ? OR remote_id = ?')
          .get(remote.local_id, remote.id);
        if (!localExists) {
          await client.from('user_memos').delete().eq('id', remote.id);
        }
      }
    }
  } catch {}
}

/** Pull memos from user_memos */
export async function pullMemos(): Promise<void> {
  if (!supabaseService.isConfigured()) return;

  const db = getDatabase();
  const client = supabaseService.getClient();
  const { data: { user } } = await client.auth.getUser();
  if (!user) return;

  try {
    const { data: remoteMemos, error } = await client
      .from('user_memos')
      .select('*')
      .eq('user_id', user.id);

    if (error || !remoteMemos) return;

    const remoteIds = new Set(remoteMemos.map(r => r.id as string));

    for (const remote of remoteMemos) {
      // Resolve folder from folder_remote_id
      let localFolderId: string | null = null;
      if (remote.folder_remote_id) {
        const folderRow = db.prepare('SELECT id FROM memo_folders WHERE remote_id = ?')
          .get(remote.folder_remote_id) as { id: string } | undefined;
        localFolderId = folderRow?.id ?? null;
      }

      if (!localFolderId) continue; // Skip if folder not found locally

      const localByRemoteId = db.prepare('SELECT * FROM memos WHERE remote_id = ?')
        .get(remote.id) as Record<string, unknown> | undefined;
      const localByLocalId = remote.local_id
        ? db.prepare('SELECT * FROM memos WHERE id = ?').get(remote.local_id) as Record<string, unknown> | undefined
        : undefined;

      const local = localByRemoteId || localByLocalId;

      if (local) {
        const localUpdated = new Date(local.updated_at as string).getTime();
        const remoteUpdated = new Date(remote.updated_at as string).getTime();

        if (remoteUpdated > localUpdated) {
          db.prepare(`
            UPDATE memos SET
              folder_id = ?, title = ?, content = ?,
              sort_order = ?, remote_id = ?, synced_at = datetime('now'),
              updated_at = ?
            WHERE id = ?
          `).run(
            localFolderId, remote.title, remote.content ?? '',
            remote.sort_order ?? 0, remote.id, remote.updated_at,
            local.id as string,
          );
        } else if (!local.remote_id) {
          db.prepare("UPDATE memos SET remote_id = ?, synced_at = datetime('now') WHERE id = ?")
            .run(remote.id, local.id as string);
        }
      } else {
        db.prepare(`
          INSERT INTO memos (folder_id, title, content, sort_order, remote_id, synced_at, updated_at)
          VALUES (?, ?, ?, ?, ?, datetime('now'), ?)
        `).run(
          localFolderId, remote.title, remote.content ?? '',
          remote.sort_order ?? 0, remote.id, remote.updated_at,
        );
      }
    }

    // Remove locally synced memos that were deleted remotely
    const localSynced = db.prepare('SELECT id, remote_id FROM memos WHERE remote_id IS NOT NULL')
      .all() as { id: string; remote_id: string }[];

    for (const local of localSynced) {
      if (!remoteIds.has(local.remote_id)) {
        db.prepare('DELETE FROM memos WHERE id = ?').run(local.id);
      }
    }
  } catch (err) {
    console.error('Memo pull error:', err);
  }
}

/** Push calendar events to user_calendar_events */
export async function pushCalendarEvents(): Promise<void> {
  if (!supabaseService.isConfigured()) return;

  const db = getDatabase();
  const client = supabaseService.getClient();
  const { data: { user } } = await client.auth.getUser();
  if (!user) return;

  const rows = db.prepare(
    `SELECT * FROM calendar_events WHERE (synced_at IS NULL OR updated_at > synced_at)`
  ).all();

  for (const row of rows) {
    const event = rowToEvent(row as Record<string, unknown>);
    const remoteData = {
      user_id: user.id,
      local_id: event.id,
      title: event.title,
      memo: event.memo,
      event_date: event.eventDate,
      event_time: event.eventTime,
      repeat_type: event.repeatType,
      alert_before: event.alertBefore,
      is_snoozed: event.isSnoozed,
      snooze_until: event.snoozeUntil,
      updated_at: event.updatedAt,
    };

    try {
      if (event.remoteId) {
        await client.from('user_calendar_events').update(remoteData).eq('id', event.remoteId);
      } else {
        const { data } = await client
          .from('user_calendar_events')
          .insert(remoteData)
          .select('id')
          .single();

        if (data) {
          db.prepare("UPDATE calendar_events SET remote_id = ?, synced_at = datetime('now') WHERE id = ?")
            .run(data.id, event.id);
          continue;
        }
      }
      db.prepare("UPDATE calendar_events SET synced_at = datetime('now') WHERE id = ?").run(event.id);
    } catch (err) {
      console.error(`Calendar event push failed for ${event.id}:`, err);
    }
  }

  // Handle remote deletes
  try {
    const { data: remoteAll } = await client
      .from('user_calendar_events')
      .select('id, local_id')
      .eq('user_id', user.id);

    if (remoteAll) {
      for (const remote of remoteAll) {
        const localExists = db.prepare('SELECT id FROM calendar_events WHERE id = ? OR remote_id = ?')
          .get(remote.local_id, remote.id);
        if (!localExists) {
          await client.from('user_calendar_events').delete().eq('id', remote.id);
        }
      }
    }
  } catch {}
}

/** Pull calendar events from user_calendar_events */
export async function pullCalendarEvents(): Promise<void> {
  if (!supabaseService.isConfigured()) return;

  const db = getDatabase();
  const client = supabaseService.getClient();
  const { data: { user } } = await client.auth.getUser();
  if (!user) return;

  try {
    const { data: remoteEvents, error } = await client
      .from('user_calendar_events')
      .select('*')
      .eq('user_id', user.id);

    if (error || !remoteEvents) return;

    const remoteIds = new Set(remoteEvents.map(r => r.id as string));

    for (const remote of remoteEvents) {
      const localByRemoteId = db.prepare('SELECT * FROM calendar_events WHERE remote_id = ?')
        .get(remote.id) as Record<string, unknown> | undefined;
      const localByLocalId = remote.local_id
        ? db.prepare('SELECT * FROM calendar_events WHERE id = ?').get(remote.local_id) as Record<string, unknown> | undefined
        : undefined;

      const local = localByRemoteId || localByLocalId;

      if (local) {
        const localUpdated = new Date(local.updated_at as string).getTime();
        const remoteUpdated = new Date(remote.updated_at as string).getTime();

        if (remoteUpdated > localUpdated) {
          db.prepare(`
            UPDATE calendar_events SET
              title = ?, memo = ?, event_date = ?, event_time = ?,
              repeat_type = ?, alert_before = ?, is_snoozed = ?, snooze_until = ?,
              remote_id = ?, synced_at = datetime('now'), updated_at = ?
            WHERE id = ?
          `).run(
            remote.title, remote.memo ?? '', remote.event_date, remote.event_time,
            remote.repeat_type ?? 'none', remote.alert_before ?? 0,
            remote.is_snoozed ? 1 : 0, remote.snooze_until,
            remote.id, remote.updated_at,
            local.id as string,
          );
        } else if (!local.remote_id) {
          db.prepare("UPDATE calendar_events SET remote_id = ?, synced_at = datetime('now') WHERE id = ?")
            .run(remote.id, local.id as string);
        }
      } else {
        db.prepare(`
          INSERT INTO calendar_events (title, memo, event_date, event_time, repeat_type, alert_before, is_snoozed, snooze_until, remote_id, synced_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), ?)
        `).run(
          remote.title, remote.memo ?? '', remote.event_date, remote.event_time,
          remote.repeat_type ?? 'none', remote.alert_before ?? 0,
          remote.is_snoozed ? 1 : 0, remote.snooze_until,
          remote.id, remote.updated_at,
        );
      }
    }

    // Remove locally synced events that were deleted remotely
    const localSynced = db.prepare('SELECT id, remote_id FROM calendar_events WHERE remote_id IS NOT NULL')
      .all() as { id: string; remote_id: string }[];

    for (const local of localSynced) {
      if (!remoteIds.has(local.remote_id)) {
        db.prepare('DELETE FROM calendar_events WHERE id = ?').run(local.id);
      }
    }
  } catch (err) {
    console.error('Calendar event pull error:', err);
  }
}

// ─── Direct Todo Sync ────────────────────────────────────────────

/** Push a single todo directly to another user via direct_todos table */
export async function sendDirectTodo(data: SendDirectTodoDto): Promise<void> {
  if (!supabaseService.isConfigured()) return;
  const client = supabaseService.getClient();
  const { error } = await client.from('direct_todos').insert({
    creator_jira_id: data.creatorJiraId,
    assignee_jira_id: data.assigneeJiraId,
    title: data.title,
    description: data.description,
    priority: data.priority,
    due_date: data.dueDate ?? null,
    updated_at: new Date().toISOString(),
  });
  if (error) throw new Error(error.message);
}

/** Pull todos assigned to me from direct_todos and save locally */
export async function pullDirectTodos(myJiraId: string): Promise<void> {
  if (!supabaseService.isConfigured() || !myJiraId) return;
  const db = getDatabase();
  const client = supabaseService.getClient();

  const { data: remoteTodos, error } = await client
    .from('direct_todos')
    .select('*')
    .eq('assignee_jira_id', myJiraId);

  if (error || !remoteTodos) return;

  for (const remote of remoteTodos) {
    const existing = db.prepare('SELECT * FROM todos WHERE remote_id = ?')
      .get(remote.id) as Record<string, unknown> | undefined;

    if (!existing) {
      const maxOrder = db.prepare(
        'SELECT COALESCE(MAX(sort_order), -1) + 1 as next_order FROM todos WHERE team_id IS NULL'
      ).get() as { next_order: number };

      db.prepare(`
        INSERT INTO todos (title, description, status, priority, due_date, assignee_id, sort_order, remote_id, is_direct, synced_at, updated_at)
        VALUES (?, ?, 'todo', ?, ?, ?, ?, ?, 1, datetime('now'), ?)
      `).run(
        remote.title, remote.description ?? '', remote.priority ?? 'medium',
        remote.due_date ?? null, remote.assignee_jira_id ?? '',
        maxOrder.next_order, remote.id, remote.updated_at,
      );
    } else {
      const localUpdated = new Date(existing.updated_at as string).getTime();
      const remoteUpdated = new Date(remote.updated_at as string).getTime();
      if (remoteUpdated > localUpdated) {
        db.prepare(`
          UPDATE todos SET title = ?, description = ?, priority = ?, due_date = ?,
            synced_at = datetime('now'), updated_at = ?
          WHERE remote_id = ?
        `).run(
          remote.title, remote.description ?? '', remote.priority ?? 'medium',
          remote.due_date ?? null, remote.updated_at, remote.id,
        );
      }
    }
  }
}

/** Push all personal data (todos + folders + memos + calendar) */
export async function pushAllPersonal(): Promise<void> {
  await pushPersonalTodos();
  await pushMemoFolders();
  await pushMemos();
  await pushCalendarEvents();
}

/** Pull all personal data (todos + folders + memos + calendar) */
export async function pullAllPersonal(): Promise<void> {
  await pullPersonalTodos();
  await pullMemoFolders();
  await pullMemos();
  await pullCalendarEvents();
}
