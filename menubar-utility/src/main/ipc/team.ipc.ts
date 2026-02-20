import { ipcMain } from 'electron';
import { supabaseService } from '../services/supabase.service';
import { JiraService } from '../services/jira.service';
import { pushTodos, pullTodos } from '../services/sync.service';
import * as settingsRepo from '../db/settings.repo';
import type { CreateGroupDto, Team, TeamMember } from '../../shared/types/team.types';

function getJiraAccountId(): string {
  // 캐싱은 auth.ipc에서 처리하므로 여기서는 동기적으로 불가
  // team handlers는 이미 인증된 상태에서 호출됨
  throw new Error('Use jiraAccountId from store');
}

export function registerTeamHandlers(): void {
  ipcMain.handle('team:getMyTeams', async (): Promise<Team[]> => {
    if (!supabaseService.isConfigured()) return [];
    try {
      const jira = new JiraService();
      const myself = await jira.getMyself();
      return await supabaseService.getMyTeams(myself.accountId);
    } catch {
      return [];
    }
  });

  ipcMain.handle('team:getMembers', async (_event, teamId: string): Promise<TeamMember[]> => {
    if (!supabaseService.isConfigured()) return [];
    try {
      return await supabaseService.getMembers(teamId);
    } catch {
      return [];
    }
  });

  ipcMain.handle('team:createSpotGroup', async (_event, data: CreateGroupDto): Promise<Team | null> => {
    const jira = new JiraService();
    const myself = await jira.getMyself();
    const jiraEmail = settingsRepo.getSetting('jira_email') ?? '';

    return supabaseService.createSpotGroup(
      myself.accountId,
      myself.displayName,
      jiraEmail,
      data.name,
      data.description ?? '',
    );
  });

  ipcMain.handle('team:archiveGroup', async (_event, groupId: string): Promise<void> => {
    return supabaseService.archiveGroup(groupId);
  });

  ipcMain.handle('team:deleteGroup', async (_event, groupId: string): Promise<void> => {
    return supabaseService.deleteGroup(groupId);
  });

  ipcMain.handle('team:renameGroup', async (_event, groupId: string, name: string): Promise<void> => {
    return supabaseService.renameGroup(groupId, name);
  });

  ipcMain.handle('team:addMember', async (_event, teamId: string, jiraAccountId: string, displayName: string, email: string): Promise<void> => {
    return supabaseService.addMember(teamId, jiraAccountId, displayName, email);
  });

  ipcMain.handle('team:removeMember', async (_event, teamId: string, memberId: string): Promise<void> => {
    return supabaseService.removeMember(teamId, memberId);
  });

  // Sync handlers
  ipcMain.handle('sync:pushTodos', async (_event, teamId: string): Promise<void> => {
    return pushTodos(teamId);
  });

  ipcMain.handle('sync:pullTodos', async (_event, teamId: string): Promise<void> => {
    return pullTodos(teamId);
  });
}
