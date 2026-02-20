import { ChevronLeft, UserPlus, UserMinus, Archive } from 'lucide-react';
import { useI18n } from '../../hooks/useI18n';
import { useTeamStore } from './useTeamStore';

export default function MemberList() {
  const { t } = useI18n();
  const { teams, activeTeamId, members, user, removeMember, archiveGroup, setView } = useTeamStore();

  const team = teams.find(te => te.id === activeTeamId);
  if (!team) return null;

  const isAdmin = members.some(m => m.userId === user?.id && m.role === 'admin');

  const handleRemove = async (userId: string) => {
    if (!activeTeamId || !confirm(t('team.removeConfirm'))) return;
    await removeMember(activeTeamId, userId);
  };

  const handleArchive = async () => {
    if (!activeTeamId || !confirm(t('team.archiveConfirm'))) return;
    await archiveGroup(activeTeamId);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-[var(--border)]">
        <button onClick={() => setView('list')} className="text-[var(--text-secondary)] hover:text-[var(--text)]">
          <ChevronLeft size={18} />
        </button>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-[var(--text)] truncate">{team.name}</p>
          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[var(--primary)]/10 text-[var(--primary)]">
            {team.type === 'default' ? t('team.defaultTeam') : 'Spot'}
          </span>
        </div>
        {isAdmin && team.type === 'spot' && (
          <button onClick={handleArchive} className="text-[var(--text-secondary)] hover:text-orange-500 transition-colors" title={t('team.archive')}>
            <Archive size={14} />
          </button>
        )}
      </div>

      {/* Members */}
      <div className="flex-1 overflow-y-auto p-2">
        {members.length === 0 ? (
          <p className="text-[11px] text-[var(--text-secondary)] text-center py-4">{t('team.noMembers')}</p>
        ) : (
          members.map(member => (
            <div key={member.id} className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-[var(--surface)] transition-colors">
              <div className="w-7 h-7 rounded-full bg-[var(--primary)]/10 flex items-center justify-center text-[10px] font-bold text-[var(--primary)]">
                {(member.displayName ?? member.email ?? '?').charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-[var(--text)] truncate">{member.displayName ?? member.email}</p>
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                  member.role === 'admin'
                    ? 'bg-amber-500/10 text-amber-600'
                    : 'bg-gray-500/10 text-[var(--text-secondary)]'
                }`}>
                  {t(member.role === 'admin' ? 'team.role.admin' : 'team.role.member')}
                </span>
              </div>
              {isAdmin && member.userId !== user?.id && (
                <button
                  onClick={() => handleRemove(member.userId)}
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

      {/* Invite button */}
      {isAdmin && (
        <div className="px-3 py-2 border-t border-[var(--border)]">
          <button
            onClick={() => setView('invite')}
            className="w-full flex items-center justify-center gap-2 py-2 text-sm font-medium bg-[var(--primary)] text-white rounded-lg hover:bg-[var(--primary-hover)] transition-colors"
          >
            <UserPlus size={14} />
            {t('team.inviteMembers')}
          </button>
        </div>
      )}
    </div>
  );
}
