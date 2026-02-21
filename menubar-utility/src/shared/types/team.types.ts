export interface Team {
  id: string;
  name: string;
  type: 'group';
  description: string;
  createdBy: string;
  isArchived: boolean;
  createdAt: string;
  archivedAt: string | null;
  memberCount?: number;
}

export interface TeamMember {
  id: string;
  teamId: string;
  jiraAccountId: string;
  role: 'admin' | 'member';
  joinedAt: string;
  displayName: string;
  email?: string;
  avatarUrl?: string;
}

export interface Invitation {
  id: string;
  teamId: string;
  invitedEmail: string;
  invitedBy: string;
  status: 'pending' | 'accepted' | 'declined';
  createdAt: string;
  expiresAt: string;
}

export interface CreateGroupDto {
  name: string;
  description?: string;
  memberIds?: string[];
  inviteEmails?: string[];
}

export interface AuthUser {
  id: string;
  email: string;
  displayName: string;
  avatarUrl: string | null;
  jiraAccountId?: string;
}

export interface SupabaseConfig {
  url: string;
  anonKey: string;
}
