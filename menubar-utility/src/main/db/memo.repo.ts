import { getDatabase } from './index';
import type { MemoFolder, Memo, CreateFolderDto, UpdateFolderDto, CreateMemoDto, UpdateMemoDto } from '../../shared/types/memo.types';

export function rowToFolder(row: Record<string, unknown>): MemoFolder {
  return {
    id: row.id as string,
    parentId: row.parent_id as string | null,
    name: row.name as string,
    sortOrder: row.sort_order as number,
    isExpanded: (row.is_expanded as number) === 1,
    remoteId: row.remote_id as string | null,
    syncedAt: row.synced_at as string | null,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

export function rowToMemo(row: Record<string, unknown>): Memo {
  return {
    id: row.id as string,
    folderId: row.folder_id as string,
    title: row.title as string,
    content: row.content as string,
    sortOrder: row.sort_order as number,
    remoteId: row.remote_id as string | null,
    syncedAt: row.synced_at as string | null,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

export function getFolders(): MemoFolder[] {
  const db = getDatabase();
  const rows = db.prepare('SELECT * FROM memo_folders ORDER BY sort_order ASC').all() as Record<string, unknown>[];
  return rows.map(rowToFolder);
}

export function getAllMemos(): Memo[] {
  const db = getDatabase();
  const rows = db.prepare('SELECT * FROM memos ORDER BY sort_order ASC').all() as Record<string, unknown>[];
  return rows.map(rowToMemo);
}

export function createFolder(data: CreateFolderDto): MemoFolder {
  const db = getDatabase();
  const maxOrder = db.prepare(
    'SELECT COALESCE(MAX(sort_order), -1) + 1 as next FROM memo_folders WHERE parent_id IS ?'
  ).get(data.parentId ?? null) as { next: number };

  const info = db.prepare(
    'INSERT INTO memo_folders (parent_id, name, sort_order) VALUES (?, ?, ?)'
  ).run(data.parentId ?? null, data.name, maxOrder.next);

  return rowToFolder(
    db.prepare('SELECT * FROM memo_folders WHERE rowid = ?').get(info.lastInsertRowid) as Record<string, unknown>
  );
}

export function updateFolder(id: string, data: UpdateFolderDto): MemoFolder {
  const db = getDatabase();
  const sets: string[] = [];
  const params: unknown[] = [];

  if (data.name !== undefined) { sets.push('name = ?'); params.push(data.name); }
  if (data.parentId !== undefined) { sets.push('parent_id = ?'); params.push(data.parentId); }
  if (data.isExpanded !== undefined) { sets.push('is_expanded = ?'); params.push(data.isExpanded ? 1 : 0); }

  // Only bump updated_at for content changes (name, parentId), not UI state (isExpanded)
  if (data.name !== undefined || data.parentId !== undefined) {
    sets.push("updated_at = datetime('now')");
  }

  if (sets.length > 0) {
    params.push(id);
    db.prepare(`UPDATE memo_folders SET ${sets.join(', ')} WHERE id = ?`).run(...params);
  }

  return rowToFolder(db.prepare('SELECT * FROM memo_folders WHERE id = ?').get(id) as Record<string, unknown>);
}

export function deleteFolder(id: string): void {
  getDatabase().prepare('DELETE FROM memo_folders WHERE id = ?').run(id);
}

export function getMemos(folderId: string): Memo[] {
  const db = getDatabase();
  return (db.prepare('SELECT * FROM memos WHERE folder_id = ? ORDER BY sort_order ASC').all(folderId) as Record<string, unknown>[])
    .map(rowToMemo);
}

export function createMemo(data: CreateMemoDto): Memo {
  const db = getDatabase();
  const maxOrder = db.prepare(
    'SELECT COALESCE(MAX(sort_order), -1) + 1 as next FROM memos WHERE folder_id = ?'
  ).get(data.folderId) as { next: number };

  const info = db.prepare(
    'INSERT INTO memos (folder_id, title, content, sort_order) VALUES (?, ?, ?, ?)'
  ).run(data.folderId, data.title, data.content ?? '', maxOrder.next);

  return rowToMemo(
    db.prepare('SELECT * FROM memos WHERE rowid = ?').get(info.lastInsertRowid) as Record<string, unknown>
  );
}

export function updateMemo(id: string, data: UpdateMemoDto): Memo {
  const db = getDatabase();
  const sets: string[] = ["updated_at = datetime('now')"];
  const params: unknown[] = [];

  if (data.title !== undefined) { sets.push('title = ?'); params.push(data.title); }
  if (data.content !== undefined) { sets.push('content = ?'); params.push(data.content); }
  if (data.folderId !== undefined) { sets.push('folder_id = ?'); params.push(data.folderId); }

  params.push(id);
  db.prepare(`UPDATE memos SET ${sets.join(', ')} WHERE id = ?`).run(...params);

  return rowToMemo(db.prepare('SELECT * FROM memos WHERE id = ?').get(id) as Record<string, unknown>);
}

export function deleteMemo(id: string): void {
  getDatabase().prepare('DELETE FROM memos WHERE id = ?').run(id);
}

export function moveMemo(id: string, targetFolderId: string): void {
  getDatabase().prepare('UPDATE memos SET folder_id = ? WHERE id = ?').run(targetFolderId, id);
}

export function reorderMemos(ids: string[]): void {
  const db = getDatabase();
  const stmt = db.prepare('UPDATE memos SET sort_order = ? WHERE id = ?');
  const tx = db.transaction(() => {
    ids.forEach((id, index) => stmt.run(index, id));
  });
  tx();
}

export function reorderFolders(ids: string[]): void {
  const db = getDatabase();
  const stmt = db.prepare('UPDATE memo_folders SET sort_order = ? WHERE id = ?');
  const tx = db.transaction(() => {
    ids.forEach((id, index) => stmt.run(index, id));
  });
  tx();
}

export function searchMemos(query: string): Memo[] {
  const db = getDatabase();
  const pattern = `%${query}%`;
  return (db.prepare(
    'SELECT * FROM memos WHERE title LIKE ? OR content LIKE ? ORDER BY updated_at DESC'
  ).all(pattern, pattern) as Record<string, unknown>[]).map(rowToMemo);
}
