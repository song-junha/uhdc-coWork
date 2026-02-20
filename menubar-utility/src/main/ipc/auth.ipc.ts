import { ipcMain, BrowserWindow } from 'electron';
import { supabaseService } from '../services/supabase.service';
import { JiraService } from '../services/jira.service';
import { syncAll } from '../services/sync.service';
import * as settingsRepo from '../db/settings.repo';
import type { AuthUser } from '../../shared/types/team.types';

function isJiraConfigured(): boolean {
  const url = settingsRepo.getSetting('jira_base_url');
  const email = settingsRepo.getSetting('jira_email');
  const token = settingsRepo.getSetting('jira_api_token');
  return !!(url && email && token);
}

function setupRealtime(userId: string): void {
  supabaseService.getMyTeams(userId).then(teams => {
    const teamIds = teams.map(t => t.id);
    supabaseService.subscribeRealtime(teamIds, (event, payload) => {
      for (const win of BrowserWindow.getAllWindows()) {
        win.webContents.send(event, payload);
      }
    });
  }).catch(() => {});
}

export function registerAuthHandlers(): void {
  // Jira 정보로 자동 Supabase 인증
  ipcMain.handle('auth:autoAuth', async (): Promise<AuthUser | null> => {
    if (!isJiraConfigured() || !supabaseService.isConfigured()) return null;

    // 이미 세션이 있으면 재사용
    const existing = await supabaseService.getSession();
    if (existing) {
      setupRealtime(existing.id);
      return existing;
    }

    // Jira에서 본인 정보 가져와서 자동 로그인
    try {
      const jira = new JiraService();
      const myself = await jira.getMyself();
      const jiraEmail = settingsRepo.getSetting('jira_email')!;

      const user = await supabaseService.autoSignInFromJira(jiraEmail, myself.displayName);

      // 초기 동기화
      try {
        const teams = await supabaseService.getMyTeams(user.id);
        await syncAll(teams.map(t => t.id));
      } catch {}

      setupRealtime(user.id);
      return user;
    } catch (err) {
      console.error('Auto auth failed:', err);
      return null;
    }
  });

  ipcMain.handle('auth:signOut', async (): Promise<void> => {
    return supabaseService.signOut();
  });
}
