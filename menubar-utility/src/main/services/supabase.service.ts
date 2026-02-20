import { createClient, type SupabaseClient, type RealtimeChannel } from '@supabase/supabase-js';
import * as settingsRepo from '../db/settings.repo';
import type { AuthUser } from '../../shared/types/team.types';

// Built-in defaults from .env (빌드 시 embed, 사용자 입력 불필요)
const DEFAULT_URL = import.meta.env.VITE_SUPABASE_URL ?? '';
const DEFAULT_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY ?? '';

export class SupabaseService {
  private client: SupabaseClient | null = null;
  private realtimeChannel: RealtimeChannel | null = null;

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
        type: team.type as 'default' | 'spot',
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

  async createSpotGroup(jiraAccountId: string, displayName: string, email: string, groupName: string, description: string) {
    const client = this.getClient();
    const session = await this.getSession();
    const createdBy = session?.id ?? jiraAccountId;

    const { data: team, error: teamErr } = await client
      .from('teams')
      .insert({ name: groupName, type: 'spot', description, created_by: createdBy })
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
      type: team.type as 'default' | 'spot',
      description: team.description || '',
      createdBy: team.created_by,
      isArchived: team.is_archived,
      createdAt: team.created_at,
      archivedAt: team.archived_at || null,
    };
  }

  async archiveGroup(groupId: string): Promise<void> {
    const client = this.getClient();
    const { error } = await client
      .from('teams')
      .update({ is_archived: true, archived_at: new Date().toISOString() })
      .eq('id', groupId);
    if (error) throw new Error(error.message);
  }

  async addMember(teamId: string, jiraAccountId: string, displayName: string, email: string): Promise<void> {
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

  private async upsertProfile(userId: string, email: string, displayName: string): Promise<void> {
    const client = this.getClient();
    await client.from('profiles').upsert({
      id: userId,
      email,
      display_name: displayName,
      updated_at: new Date().toISOString(),
    });
  }

  async ensureDefaultTeam(userId: string, jiraAccountId: string, displayName: string, email: string): Promise<void> {
    const client = this.getClient();
    const { data: existing } = await client
      .from('team_members')
      .select('team_id, teams!inner(type)')
      .eq('jira_account_id', jiraAccountId)
      .eq('teams.type', 'default');

    if (existing && existing.length > 0) return;

    const { data: team } = await client
      .from('teams')
      .insert({ name: `${displayName}'s Team`, type: 'default', created_by: userId })
      .select()
      .single();

    if (team) {
      await client.from('team_members').insert({
        team_id: team.id,
        jira_account_id: jiraAccountId,
        display_name: displayName,
        email,
        role: 'admin',
      });
    }
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
