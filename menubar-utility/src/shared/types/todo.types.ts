export interface Todo {
  id: string;
  title: string;
  description: string;
  status: 'todo' | 'in_progress' | 'done';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  dueDate: string | null;
  assigneeName: string;
  assigneeId: string | null;
  teamId: string | null;
  sortOrder: number;
  remoteId: string | null;
  syncedAt: string | null;
  isDirect: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateTodoDto {
  title: string;
  description?: string;
  priority?: Todo['priority'];
  dueDate?: string;
  assigneeName?: string;
  assigneeId?: string;
  teamId?: string;
}

export interface UpdateTodoDto {
  title?: string;
  description?: string;
  status?: Todo['status'];
  priority?: Todo['priority'];
  dueDate?: string | null;
  assigneeName?: string;
  assigneeId?: string | null;
  teamId?: string | null;
}

export interface SendDirectTodoDto {
  creatorJiraId: string;
  assigneeJiraId: string;
  title: string;
  description: string;
  priority: Todo['priority'];
  dueDate?: string;
}

export interface TodoFilter {
  status?: Todo['status'] | 'all';
}
