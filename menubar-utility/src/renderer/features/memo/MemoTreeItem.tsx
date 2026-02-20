import { useState, useEffect, useRef } from 'react';
import { ChevronRight, ChevronDown, Folder, FolderOpen, MoreHorizontal, Trash2, Pencil } from 'lucide-react';
import { cn } from '../../lib/utils';
import { useMemoStore } from './useMemoStore';
import { useI18n } from '../../hooks/useI18n';
import type { MemoFolder } from '../../../shared/types/memo.types';
import ConfirmDialog from '../../components/ConfirmDialog';

interface MemoTreeItemProps {
  folder: MemoFolder;
  allFolders: MemoFolder[];
  depth: number;
}

export default function MemoTreeItem({ folder, allFolders, depth }: MemoTreeItemProps) {
  const { activeFolderId, setActiveFolderId, toggleFolder, renameFolder, deleteFolder, createFolder } = useMemoStore();
  const { t } = useI18n();
  const [showMenu, setShowMenu] = useState(false);
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState(folder.name);
  const [showConfirm, setShowConfirm] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const children = allFolders.filter(f => f.parentId === folder.id);
  const isActive = activeFolderId === folder.id;
  const isExpanded = folder.isExpanded;

  // Close menu on outside click
  useEffect(() => {
    if (!showMenu) return;
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [showMenu]);

  const handleToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    toggleFolder(folder.id, !isExpanded);
  };

  const handleRename = () => {
    if (renameValue.trim() && renameValue !== folder.name) {
      renameFolder(folder.id, renameValue.trim());
    }
    setIsRenaming(false);
  };

  const startRename = () => {
    setRenameValue(folder.name);
    setIsRenaming(true);
  };

  const handleDoubleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    startRename();
  };

  return (
    <div>
      <div
        onClick={() => setActiveFolderId(folder.id)}
        onDoubleClick={handleDoubleClick}
        className={cn(
          'group flex items-center gap-1 px-2 py-1 rounded cursor-pointer text-[12px]',
          'hover:bg-[var(--surface)]',
          isActive && 'bg-[var(--primary)]/10 text-[var(--primary)]'
        )}
        style={{ paddingLeft: `${depth * 16 + 8}px` }}
      >
        {children.length > 0 ? (
          <button onClick={handleToggle} className="shrink-0">
            {isExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
          </button>
        ) : (
          <span className="w-3" />
        )}

        {isExpanded ? <FolderOpen size={14} /> : <Folder size={14} />}

        {isRenaming ? (
          <input
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            onBlur={handleRename}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleRename();
              if (e.key === 'Escape') { setRenameValue(folder.name); setIsRenaming(false); }
            }}
            autoFocus
            className="flex-1 px-1 text-[12px] bg-[var(--surface)] border border-[var(--primary)] rounded outline-none"
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <span className="flex-1 truncate">{folder.name}</span>
        )}

        <div className="relative" ref={menuRef}>
          <button
            onClick={(e) => { e.stopPropagation(); setShowMenu(!showMenu); }}
            className="opacity-0 group-hover:opacity-100 text-[var(--text-secondary)] hover:text-[var(--text)]"
          >
            <MoreHorizontal size={14} />
          </button>

          {showMenu && (
            <div className="absolute right-0 top-5 z-20 bg-[var(--bg)] border border-[var(--border)] rounded-md shadow-lg py-1 min-w-[120px]">
              <button
                onClick={(e) => { e.stopPropagation(); createFolder({ parentId: folder.id, name: t('memo.newFolder') }); setShowMenu(false); }}
                className="w-full flex items-center gap-2 px-3 py-1.5 text-[11px] hover:bg-[var(--surface)]"
              >
                <Folder size={12} /> {t('memo.subFolder')}
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); startRename(); setShowMenu(false); }}
                className="w-full flex items-center gap-2 px-3 py-1.5 text-[11px] hover:bg-[var(--surface)]"
              >
                <Pencil size={12} /> {t('memo.rename')}
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); setShowConfirm(true); setShowMenu(false); }}
                className="w-full flex items-center gap-2 px-3 py-1.5 text-[11px] text-[var(--danger)] hover:bg-[var(--surface)]"
              >
                <Trash2 size={12} /> {t('memo.delete')}
              </button>
            </div>
          )}
        </div>
      </div>

      {isExpanded && children.map(child => (
        <MemoTreeItem key={child.id} folder={child} allFolders={allFolders} depth={depth + 1} />
      ))}

      {showConfirm && (
        <ConfirmDialog
          onConfirm={() => { deleteFolder(folder.id); setShowConfirm(false); }}
          onCancel={() => setShowConfirm(false)}
        />
      )}
    </div>
  );
}
