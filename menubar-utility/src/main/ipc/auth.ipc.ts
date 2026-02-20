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

function setupRealtime(jiraAccountId: string): void {
  supabaseService.getMyTeams(jiraAccountId).then(teams => {
    const teamIds = teams.map(t => t.id);
    supabaseService.subscribeRealtime(teamIds, (event, payload) => {
      for (const win of BrowserWindow.getAllWindows()) {
        win.webContents.send(event, payload);
      }
    });
  }).catch(() => {});
}

export function registerAuthHandlers(): void {
  ipcMain.handle('auth:autoAuth', async (): Promise<AuthUser | null> => {
    if (!isJiraConfigured() || !supabaseService.isConfigured()) {
      return null;
    }

    try {
      const jira = new JiraService();
      const myself = await jira.getMyself();
      const jiraEmail = settingsRepo.getSetting('jira_email')!;

      // 이미 세션 있으면 재사용
      const existing = await supabaseService.getSession();
      const user = existing ?? await supabaseService.autoSignInFromJira(jiraEmail, myself.displayName);
      if (!user) return null;

      // 기본 팀 보장
      await supabaseService.ensureDefaultTeam(user.id, myself.accountId, myself.displayName, jiraEmail);

      // 초기 동기화
      try {
        const teams = await supabaseService.getMyTeams(myself.accountId);
        await syncAll(teams.map(t => t.id));
      } catch {
        // Sync errors are non-fatal
      }

      setupRealtime(myself.accountId);

      // AuthUser에 jiraAccountId 포함
      return { ...user, id: user.id, jiraAccountId: myself.accountId };
    } catch {
      return null;
    }
  });

  ipcMain.handle('auth:signOut', async (): Promise<void> => {
    return supabaseService.signOut();
  });
}
