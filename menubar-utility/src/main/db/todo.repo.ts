import { getDatabase } from './index';
import type { Todo, CreateTodoDto, UpdateTodoDto, TodoFilter } from '../../shared/types/todo.types';

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
    isDirect: !!(row.is_direct as number),
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

export function getAllTodos(filter: TodoFilter): Todo[] {
  const db = getDatabase();
  let sql = 'SELECT * FROM todos WHERE 1=1';
  const params: unknown[] = [];

  if (filter.status && filter.status !== 'all') {
    sql += ' AND status = ?';
    params.push(filter.status);
  }

  sql += ' ORDER BY sort_order ASC, created_at DESC';

  return db.prepare(sql).all(...params).map(rowToTodo);
}

export function createTodo(data: CreateTodoDto): Todo {
  const db = getDatabase();
  const maxOrder = db.prepare(
    'SELECT COALESCE(MAX(sort_order), -1) + 1 as next_order FROM todos WHERE team_id IS ?'
  ).get(data.teamId ?? null) as { next_order: number };

  const stmt = db.prepare(`
    INSERT INTO todos (title, description, priority, due_date, assignee_name, assignee_id, team_id, sort_order)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const info = stmt.run(
    data.title,
    data.description ?? '',
    data.priority ?? 'medium',
    data.dueDate ?? null,
    data.assigneeName ?? '',
    data.assigneeId ?? null,
    data.teamId ?? null,
    maxOrder.next_order,
  );

  const row = db.prepare('SELECT * FROM todos WHERE rowid = ?').get(info.lastInsertRowid) as Record<string, unknown>;
  return rowToTodo(row);
}

export function updateTodo(id: string, data: UpdateTodoDto): Todo {
  const db = getDatabase();
  const sets: string[] = ['updated_at = datetime(\'now\')'];
  const params: unknown[] = [];

  if (data.title !== undefined) { sets.push('title = ?'); params.push(data.title); }
  if (data.description !== undefined) { sets.push('description = ?'); params.push(data.description); }
  if (data.status !== undefined) { sets.push('status = ?'); params.push(data.status); }
  if (data.priority !== undefined) { sets.push('priority = ?'); params.push(data.priority); }
  if (data.dueDate !== undefined) { sets.push('due_date = ?'); params.push(data.dueDate); }
  if (data.assigneeName !== undefined) { sets.push('assignee_name = ?'); params.push(data.assigneeName); }
  if (data.assigneeId !== undefined) { sets.push('assignee_id = ?'); params.push(data.assigneeId); }
  if (data.teamId !== undefined) { sets.push('team_id = ?'); params.push(data.teamId); }

  params.push(id);
  db.prepare(`UPDATE todos SET ${sets.join(', ')} WHERE id = ?`).run(...params);

  return rowToTodo(db.prepare('SELECT * FROM todos WHERE id = ?').get(id) as Record<string, unknown>);
}

export function deleteTodo(id: string): void {
  getDatabase().prepare('DELETE FROM todos WHERE id = ?').run(id);
}

export function getRecentAssignees(): string[] {
  const db = getDatabase();
  const rows = db.prepare(
    "SELECT DISTINCT assignee_name FROM todos WHERE assignee_name != '' ORDER BY updated_at DESC LIMIT 20"
  ).all() as { assignee_name: string }[];
  return rows.map(r => r.assignee_name);
}

export function reorderTodos(ids: string[]): void {
  const db = getDatabase();
  const stmt = db.prepare('UPDATE todos SET sort_order = ? WHERE id = ?');
  const reorder = db.transaction(() => {
    ids.forEach((id, index) => stmt.run(index, id));
  });
  reorder();
}
