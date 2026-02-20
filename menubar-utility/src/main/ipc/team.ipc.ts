import { ipcMain } from 'electron';
import { supabaseService } from '../services/supabase.service';
import { pushTodos, pullTodos } from '../services/sync.service';
import type { CreateGroupDto, Team, TeamMember } from '../../shared/types/team.types';

async function getCurrentUserId(): Promise<string> {
  const session = await supabaseService.getSession();
  if (!session) throw new Error('Not authenticated');
  return session.id;
}

export function registerTeamHandlers(): void {
  ipcMain.handle('team:getMyTeams', async (): Promise<Team[]> => {
    if (!supabaseService.isConfigured()) return [];
    try {
      const userId = await getCurrentUserId();
      return await supabaseService.getMyTeams(userId);
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
    const userId = await getCurrentUserId();
    return supabaseService.createSpotGroup(
      userId,
      data.name,
      data.description ?? '',
      data.memberIds ?? [],
      data.inviteEmails ?? [],
    );
  });

  ipcMain.handle('team:archiveGroup', async (_event, groupId: string): Promise<void> => {
    return supabaseService.archiveGroup(groupId);
  });

  ipcMain.handle('team:invite', async (_event, teamId: string, email: string): Promise<void> => {
    const userId = await getCurrentUserId();
    return supabaseService.invite(teamId, email, userId);
  });

  ipcMain.handle('team:removeMember', async (_event, teamId: string, userId: string): Promise<void> => {
    return supabaseService.removeMember(teamId, userId);
  });

  // Sync handlers
  ipcMain.handle('sync:pushTodos', async (_event, teamId: string): Promise<void> => {
    return pushTodos(teamId);
  });

  ipcMain.handle('sync:pullTodos', async (_event, teamId: string): Promise<void> => {
    return pullTodos(teamId);
  });
}
