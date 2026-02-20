import { useState } from 'react';
import { X, Plus, Trash2 } from 'lucide-react';
import { useI18n } from '../../hooks/useI18n';
import { useTeamStore } from './useTeamStore';

export default function SpotGroupForm() {
  const { t } = useI18n();
  const { teams, members, user, isLoading, createGroup, setView, fetchMembers } = useTeamStore();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([]);
  const [inviteEmails, setInviteEmails] = useState<string[]>([]);
  const [emailInput, setEmailInput] = useState('');
  const [loadedMembers, setLoadedMembers] = useState(false);

  // Load default team members for selection
  const defaultTeam = teams.find(te => te.type === 'default');
  if (defaultTeam && !loadedMembers) {
    fetchMembers(defaultTeam.id);
    setLoadedMembers(true);
  }

  const toggleMember = (userId: string) => {
    setSelectedMemberIds(prev =>
      prev.includes(userId) ? prev.filter(id => id !== userId) : [...prev, userId]
    );
  };

  const addEmail = () => {
    const trimmed = emailInput.trim();
    if (trimmed && trimmed.includes('@') && !inviteEmails.includes(trimmed)) {
      setInviteEmails([...inviteEmails, trimmed]);
      setEmailInput('');
    }
  };

  const handleEmailKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addEmail();
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    await createGroup({
      name: name.trim(),
      description: description.trim() || undefined,
      memberIds: selectedMemberIds,
      inviteEmails,
    });
  };

  const availableMembers = members.filter(m => m.userId !== user?.id);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-[var(--border)]">
        <button onClick={() => setView('list')} className="text-[var(--text-secondary)] hover:text-[var(--text)]">
          <X size={18} />
        </button>
        <span className="text-sm font-semibold text-[var(--text)]">{t('spotGroup.title')}</span>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-3 space-y-3">
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t('spotGroup.name')}
          required
          className="w-full px-3 py-2 text-sm bg-[var(--surface)] border border-[var(--border)] rounded-lg text-[var(--text)] placeholder:text-[var(--text-secondary)]/50"
        />
        <input
          type="text"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder={t('spotGroup.description')}
          className="w-full px-3 py-2 text-sm bg-[var(--surface)] border border-[var(--border)] rounded-lg text-[var(--text)] placeholder:text-[var(--text-secondary)]/50"
        />

        {/* Member selection */}
        {availableMembers.length > 0 && (
          <div>
            <p className="text-[11px] font-medium text-[var(--text-secondary)] mb-1">{t('spotGroup.selectMembers')}</p>
            <div className="space-y-1 max-h-32 overflow-y-auto">
              {availableMembers.map(m => (
                <label key={m.id} className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-[var(--surface)] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedMemberIds.includes(m.userId)}
                    onChange={() => toggleMember(m.userId)}
                    className="rounded"
                  />
                  <span className="text-sm text-[var(--text)]">{m.displayName ?? m.email}</span>
                </label>
              ))}
            </div>
          </div>
        )}

        {/* External invites */}
        <div>
          <p className="text-[11px] font-medium text-[var(--text-secondary)] mb-1">{t('spotGroup.inviteExternal')}</p>
          <div className="flex gap-2">
            <input
              type="email"
              value={emailInput}
              onChange={(e) => setEmailInput(e.target.value)}
              onKeyDown={handleEmailKeyDown}
              placeholder={t('spotGroup.emailPlaceholder')}
              className="flex-1 px-3 py-2 text-sm bg-[var(--surface)] border border-[var(--border)] rounded-lg text-[var(--text)] placeholder:text-[var(--text-secondary)]/50"
            />
            <button type="button" onClick={addEmail} className="px-2 text-[var(--primary)]">
              <Plus size={16} />
            </button>
          </div>
          {inviteEmails.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {inviteEmails.map((em, i) => (
                <span key={i} className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] bg-[var(--surface)] rounded-full text-[var(--text)]">
                  {em}
                  <button type="button" onClick={() => setInviteEmails(inviteEmails.filter((_, idx) => idx !== i))}>
                    <Trash2 size={10} className="text-[var(--text-secondary)]" />
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>

        <button
          type="submit"
          disabled={isLoading || !name.trim()}
          className="w-full py-2 text-sm font-medium bg-[var(--primary)] text-white rounded-lg hover:bg-[var(--primary-hover)] disabled:opacity-50 transition-colors"
        >
          {isLoading ? t('common.loading') : t('common.create')}
        </button>
      </form>
    </div>
  );
}
