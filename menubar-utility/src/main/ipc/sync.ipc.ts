import { ipcMain } from 'electron';
import {
  pushPersonalTodos,
  pullPersonalTodos,
  pushMemoFolders,
  pullMemoFolders,
  pushMemos,
  pullMemos,
  pushCalendarEvents,
  pullCalendarEvents,
  pushAllPersonal,
  pullAllPersonal,
} from '../services/sync.service';

export function registerSyncHandlers(): void {
  ipcMain.handle('sync:pushPersonalTodos', async (): Promise<void> => {
    return pushPersonalTodos();
  });

  ipcMain.handle('sync:pullPersonalTodos', async (): Promise<void> => {
    return pullPersonalTodos();
  });

  ipcMain.handle('sync:pushMemoFolders', async (): Promise<void> => {
    return pushMemoFolders();
  });

  ipcMain.handle('sync:pullMemoFolders', async (): Promise<void> => {
    return pullMemoFolders();
  });

  ipcMain.handle('sync:pushMemos', async (): Promise<void> => {
    return pushMemos();
  });

  ipcMain.handle('sync:pullMemos', async (): Promise<void> => {
    return pullMemos();
  });

  ipcMain.handle('sync:pushCalendarEvents', async (): Promise<void> => {
    return pushCalendarEvents();
  });

  ipcMain.handle('sync:pullCalendarEvents', async (): Promise<void> => {
    return pullCalendarEvents();
  });

  ipcMain.handle('sync:pushAllPersonal', async (): Promise<void> => {
    return pushAllPersonal();
  });

  ipcMain.handle('sync:pullAllPersonal', async (): Promise<void> => {
    return pullAllPersonal();
  });
}
