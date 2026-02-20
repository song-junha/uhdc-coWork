import { useState, useEffect, useRef } from 'react';
import { ChevronLeft, Search, UserPlus, CheckCircle } from 'lucide-react';
import { useI18n } from '../../hooks/useI18n';
import { useTeamStore } from './useTeamStore';
import type { JiraUser } from '../../../shared/types/jira.types';

export default function AddMemberDialog() {
  const { t } = useI18n();
  const { activeTeamId, addMember, error, setView, clearError } = useTeamStore();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<JiraUser[]>([]);
  const [searching, setSearching] = useState(false);
  const [added, setAdded] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    clearError();
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (query.trim().length < 2) {
      setResults([]);
      return;
    }

    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const users = await window.electronAPI.jira.searchUsers(query.trim());
        setResults(users);
      } catch {
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, 300);

    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query]);

  const handleAdd = async (user: JiraUser) => {
    if (!activeTeamId) return;
    clearError();
    await addMember(activeTeamId, user.accountId, user.displayName, user.emailAddress ?? '');
    setAdded(user.accountId);
    setTimeout(() => setAdded(null), 1500);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-[var(--border)]">
        <button onClick={() => setView('members')} className="text-[var(--text-secondary)] hover:text-[var(--text)]">
          <ChevronLeft size={18} />
        </button>
        <span className="text-sm font-semibold text-[var(--text)]">{t('team.addMember')}</span>
      </div>

      {/* Search */}
      <div className="px-3 pt-3 pb-2">
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-secondary)]" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('team.searchJiraUser')}
            autoFocus
            className="w-full pl-8 pr-3 py-2 text-sm bg-[var(--surface)] border border-[var(--border)] rounded-lg text-[var(--text)] placeholder:text-[var(--text-secondary)]/50"
          />
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="px-3 pb-2">
          <p className="text-[11px] text-red-500 bg-red-500/10 rounded-lg px-2 py-1">{error}</p>
        </div>
      )}

      {/* Results */}
      <div className="flex-1 overflow-y-auto px-2">
        {searching && (
          <p className="text-[11px] text-[var(--text-secondary)] text-center py-3">{t('common.loading')}</p>
        )}

        {!searching && query.length >= 2 && results.length === 0 && (
          <p className="text-[11px] text-[var(--text-secondary)] text-center py-3">{t('team.noResults')}</p>
        )}

        {results.map(user => (
          <div
            key={user.accountId}
            className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-[var(--surface)] transition-colors"
          >
            {user.avatarUrl ? (
              <img src={user.avatarUrl} alt="" className="w-7 h-7 rounded-full" />
            ) : (
              <div className="w-7 h-7 rounded-full bg-[var(--primary)]/10 flex items-center justify-center text-[10px] font-bold text-[var(--primary)]">
                {user.displayName.charAt(0).toUpperCase()}
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-sm text-[var(--text)] truncate">{user.displayName}</p>
              {user.emailAddress && (
                <p className="text-[10px] text-[var(--text-secondary)] truncate">{user.emailAddress}</p>
              )}
            </div>
            {added === user.accountId ? (
              <CheckCircle size={16} className="text-green-500" />
            ) : (
              <button
                onClick={() => handleAdd(user)}
                className="text-[var(--primary)] hover:bg-[var(--primary)]/10 rounded p-1 transition-colors"
                title={t('team.addMember')}
              >
                <UserPlus size={16} />
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
