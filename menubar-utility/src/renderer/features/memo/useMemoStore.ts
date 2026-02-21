import { create } from 'zustand';
import type { MemoFolder, Memo, CreateFolderDto, CreateMemoDto, UpdateMemoDto } from '../../../shared/types/memo.types';

async function syncFoldersIfEnabled(): Promise<void> {
  try {
    const enabled = await window.electronAPI.settings.get('cloud_sync_enabled');
    if (enabled === 'true') {
      window.electronAPI.sync.pushMemoFolders().catch(() => {});
    }
  } catch {}
}

async function syncMemosIfEnabled(): Promise<void> {
  try {
    const enabled = await window.electronAPI.settings.get('cloud_sync_enabled');
    if (enabled === 'true') {
      window.electronAPI.sync.pushMemos().catch(() => {});
    }
  } catch {}
}

interface MemoStore {
  folders: MemoFolder[];
  activeFolderId: string | null;
  activeMemoId: string | null;
  memos: Memo[];
  searchQuery: string;
  searchResults: Memo[];
  isLoading: boolean;

  fetchFolders: () => Promise<void>;
  createFolder: (data: CreateFolderDto) => Promise<void>;
  deleteFolder: (id: string) => Promise<void>;
  renameFolder: (id: string, name: string) => Promise<void>;
  toggleFolder: (id: string, isExpanded: boolean) => Promise<void>;
  setActiveFolderId: (id: string | null) => void;

  fetchMemos: (folderId: string) => Promise<void>;
  createMemo: (data: CreateMemoDto) => Promise<void>;
  updateMemo: (id: string, data: UpdateMemoDto) => Promise<void>;
  deleteMemo: (id: string) => Promise<void>;
  setActiveMemoId: (id: string | null) => void;

  reorderMemos: (ids: string[]) => Promise<void>;
  reorderFolders: (ids: string[]) => Promise<void>;

  search: (query: string) => Promise<void>;
  clearSearch: () => void;
}

export const useMemoStore = create<MemoStore>((set, get) => ({
  folders: [],
  activeFolderId: null,
  activeMemoId: null,
  memos: [],
  searchQuery: '',
  searchResults: [],
  isLoading: false,

  fetchFolders: async () => {
    const folders = await window.electronAPI.memo.getFolders();
    set({ folders });
  },

  createFolder: async (data) => {
    await window.electronAPI.memo.createFolder(data);
    await get().fetchFolders();
    syncFoldersIfEnabled();
  },

  deleteFolder: async (id) => {
    await window.electronAPI.memo.deleteFolder(id);
    const state = get();
    if (state.activeFolderId === id) {
      set({ activeFolderId: null, memos: [], activeMemoId: null });
    }
    await get().fetchFolders();
    syncFoldersIfEnabled();
    syncMemosIfEnabled();
  },

  renameFolder: async (id, name) => {
    await window.electronAPI.memo.updateFolder(id, { name });
    await get().fetchFolders();
    syncFoldersIfEnabled();
  },

  toggleFolder: async (id, isExpanded) => {
    await window.electronAPI.memo.updateFolder(id, { isExpanded });
    await get().fetchFolders();
    // No sync for UI-only state changes
  },

  setActiveFolderId: (id) => {
    set({ activeFolderId: id, activeMemoId: null });
    if (id) get().fetchMemos(id);
  },

  fetchMemos: async (folderId) => {
    const memos = await window.electronAPI.memo.getMemos(folderId);
    set({ memos });
  },

  createMemo: async (data) => {
    const memo = await window.electronAPI.memo.createMemo(data);
    set({ activeMemoId: memo.id });
    if (get().activeFolderId) await get().fetchMemos(get().activeFolderId!);
    syncMemosIfEnabled();
  },

  updateMemo: async (id, data) => {
    await window.electronAPI.memo.updateMemo(id, data);
    if (get().activeFolderId) await get().fetchMemos(get().activeFolderId!);
    syncMemosIfEnabled();
  },

  deleteMemo: async (id) => {
    await window.electronAPI.memo.deleteMemo(id);
    if (get().activeMemoId === id) set({ activeMemoId: null });
    if (get().activeFolderId) await get().fetchMemos(get().activeFolderId!);
    syncMemosIfEnabled();
  },

  setActiveMemoId: (id) => set({ activeMemoId: id }),

  reorderMemos: async (ids) => {
    await window.electronAPI.memo.reorderMemos(ids);
    if (get().activeFolderId) await get().fetchMemos(get().activeFolderId!);
    syncMemosIfEnabled();
  },

  reorderFolders: async (ids) => {
    await window.electronAPI.memo.reorderFolders(ids);
    await get().fetchFolders();
    syncFoldersIfEnabled();
  },

  search: async (query) => {
    set({ searchQuery: query });
    if (!query.trim()) {
      set({ searchResults: [] });
      return;
    }
    const results = await window.electronAPI.memo.search(query);
    set({ searchResults: results });
  },

  clearSearch: () => set({ searchQuery: '', searchResults: [] }),
}));

// Listen for personal memo folder updates from cloud sync realtime
window.electronAPI?.on('personal:folder-updated', () => {
  window.electronAPI.sync.pullMemoFolders()
    .then(() => useMemoStore.getState().fetchFolders())
    .catch(() => {});
});

// Listen for personal memo updates from cloud sync realtime
window.electronAPI?.on('personal:memo-updated', () => {
  window.electronAPI.sync.pullMemos()
    .then(() => {
      const state = useMemoStore.getState();
      if (state.activeFolderId) {
        state.fetchMemos(state.activeFolderId);
      }
    })
    .catch(() => {});
});
