import { create } from 'zustand';
import type { Todo, CreateTodoDto, UpdateTodoDto, TodoFilter } from '../../../shared/types/todo.types';

async function syncPersonalIfEnabled(): Promise<void> {
  try {
    const enabled = await window.electronAPI.settings.get('cloud_sync_enabled');
    if (enabled === 'true') {
      window.electronAPI.sync.pushPersonalTodos().catch(() => {});
    }
  } catch {}
}

interface TodoStore {
  todos: Todo[];
  filter: TodoFilter;
  isLoading: boolean;
  editingId: string | null;

  fetchTodos: () => Promise<void>;
  createTodo: (data: CreateTodoDto) => Promise<void>;
  updateTodo: (id: string, data: UpdateTodoDto) => Promise<void>;
  deleteTodo: (id: string) => Promise<void>;
  reorderTodos: (ids: string[]) => Promise<void>;
  setFilter: (filter: Partial<TodoFilter>) => void;
  setEditingId: (id: string | null) => void;
}

export const useTodoStore = create<TodoStore>((set, get) => ({
  todos: [],
  filter: { status: 'all' },
  isLoading: false,
  editingId: null,

  fetchTodos: async () => {
    set({ isLoading: true });
    try {
      const todos = await window.electronAPI.todo.getAll(get().filter);
      set({ todos });
    } finally {
      set({ isLoading: false });
    }
  },

  createTodo: async (data) => {
    await window.electronAPI.todo.create(data);
    await get().fetchTodos();
    if (!data.teamId) syncPersonalIfEnabled();
  },

  updateTodo: async (id, data) => {
    await window.electronAPI.todo.update(id, data);
    await get().fetchTodos();
    // Check if it's a personal todo (no teamId change to team)
    if (!data.teamId) syncPersonalIfEnabled();
  },

  deleteTodo: async (id) => {
    await window.electronAPI.todo.delete(id);
    await get().fetchTodos();
    syncPersonalIfEnabled();
  },

  reorderTodos: async (ids) => {
    await window.electronAPI.todo.reorder(ids);
    await get().fetchTodos();
    syncPersonalIfEnabled();
  },

  setFilter: (filter) => {
    set((state) => ({ filter: { ...state.filter, ...filter } }));
    get().fetchTodos();
  },

  setEditingId: (id) => set({ editingId: id }),
}));

// Listen for realtime todo updates from main process
window.electronAPI?.on('todo:updated', () => {
  useTodoStore.getState().fetchTodos();
});

// Listen for personal todo updates from cloud sync realtime
window.electronAPI?.on('personal:todo-updated', () => {
  // Pull latest from remote and refresh
  window.electronAPI.sync.pullPersonalTodos()
    .then(() => useTodoStore.getState().fetchTodos())
    .catch(() => {});
});
