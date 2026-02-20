import { useState, useRef, useEffect } from 'react';
import { ChevronLeft, UserPlus, UserMinus, Trash2, Pencil, Check, X } from 'lucide-react';
import { useI18n } from '../../hooks/useI18n';
import { useTeamStore } from './useTeamStore';

export default function MemberList() {
  const { t } = useI18n();
  const { teams, activeTeamId, members, user, removeMember, deleteGroup, renameGroup, setView } = useTeamStore();
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const team = teams.find(te => te.id === activeTeamId);
  if (!team) return null;

  const isAdmin = members.some(m => m.jiraAccountId === user?.jiraAccountId && m.role === 'admin');

  const handleRemove = async (memberId: string) => {
    if (!activeTeamId || !confirm(t('team.removeConfirm'))) return;
    await removeMember(activeTeamId, memberId);
  };

  const handleDelete = async () => {
    if (!activeTeamId || !confirm(t('team.deleteConfirm'))) return;
    await deleteGroup(activeTeamId);
  };

  const startRename = () => {
    setEditName(team.name);
    setEditing(true);
  };

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing]);

  const confirmRename = async () => {
    if (!activeTeamId || !editName.trim() || editName.trim() === team.name) {
      setEditing(false);
      return;
    }
    await renameGroup(activeTeamId, editName.trim());
    setEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') confirmRename();
    if (e.key === 'Escape') setEditing(false);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-[var(--border)]">
        <button onClick={() => setView('list')} className="text-[var(--text-secondary)] hover:text-[var(--text)]">
          <ChevronLeft size={18} />
        </button>
        <div className="flex-1 min-w-0">
          {editing ? (
            <div className="flex items-center gap-1">
              <input
                ref={inputRef}
                type="text"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                onKeyDown={handleKeyDown}
                onBlur={() => setEditing(false)}
                className="flex-1 px-2 py-0.5 text-sm bg-[var(--surface)] border border-[var(--primary)] rounded text-[var(--text)] outline-none"
              />
              <button onMouseDown={confirmRename} className="text-green-500 p-0.5"><Check size={14} /></button>
              <button onMouseDown={() => setEditing(false)} className="text-[var(--text-secondary)] p-0.5"><X size={14} /></button>
            </div>
          ) : (
            <>
              <p className="text-sm font-medium text-[var(--text)] truncate">{team.name}</p>
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[var(--primary)]/10 text-[var(--primary)]">
                {team.type === 'default' ? t('team.defaultTeam') : 'Spot'}
              </span>
            </>
          )}
        </div>
        {isAdmin && team.type === 'spot' && !editing && (
          <div className="flex items-center gap-1">
            <button onClick={startRename} className="text-[var(--text-secondary)] hover:text-[var(--primary)] transition-colors p-1" title={t('team.renameGroup')}>
              <Pencil size={13} />
            </button>
            <button onClick={handleDelete} className="text-[var(--text-secondary)] hover:text-red-500 transition-colors p-1" title={t('team.deleteGroup')}>
              <Trash2 size={13} />
            </button>
          </div>
        )}
      </div>

      {/* Members */}
      <div className="flex-1 overflow-y-auto p-2">
        {members.length === 0 ? (
          <p className="text-[11px] text-[var(--text-secondary)] text-center py-4">{t('team.noMembers')}</p>
        ) : (
          members.map(member => (
            <div key={member.id} className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-[var(--surface)] transition-colors">
              {member.avatarUrl ? (
                <img src={member.avatarUrl} alt="" className="w-7 h-7 rounded-full" />
              ) : (
                <div className="w-7 h-7 rounded-full bg-[var(--primary)]/10 flex items-center justify-center text-[10px] font-bold text-[var(--primary)]">
                  {member.displayName.charAt(0).toUpperCase()}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm text-[var(--text)] truncate">{member.displayName}</p>
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                  member.role === 'admin'
                    ? 'bg-amber-500/10 text-amber-600'
                    : 'bg-gray-500/10 text-[var(--text-secondary)]'
                }`}>
                  {t(member.role === 'admin' ? 'team.role.admin' : 'team.role.member')}
                </span>
              </div>
              {isAdmin && member.jiraAccountId !== user?.jiraAccountId && (
                <button
                  onClick={() => handleRemove(member.id)}
                  className="text-[var(--text-secondary)] hover:text-red-500 transition-colors"
                  title={t('team.remove')}
                >
                  <UserMinus size={14} />
                </button>
              )}
            </div>
          ))
        )}
      </div>

      {/* Add member button */}
      {isAdmin && (
        <div className="px-3 py-2 border-t border-[var(--border)]">
          <button
            onClick={() => setView('invite')}
            className="w-full flex items-center justify-center gap-2 py-2 text-sm font-medium bg-[var(--primary)] text-white rounded-lg hover:bg-[var(--primary-hover)] transition-colors"
          >
            <UserPlus size={14} />
            {t('team.addMember')}
          </button>
        </div>
      )}
    </div>
  );
}
