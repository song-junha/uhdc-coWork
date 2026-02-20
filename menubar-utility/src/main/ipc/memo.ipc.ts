import { ipcMain } from 'electron';
import * as memoRepo from '../db/memo.repo';
import type { CreateFolderDto, UpdateFolderDto, CreateMemoDto, UpdateMemoDto } from '../../shared/types/memo.types';

export function registerMemoHandlers(): void {
  ipcMain.handle('memo:getFolders', () => {
    return memoRepo.getFolders();
  });

  ipcMain.handle('memo:createFolder', (_event, data: CreateFolderDto) => {
    return memoRepo.createFolder(data);
  });

  ipcMain.handle('memo:updateFolder', (_event, id: string, data: UpdateFolderDto) => {
    return memoRepo.updateFolder(id, data);
  });

  ipcMain.handle('memo:deleteFolder', (_event, id: string) => {
    memoRepo.deleteFolder(id);
  });

  ipcMain.handle('memo:getMemos', (_event, folderId: string) => {
    return memoRepo.getMemos(folderId);
  });

  ipcMain.handle('memo:createMemo', (_event, data: CreateMemoDto) => {
    return memoRepo.createMemo(data);
  });

  ipcMain.handle('memo:updateMemo', (_event, id: string, data: UpdateMemoDto) => {
    return memoRepo.updateMemo(id, data);
  });

  ipcMain.handle('memo:deleteMemo', (_event, id: string) => {
    memoRepo.deleteMemo(id);
  });

  ipcMain.handle('memo:moveMemo', (_event, id: string, targetFolderId: string) => {
    memoRepo.moveMemo(id, targetFolderId);
  });

  ipcMain.handle('memo:reorderMemos', (_event, ids: string[]) => {
    memoRepo.reorderMemos(ids);
  });

  ipcMain.handle('memo:reorderFolders', (_event, ids: string[]) => {
    memoRepo.reorderFolders(ids);
  });

  ipcMain.handle('memo:search', (_event, query: string) => {
    return memoRepo.searchMemos(query);
  });
}
