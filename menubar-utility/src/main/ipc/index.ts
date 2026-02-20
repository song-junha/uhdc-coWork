import { ipcMain, shell } from 'electron';
import { registerTodoHandlers } from './todo.ipc';
import { registerMemoHandlers } from './memo.ipc';
import { registerCalendarHandlers } from './calendar.ipc';
import { registerJiraHandlers } from './jira.ipc';
import { registerTeamHandlers } from './team.ipc';
import { registerAuthHandlers } from './auth.ipc';
import { registerSettingsHandlers } from './settings.ipc';

export function registerIpcHandlers(): void {
  registerTodoHandlers();
  registerMemoHandlers();
  registerCalendarHandlers();
  registerJiraHandlers();
  registerTeamHandlers();
  registerAuthHandlers();
  registerSettingsHandlers();

  ipcMain.handle('shell:openExternal', (_event, url: string) => {
    return shell.openExternal(url);
  });
}
