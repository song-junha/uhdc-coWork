import { ipcMain, BrowserWindow } from 'electron';
import { supabaseService } from '../services/supabase.service';
import { syncAll } from '../services/sync.service';
import type { AuthUser } from '../../shared/types/team.types';

function setupRealtime(userId: string): void {
  supabaseService.getMyTeams(userId).then(teams => {
    const teamIds = teams.map(t => t.id);
    supabaseService.subscribeRealtime(teamIds, (event, payload) => {
      const windows = BrowserWindow.getAllWindows();
      for (const win of windows) {
        win.webContents.send(event, payload);
      }
    });
  }).catch(() => {
    // Silently ignore realtime setup failure
  });
}

export function registerAuthHandlers(): void {
  ipcMain.handle('auth:signIn', async (_event, email: string, password: string): Promise<AuthUser> => {
    const user = await supabaseService.signIn(email, password);
    // Trigger initial sync and realtime
    try {
      const teams = await supabaseService.getMyTeams(user.id);
      await syncAll(teams.map(t => t.id));
    } catch {
      // Sync failure shouldn't block sign-in
    }
    setupRealtime(user.id);
    return user;
  });

  ipcMain.handle('auth:signUp', async (_event, email: string, password: string, displayName: string): Promise<AuthUser> => {
    const user = await supabaseService.signUp(email, password, displayName);
    setupRealtime(user.id);
    return user;
  });

  ipcMain.handle('auth:signOut', async (): Promise<void> => {
    return supabaseService.signOut();
  });

  ipcMain.handle('auth:getSession', async (): Promise<AuthUser | null> => {
    const user = await supabaseService.getSession();
    if (user) setupRealtime(user.id);
    return user;
  });
}
