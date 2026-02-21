import { ipcMain, shell } from 'electron';
import { registerTodoHandlers } from './todo.ipc';
import { registerMemoHandlers } from './memo.ipc';
import { registerCalendarHandlers } from './calendar.ipc';
import { registerJiraHandlers } from './jira.ipc';
import { registerTeamHandlers } from './team.ipc';
import { registerAuthHandlers } from './auth.ipc';
import { registerSettingsHandlers } from './settings.ipc';
import { registerSyncHandlers } from './sync.ipc';

export function registerIpcHandlers(): void {
  registerTodoHandlers();
  registerMemoHandlers();
  registerCalendarHandlers();
  registerJiraHandlers();
  registerTeamHandlers();
  registerAuthHandlers();
  registerSettingsHandlers();
  registerSyncHandlers();

  ipcMain.handle('shell:openExternal', (_event, url: string) => {
    const parsed = new URL(url);
    if (!['https:', 'http:'].includes(parsed.protocol)) {
      throw new Error(`허용되지 않는 프로토콜: ${parsed.protocol}`);
    }
    return shell.openExternal(url);
  });
}
