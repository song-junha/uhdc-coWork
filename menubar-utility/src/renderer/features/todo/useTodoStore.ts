import { create } from 'zustand';
import type { Todo, CreateTodoDto, UpdateTodoDto, TodoFilter } from '../../../shared/types/todo.types';

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
  filter: { scope: 'personal', status: 'all' },
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
  },

  updateTodo: async (id, data) => {
    await window.electronAPI.todo.update(id, data);
    await get().fetchTodos();
  },

  deleteTodo: async (id) => {
    await window.electronAPI.todo.delete(id);
    await get().fetchTodos();
  },

  reorderTodos: async (ids) => {
    await window.electronAPI.todo.reorder(ids);
    await get().fetchTodos();
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
