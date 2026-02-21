import { useState } from 'react';
import { X } from 'lucide-react';
import { useI18n } from '../../hooks/useI18n';
import { useTeamStore } from './useTeamStore';

export default function SpotGroupForm() {
  const { t } = useI18n();
  const { isLoading, createGroup, setView } = useTeamStore();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    await createGroup({
      name: name.trim(),
      description: description.trim() || undefined,
    });
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-[var(--border)]">
        <button onClick={() => setView('list')} className="text-[var(--text-secondary)] hover:text-[var(--text)]">
          <X size={18} />
        </button>
        <span className="text-sm font-semibold text-[var(--text)]">{t('group.title')}</span>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="flex-1 flex flex-col justify-center px-6 space-y-3">
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t('group.name')}
          required
          autoFocus
          className="w-full px-3 py-2 text-sm bg-[var(--surface)] border border-[var(--border)] rounded-lg text-[var(--text)] placeholder:text-[var(--text-secondary)]/50"
        />
        <input
          type="text"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder={t('group.description')}
          className="w-full px-3 py-2 text-sm bg-[var(--surface)] border border-[var(--border)] rounded-lg text-[var(--text)] placeholder:text-[var(--text-secondary)]/50"
        />
        <p className="text-[10px] text-[var(--text-secondary)]">{t('group.addMembersLater')}</p>
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
