import { useState, useEffect, useRef } from 'react';
import { X, Users, User, ChevronDown, Search } from 'lucide-react';
import { useI18n } from '../hooks/useI18n';
import type { Team, TeamMember } from '../../shared/types/team.types';

export interface SelectedAssignee {
  jiraAccountId: string;
  displayName: string;
  avatarUrl?: string;
}

interface AssigneeSelectorProps {
  mode: 'single' | 'multi';
  selected: SelectedAssignee[];
  onChange: (assignees: SelectedAssignee[]) => void;
  placeholder?: string;
}

interface TeamWithMembers {
  team: Team;
  members: TeamMember[];
}

export default function AssigneeSelector({ mode, selected, onChange, placeholder }: AssigneeSelectorProps) {
  const { t } = useI18n();
  const [teamData, setTeamData] = useState<TeamWithMembers[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [fallbackName, setFallbackName] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    (async () => {
      try {
        const teams = await window.electronAPI.team.getMyTeams();
        const results = await Promise.all(
          teams.filter(t => !t.isArchived).map(async (team) => {
            const members = await window.electronAPI.team.getMembers(team.id);
            return { team, members };
          })
        );
        setTeamData(results);
        setLoadFailed(false);
      } catch {
        setLoadFailed(true);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handle = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, [open]);

  const isSelected = (accountId: string) =>
    selected.some(s => s.jiraAccountId === accountId);

  const toggleMember = (member: TeamMember) => {
    if (mode === 'single') {
      onChange([{ jiraAccountId: member.jiraAccountId, displayName: member.displayName, avatarUrl: member.avatarUrl }]);
      setOpen(false);
      return;
    }
    if (isSelected(member.jiraAccountId)) {
      onChange(selected.filter(s => s.jiraAccountId !== member.jiraAccountId));
    } else {
      onChange([...selected, { jiraAccountId: member.jiraAccountId, displayName: member.displayName, avatarUrl: member.avatarUrl }]);
    }
  };

  const selectGroup = (members: TeamMember[]) => {
    if (mode === 'single') return;
    const allSelected = members.every(m => isSelected(m.jiraAccountId));
    if (allSelected) {
      const ids = new Set(members.map(m => m.jiraAccountId));
      onChange(selected.filter(s => !ids.has(s.jiraAccountId)));
    } else {
      const existing = new Map(selected.map(s => [s.jiraAccountId, s]));
      for (const m of members) {
        if (!existing.has(m.jiraAccountId)) {
          existing.set(m.jiraAccountId, { jiraAccountId: m.jiraAccountId, displayName: m.displayName, avatarUrl: m.avatarUrl });
        }
      }
      onChange(Array.from(existing.values()));
    }
  };

  const removeAssignee = (accountId: string) => {
    onChange(selected.filter(s => s.jiraAccountId !== accountId));
  };

  const getInitials = (name: string) => {
    const parts = name.split(/\s+/);
    return parts.length >= 2
      ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
      : name.slice(0, 2).toUpperCase();
  };

  const filterMembers = (members: TeamMember[]) => {
    if (!search) return members;
    const q = search.toLowerCase();
    return members.filter(m => m.displayName.toLowerCase().includes(q));
  };

  // Fallback: text input when team data can't load
  if (loadFailed && !loading) {
    return (
      <div>
        <label className="text-[10px] text-[var(--text-secondary)]">{t('todo.assignee')}</label>
        <div className="relative mt-0.5">
          <User size={14} className="absolute left-2 top-1/2 -translate-y-1/2 text-[var(--text-secondary)]" />
          <input
            type="text"
            value={selected[0]?.displayName ?? fallbackName}
            onChange={(e) => {
              setFallbackName(e.target.value);
              onChange(e.target.value ? [{ jiraAccountId: '', displayName: e.target.value }] : []);
            }}
            placeholder={placeholder ?? t('todo.assigneePlaceholder')}
            className="w-full pl-7 pr-2.5 py-1.5 text-sm bg-[var(--surface)] border border-[var(--border)] rounded-md"
          />
        </div>
      </div>
    );
  }

  return (
    <div className="relative" ref={containerRef}>
      <label className="text-[10px] text-[var(--text-secondary)]">{t('todo.assignee')}</label>

      {/* Selected chips + trigger */}
      <button
        type="button"
        onClick={() => !loading && setOpen(!open)}
        className="w-full mt-0.5 flex items-center gap-1 flex-wrap min-h-[34px] px-2 py-1 text-sm bg-[var(--surface)] border border-[var(--border)] rounded-md text-left"
      >
        {selected.length === 0 ? (
          <span className="text-[var(--text-secondary)] text-[12px]">
            {loading ? t('common.loading') : (placeholder ?? t('todo.assigneePlaceholder'))}
          </span>
        ) : (
          selected.map(a => (
            <span
              key={a.jiraAccountId || a.displayName}
              className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-[var(--primary)]/10 text-[var(--primary)] rounded text-[11px]"
            >
              <span className="w-4 h-4 rounded-full bg-[var(--primary)]/20 flex items-center justify-center text-[8px] font-bold">
                {getInitials(a.displayName)}
              </span>
              {a.displayName}
              <span
                role="button"
                onClick={(e) => { e.stopPropagation(); removeAssignee(a.jiraAccountId); }}
                className="hover:text-[var(--danger)] cursor-pointer"
              >
                <X size={10} />
              </span>
            </span>
          ))
        )}
        <ChevronDown size={14} className="ml-auto shrink-0 text-[var(--text-secondary)]" />
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute left-0 right-0 top-full mt-0.5 z-30 bg-[var(--bg)] border border-[var(--border)] rounded-md shadow-lg max-h-48 overflow-y-auto">
          {/* Search */}
          <div className="sticky top-0 bg-[var(--bg)] border-b border-[var(--border)] px-2 py-1.5 flex items-center gap-1.5">
            <Search size={12} className="text-[var(--text-secondary)]" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t('assignee.searchPlaceholder')}
              autoFocus
              className="flex-1 text-[12px] bg-transparent outline-none"
            />
          </div>

          {/* Selected count */}
          {mode === 'multi' && selected.length > 0 && (
            <div className="px-3 py-1 text-[10px] text-[var(--text-secondary)] border-b border-[var(--border)]">
              {t('assignee.selectedCount', { count: selected.length })}
            </div>
          )}

          {/* Teams */}
          {teamData.map(({ team, members }) => {
            const filtered = filterMembers(members);
            if (filtered.length === 0) return null;
            const allInGroupSelected = filtered.every(m => isSelected(m.jiraAccountId));

            return (
              <div key={team.id}>
                {/* Group header */}
                <button
                  type="button"
                  onClick={() => selectGroup(filtered)}
                  className={`w-full flex items-center gap-2 px-3 py-1.5 text-[11px] font-semibold hover:bg-[var(--surface)] text-left ${
                    mode === 'single' ? 'cursor-default' : ''
                  }`}
                  disabled={mode === 'single'}
                >
                  <Users size={12} className="text-[var(--text-secondary)]" />
                  <span className="flex-1">{team.name}</span>
                  {mode === 'multi' && (
                    <span className="text-[10px] text-[var(--primary)]">
                      {allInGroupSelected ? '- ' + t('assignee.selectAll') : '+ ' + t('assignee.selectAll')}
                    </span>
                  )}
                </button>

                {/* Members */}
                {filtered.map(member => (
                  <button
                    key={member.id}
                    type="button"
                    onClick={() => toggleMember(member)}
                    className={`w-full flex items-center gap-2 pl-7 pr-3 py-1.5 text-[12px] hover:bg-[var(--surface)] text-left ${
                      isSelected(member.jiraAccountId) ? 'bg-[var(--primary)]/5' : ''
                    }`}
                  >
                    <span className="w-5 h-5 rounded-full bg-[var(--primary)]/20 flex items-center justify-center text-[9px] font-bold text-[var(--primary)]">
                      {getInitials(member.displayName)}
                    </span>
                    <span className="flex-1">{member.displayName}</span>
                    {isSelected(member.jiraAccountId) && (
                      <span className="text-[var(--primary)] text-[10px]">✓</span>
                    )}
                  </button>
                ))}
              </div>
            );
          })}

          {teamData.length === 0 && !loading && (
            <p className="px-3 py-2 text-[12px] text-[var(--text-secondary)]">
              {t('team.noMembers')}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
