import { useEffect, useRef, useState } from 'react';
import { Search, FolderPlus, FilePlus, GripVertical } from 'lucide-react';
import { useI18n } from '../../hooks/useI18n';
import { useMemoStore } from './useMemoStore';
import MemoTreeItem from './MemoTreeItem';
import MemoEditor from './MemoEditor';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
  DragOverlay,
} from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { Memo } from '../../../shared/types/memo.types';

function SortableMemoItem({ memo, onSelect, isSearchMatch }: { memo: Memo; onSelect: () => void; isSearchMatch?: boolean }) {
  const { t } = useI18n();
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: memo.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : undefined,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      onClick={onSelect}
      className={`group flex items-center gap-1 px-3 py-2 border-b border-[var(--border)] cursor-pointer hover:bg-[var(--surface)] ${isSearchMatch ? 'memo-search-match' : ''}`}
    >
      <div {...attributes} {...listeners} className="touch-none shrink-0">
        <GripVertical size={12} className="text-[var(--border)] opacity-0 group-hover:opacity-100 cursor-grab" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{memo.title}</p>
        <p className="text-[11px] text-[var(--text-secondary)] truncate">
          {memo.content.slice(0, 60) || t('memo.empty')}
        </p>
      </div>
    </div>
  );
}

export default function MemoTab() {
  const { t } = useI18n();
  const {
    folders, memos, activeFolderId, activeMemoId, searchQuery, searchResults,
    fetchFolders, createFolder, createMemo, setActiveMemoId, setActiveFolderId,
    reorderMemos, moveMemo, search, clearSearch,
  } = useMemoStore();
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [draggingMemoId, setDraggingMemoId] = useState<string | null>(null);

  useEffect(() => {
    fetchFolders();
  }, []);

  // Cmd+F focus search
  useEffect(() => {
    const handleFocusSearch = () => {
      searchInputRef.current?.focus();
    };
    window.addEventListener('app:focus-search', handleFocusSearch);
    return () => window.removeEventListener('app:focus-search', handleFocusSearch);
  }, []);

  useEffect(() => {
    const handleNewItem = () => {
      if (activeFolderId) {
        createMemo({ folderId: activeFolderId, title: 'Untitled' });
      } else {
        createFolder({ name: t('memo.newFolder') });
      }
    };
    window.addEventListener('app:new-item', handleNewItem);
    return () => window.removeEventListener('app:new-item', handleNewItem);
  }, [activeFolderId]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  );

  const handleDragStart = (event: DragStartEvent) => {
    const id = String(event.active.id);
    // Check if it's a memo being dragged
    if (memos.some(m => m.id === id)) {
      setDraggingMemoId(id);
    }
  };

  const handleMemoDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setDraggingMemoId(null);

    if (!over || active.id === over.id) return;

    const overId = String(over.id);

    // Check if dropped on a folder (cross-folder move)
    const targetFolder = folders.find(f => f.id === overId);
    if (targetFolder && draggingMemoId) {
      moveMemo(draggingMemoId, targetFolder.id);
      return;
    }

    // Same-folder reorder
    const oldIndex = memos.findIndex(m => m.id === active.id);
    const newIndex = memos.findIndex(m => m.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    const reordered = arrayMove(memos, oldIndex, newIndex);
    reorderMemos(reordered.map(m => m.id));
  };

  const rootFolders = folders.filter(f => f.parentId === null);
  const activeMemo = memos.find(m => m.id === activeMemoId);

  // Compute which folders have search matches
  const searchMatchFolderIds = new Set(searchResults.map(r => r.folderId));
  const searchMatchMemoIds = new Set(searchResults.map(r => r.id));

  const isSearchActive = searchQuery.trim().length > 0;

  return (
    <div className="flex flex-col h-full">
      {/* Search */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-[var(--border)]">
        <Search size={14} className="text-[var(--text-secondary)]" />
        <input
          ref={searchInputRef}
          value={searchQuery}
          onChange={(e) => e.target.value ? search(e.target.value) : clearSearch()}
          placeholder={t('memo.searchPlaceholder')}
          className="flex-1 text-sm bg-transparent outline-none"
        />
        {isSearchActive && (
          <span className="text-[10px] text-[var(--text-secondary)] whitespace-nowrap">
            {t('memo.searchResults', { count: searchResults.length })}
          </span>
        )}
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleMemoDragEnd}
      >
        <div className="flex flex-1 overflow-hidden">
          {/* Tree sidebar */}
          <div className="w-[40%] border-r border-[var(--border)] overflow-y-auto">
            <div className="flex items-center justify-between px-2 py-1.5 border-b border-[var(--border)]">
              <span className="text-[11px] font-medium text-[var(--text-secondary)]">{t('memo.folders')}</span>
              <button
                onClick={() => createFolder({ name: t('memo.newFolder') })}
                className="text-[var(--text-secondary)] hover:text-[var(--primary)]"
              >
                <FolderPlus size={14} />
              </button>
            </div>

            {rootFolders.length === 0 ? (
              <div className="p-3 text-[11px] text-[var(--text-secondary)] text-center">
                {t('memo.noFolders')}
              </div>
            ) : (
              rootFolders.map(folder => (
                <MemoTreeItem
                  key={folder.id}
                  folder={folder}
                  allFolders={folders}
                  depth={0}
                  isDraggingMemo={!!draggingMemoId}
                  searchMatchFolderIds={searchMatchFolderIds}
                />
              ))
            )}
          </div>

          {/* Content area */}
          <div className="w-[60%] flex flex-col overflow-hidden">
            {/* Search results view */}
            {isSearchActive && !activeMemoId && (
              <>
                <div className="flex items-center px-2 py-1.5 border-b border-[var(--border)]">
                  <span className="text-[11px] font-medium text-[var(--text-secondary)]">
                    {t('memo.searchResults', { count: searchResults.length })}
                  </span>
                </div>
                <div className="flex-1 overflow-y-auto">
                  {searchResults.map(memo => (
                    <div
                      key={memo.id}
                      onClick={() => {
                        setActiveFolderId(memo.folderId);
                        setActiveMemoId(memo.id);
                      }}
                      className="px-3 py-2 border-b border-[var(--border)] cursor-pointer hover:bg-[var(--surface)] memo-search-match"
                    >
                      <p className="text-sm font-medium truncate">{memo.title}</p>
                      <p className="text-[11px] text-[var(--text-secondary)] truncate">
                        {memo.content.slice(0, 80) || t('memo.empty')}
                      </p>
                    </div>
                  ))}
                </div>
              </>
            )}

            {/* Memo list in active folder (when not searching) */}
            {!isSearchActive && activeFolderId && !activeMemoId && (
              <>
                <div className="flex items-center justify-between px-2 py-1.5 border-b border-[var(--border)]">
                  <span className="text-[11px] font-medium text-[var(--text-secondary)]">
                    {t('memo.count', { count: memos.length })}
                  </span>
                  <button
                    onClick={() => createMemo({ folderId: activeFolderId, title: 'Untitled' })}
                    className="text-[var(--text-secondary)] hover:text-[var(--primary)]"
                  >
                    <FilePlus size={14} />
                  </button>
                </div>
                <div className="flex-1 overflow-y-auto">
                  <SortableContext items={memos.map(m => m.id)} strategy={verticalListSortingStrategy}>
                    {memos.map(memo => (
                      <SortableMemoItem
                        key={memo.id}
                        memo={memo}
                        onSelect={() => setActiveMemoId(memo.id)}
                        isSearchMatch={searchMatchMemoIds.has(memo.id)}
                      />
                    ))}
                  </SortableContext>
                </div>
              </>
            )}

            {activeMemo && <MemoEditor memo={activeMemo} />}

            {!activeFolderId && !activeMemoId && !isSearchActive && (
              <div className="flex items-center justify-center h-full text-[var(--text-secondary)] text-sm">
                {t('memo.selectFolder')}
              </div>
            )}
          </div>
        </div>

        <DragOverlay>
          {draggingMemoId && (() => {
            const memo = memos.find(m => m.id === draggingMemoId);
            if (!memo) return null;
            return (
              <div className="px-3 py-2 bg-[var(--bg)] border border-[var(--primary)] rounded shadow-lg opacity-80">
                <p className="text-sm font-medium truncate">{memo.title}</p>
              </div>
            );
          })()}
        </DragOverlay>
      </DndContext>
    </div>
  );
}
