import { useState } from 'react';
import { Users, FolderPlus, ChevronDown, ChevronRight, Archive, LogOut } from 'lucide-react';
import { useI18n } from '../../hooks/useI18n';
import { useTeamStore } from './useTeamStore';
import type { Team } from '../../../shared/types/team.types';

export default function TeamList() {
  const { t } = useI18n();
  const { teams, user, signOut, setActiveTeam, setView } = useTeamStore();
  const [showArchived, setShowArchived] = useState(false);

  const activeGroups = teams.filter(t => !t.isArchived);
  const archivedGroups = teams.filter(t => t.isArchived);

  const TeamItem = ({ team }: { team: Team }) => (
    <button
      onClick={() => setActiveTeam(team.id)}
      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-[var(--surface)] transition-colors text-left"
    >
      <div className="w-8 h-8 rounded-full bg-[var(--primary)]/10 flex items-center justify-center text-[var(--primary)]">
        <Users size={14} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-[var(--text)] truncate">{team.name}</p>
        <p className="text-[11px] text-[var(--text-secondary)]">
          {t('team.members', { count: team.memberCount ?? 0 })}
        </p>
      </div>
    </button>
  );

  return (
    <div className="flex flex-col h-full">
      {/* User header */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-[var(--border)]">
        <div className="w-7 h-7 rounded-full bg-[var(--primary)]/20 flex items-center justify-center text-[10px] font-bold text-[var(--primary)]">
          {user?.displayName?.charAt(0).toUpperCase() ?? '?'}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[12px] font-medium text-[var(--text)] truncate">{user?.displayName}</p>
          <p className="text-[10px] text-[var(--text-secondary)] truncate">{user?.email}</p>
        </div>
        <button onClick={signOut} className="text-[var(--text-secondary)] hover:text-red-500 transition-colors" title={t('auth.signOut')}>
          <LogOut size={14} />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-2 space-y-3">
        {/* Groups */}
        <div>
          <div className="flex items-center justify-between px-2 mb-1">
            <p className="text-[10px] font-medium text-[var(--text-secondary)] uppercase tracking-wide">
              {t('team.groups')}
            </p>
            <button
              onClick={() => setView('createGroup')}
              className="text-[var(--primary)] hover:bg-[var(--primary)]/10 rounded p-0.5 transition-colors"
            >
              <FolderPlus size={14} />
            </button>
          </div>
          {activeGroups.length === 0 ? (
            <p className="text-[11px] text-[var(--text-secondary)] px-3 py-2">{t('team.description')}</p>
          ) : (
            activeGroups.map(g => <TeamItem key={g.id} team={g} />)
          )}
        </div>

        {/* Archived */}
        {archivedGroups.length > 0 && (
          <div>
            <button
              onClick={() => setShowArchived(!showArchived)}
              className="flex items-center gap-1 px-2 mb-1 text-[10px] font-medium text-[var(--text-secondary)] uppercase tracking-wide"
            >
              {showArchived ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
              {t('team.archived')} ({archivedGroups.length})
            </button>
            {showArchived && archivedGroups.map(g => (
              <div key={g.id} className="opacity-50">
                <TeamItem team={g} />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
