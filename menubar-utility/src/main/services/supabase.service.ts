import { createClient, type SupabaseClient, type RealtimeChannel } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { join } from 'path';
import { app } from 'electron';
import * as settingsRepo from '../db/settings.repo';
import type { AuthUser } from '../../shared/types/team.types';

// 빌드 시 Vite define으로 main process에만 주입됨 (Renderer 번들에는 포함되지 않음)
function loadEnvDefaults(): { url: string; key: string } {
  // 1) 빌드 시 주입된 값 사용 (프로덕션)
  const injectedUrl = process.env.SUPABASE_URL || '';
  const injectedKey = process.env.SUPABASE_ANON_KEY || '';
  if (injectedUrl && injectedKey) return { url: injectedUrl, key: injectedKey };

  // 2) .env 파일 직접 파싱 (개발 모드 fallback)
  const envPaths = [
    join(app.getAppPath(), '.env'),
    join(app.getAppPath(), '..', '.env'),
    join(process.cwd(), '.env'),
  ];
  for (const envPath of envPaths) {
    try {
      const content = readFileSync(envPath, 'utf-8');
      const lines = content.split('\n');
      let url = '';
      let key = '';
      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.startsWith('SUPABASE_URL=')) url = trimmed.split('=').slice(1).join('=');
        if (trimmed.startsWith('SUPABASE_ANON_KEY=')) key = trimmed.split('=').slice(1).join('=');
      }
      if (url && key) return { url, key };
    } catch {}
  }
  return { url: '', key: '' };
}

const ENV_DEFAULTS = loadEnvDefaults();
const DEFAULT_URL = ENV_DEFAULTS.url;
const DEFAULT_KEY = ENV_DEFAULTS.key;

export class SupabaseService {
  private client: SupabaseClient | null = null;
  private realtimeChannel: RealtimeChannel | null = null;
  private personalRealtimeChannel: RealtimeChannel | null = null;

  private getConfig(): { url: string; key: string } {
    const url = settingsRepo.getSetting('supabase_url') || DEFAULT_URL;
    const key = settingsRepo.getSetting('supabase_anon_key') || DEFAULT_KEY;
    return { url, key };
  }

  isConfigured(): boolean {
    const { url, key } = this.getConfig();
    return !!(url && key);
  }

  getClient(): SupabaseClient {
    if (this.client) return this.client;

    const { url, key } = this.getConfig();
    if (!url || !key) {
      throw new Error('Supabase is not configured. Please set URL and Anon Key in Settings.');
    }

    this.client = createClient(url, key);
    return this.client;
  }

  resetClient(): void {
    this.unsubscribeRealtime();
    this.unsubscribePersonalRealtime();
    this.client = null;
  }

  /**
   * Jira 정보로 자동 Supabase 로그인.
   * 계정이 없으면 자동 생성, 있으면 로그인.
   */
  async autoSignInFromJira(jiraEmail: string, displayName: string): Promise<AuthUser> {
    if (!this.isConfigured()) throw new Error('Supabase not configured');

    const client = this.getClient();
    // 결정적 비밀번호: Jira 이메일 기반 (Supabase는 RLS로 보호됨)
    const password = `menubar_${jiraEmail}_auto`;

    // 먼저 로그인 시도
    const { data: signInData, error: signInError } = await client.auth.signInWithPassword({
      email: jiraEmail,
      password,
    });

    if (!signInError && signInData.user) {
      await this.upsertProfile(signInData.user.id, jiraEmail, displayName);
      return this.mapUser(signInData.user);
    }

    // 로그인 실패 → 회원가입
    const { data: signUpData, error: signUpError } = await client.auth.signUp({
      email: jiraEmail,
      password,
      options: { data: { display_name: displayName } },
    });

    if (signUpError) throw new Error(signUpError.message);
    if (!signUpData.user) throw new Error('Auto sign-up failed');

    // 이메일 확인이 필요한 경우 세션이 없음
    if (!signUpData.session) {
      throw new Error('Email confirmation is enabled in Supabase. Please disable it: Dashboard > Authentication > Providers > Email > Confirm email OFF');
    }

    await this.upsertProfile(signUpData.user.id, jiraEmail, displayName);

    return this.mapUser(signUpData.user);
  }

  async signOut(): Promise<void> {
    const client = this.getClient();
    this.unsubscribeRealtime();
    const { error } = await client.auth.signOut();
    if (error) throw new Error(error.message);
  }

  async getSession(): Promise<AuthUser | null> {
    if (!this.isConfigured()) return null;
    try {
      const client = this.getClient();
      const { data } = await client.auth.getSession();
      if (!data.session?.user) return null;
      return this.mapUser(data.session.user);
    } catch {
      return null;
    }
  }

  async getMyTeams(jiraAccountId: string) {
    const client = this.getClient();
    const { data, error } = await client
      .from('team_members')
      .select('team_id, role, teams(*)')
      .eq('jira_account_id', jiraAccountId);

    if (error) throw new Error(error.message);

    return (data ?? []).map((row: Record<string, unknown>) => {
      const team = row.teams as Record<string, unknown>;
      return {
        id: team.id as string,
        name: team.name as string,
        type: 'group' as const,
        description: (team.description as string) || '',
        createdBy: team.created_by as string,
        isArchived: team.is_archived as boolean,
        createdAt: team.created_at as string,
        archivedAt: (team.archived_at as string) || null,
        memberCount: team.member_count as number | undefined,
      };
    });
  }

  async getMembers(teamId: string) {
    const client = this.getClient();
    const { data, error } = await client
      .from('team_members')
      .select('id, team_id, jira_account_id, display_name, email, avatar_url, role, joined_at')
      .eq('team_id', teamId);

    if (error) throw new Error(error.message);

    return (data ?? []).map((row: Record<string, unknown>) => ({
      id: row.id as string,
      teamId: row.team_id as string,
      jiraAccountId: row.jira_account_id as string,
      role: row.role as 'admin' | 'member',
      joinedAt: row.joined_at as string,
      displayName: (row.display_name as string) || '',
      email: row.email as string | undefined,
      avatarUrl: row.avatar_url as string | undefined,
    }));
  }

  async createGroup(jiraAccountId: string, displayName: string, email: string, groupName: string, description: string) {
    const client = this.getClient();
    const session = await this.getSession();
    const createdBy = session?.id ?? jiraAccountId;

    const { data: team, error: teamErr } = await client
      .from('teams')
      .insert({ name: groupName, type: 'group', description, created_by: createdBy })
      .select()
      .single();
    if (teamErr) throw new Error(teamErr.message);

    // 생성자를 admin으로 등록
    await client.from('team_members').insert({
      team_id: team.id,
      jira_account_id: jiraAccountId,
      display_name: displayName,
      email,
      role: 'admin',
    });

    return {
      id: team.id,
      name: team.name,
      type: 'group' as const,
      description: team.description || '',
      createdBy: team.created_by,
      isArchived: team.is_archived,
      createdAt: team.created_at,
      archivedAt: team.archived_at || null,
    };
  }

  private async getCurrentUserId(): Promise<string> {
    const session = await this.getSession();
    if (!session) throw new Error('인증이 필요합니다');
    return session.id;
  }

  private async verifyTeamOwner(groupId: string): Promise<void> {
    const userId = await this.getCurrentUserId();
    const client = this.getClient();
    const { data } = await client
      .from('teams')
      .select('id')
      .eq('id', groupId)
      .eq('created_by', userId)
      .single();
    if (!data) throw new Error('본인이 생성한 팀만 수정/삭제할 수 있습니다');
  }

  async archiveGroup(groupId: string): Promise<void> {
    await this.verifyTeamOwner(groupId);
    const client = this.getClient();
    const userId = await this.getCurrentUserId();
    const { error } = await client
      .from('teams')
      .update({ is_archived: true, archived_at: new Date().toISOString() })
      .eq('id', groupId)
      .eq('created_by', userId);
    if (error) throw new Error(error.message);
  }

  async deleteGroup(groupId: string): Promise<void> {
    await this.verifyTeamOwner(groupId);
    const client = this.getClient();
    const userId = await this.getCurrentUserId();
    // team_members는 ON DELETE CASCADE로 자동 삭제
    const { error } = await client
      .from('teams')
      .delete()
      .eq('id', groupId)
      .eq('created_by', userId);
    if (error) throw new Error(error.message);
  }

  async renameGroup(groupId: string, name: string): Promise<void> {
    await this.verifyTeamOwner(groupId);
    const client = this.getClient();
    const userId = await this.getCurrentUserId();
    const { error } = await client
      .from('teams')
      .update({ name })
      .eq('id', groupId)
      .eq('created_by', userId);
    if (error) throw new Error(error.message);
  }

  async addMember(teamId: string, jiraAccountId: string, displayName: string, email: string): Promise<void> {
    await this.verifyTeamOwner(teamId);
    const client = this.getClient();
    const { error } = await client.from('team_members').insert({
      team_id: teamId,
      jira_account_id: jiraAccountId,
      display_name: displayName,
      email,
      role: 'member',
    });
    if (error) throw new Error(error.message);
  }

  async removeMember(teamId: string, memberId: string): Promise<void> {
    await this.verifyTeamOwner(teamId);
    const client = this.getClient();
    const { error } = await client
      .from('team_members')
      .delete()
      .eq('id', memberId)
      .eq('team_id', teamId);
    if (error) throw new Error(error.message);
  }

  subscribeRealtime(teamIds: string[], callback: (event: string, payload: unknown) => void): void {
    this.unsubscribeRealtime();
    if (teamIds.length === 0) return;

    const client = this.getClient();
    this.realtimeChannel = client
      .channel('team-changes')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'shared_todos',
        filter: `team_id=in.(${teamIds.join(',')})`,
      }, (payload) => callback('todo:updated', payload))
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'team_members',
        filter: `team_id=in.(${teamIds.join(',')})`,
      }, (payload) => callback('team:updated', payload))
      .subscribe();
  }

  unsubscribeRealtime(): void {
    if (this.realtimeChannel) {
      this.realtimeChannel.unsubscribe();
      this.realtimeChannel = null;
    }
  }

  subscribePersonalRealtime(userId: string, callback: (event: string, payload: unknown) => void): void {
    this.unsubscribePersonalRealtime();

    const client = this.getClient();
    this.personalRealtimeChannel = client
      .channel('personal-changes')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'user_todos',
        filter: `user_id=eq.${userId}`,
      }, (payload) => callback('personal:todo-updated', payload))
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'user_memo_folders',
        filter: `user_id=eq.${userId}`,
      }, (payload) => callback('personal:folder-updated', payload))
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'user_memos',
        filter: `user_id=eq.${userId}`,
      }, (payload) => callback('personal:memo-updated', payload))
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'user_calendar_events',
        filter: `user_id=eq.${userId}`,
      }, (payload) => callback('personal:calendar-updated', payload))
      .subscribe();
  }

  unsubscribePersonalRealtime(): void {
    if (this.personalRealtimeChannel) {
      this.personalRealtimeChannel.unsubscribe();
      this.personalRealtimeChannel = null;
    }
  }

  private async upsertProfile(userId: string, email: string, displayName: string): Promise<void> {
    const client = this.getClient();
    await client.from('profiles').upsert({
      id: userId,
      email,
      display_name: displayName,
      updated_at: new Date().toISOString(),
    });
  }


  private mapUser(user: { id: string; email?: string; user_metadata?: Record<string, unknown> }): AuthUser {
    return {
      id: user.id,
      email: user.email ?? '',
      displayName: (user.user_metadata?.display_name as string) ?? user.email?.split('@')[0] ?? '',
      avatarUrl: (user.user_metadata?.avatar_url as string) ?? null,
    };
  }
}

// Singleton
export const supabaseService = new SupabaseService();
