import { useState } from 'react';
import { Send, X, AlertCircle, CheckCircle } from 'lucide-react';
import { useI18n } from '../../hooks/useI18n';
import { useTeamStore } from './useTeamStore';

export default function InviteDialog() {
  const { t } = useI18n();
  const { activeTeamId, invite, error, setView, clearError } = useTeamStore();
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [sending, setSending] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeTeamId || !email.trim()) return;

    setSending(true);
    clearError();
    try {
      await invite(activeTeamId, email.trim());
      setSent(true);
      setEmail('');
      setTimeout(() => setSent(false), 2000);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-[var(--border)]">
        <button onClick={() => setView('members')} className="text-[var(--text-secondary)] hover:text-[var(--text)]">
          <X size={18} />
        </button>
        <span className="text-sm font-semibold text-[var(--text)]">{t('invite.title')}</span>
      </div>

      {/* Content */}
      <div className="flex-1 flex flex-col items-center justify-center px-6">
        {error && (
          <div className="flex items-center gap-2 p-2 mb-3 w-full max-w-[280px] text-[11px] text-red-500 bg-red-500/10 rounded-lg">
            <AlertCircle size={14} />
            <span>{error}</span>
          </div>
        )}

        {sent && (
          <div className="flex items-center gap-2 p-2 mb-3 w-full max-w-[280px] text-[11px] text-green-600 bg-green-500/10 rounded-lg">
            <CheckCircle size={14} />
            <span>{t('invite.success')}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="w-full max-w-[280px] space-y-3">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={t('invite.email')}
            required
            className="w-full px-3 py-2 text-sm bg-[var(--surface)] border border-[var(--border)] rounded-lg text-[var(--text)] placeholder:text-[var(--text-secondary)]/50"
          />
          <button
            type="submit"
            disabled={sending}
            className="w-full flex items-center justify-center gap-2 py-2 text-sm font-medium bg-[var(--primary)] text-white rounded-lg hover:bg-[var(--primary-hover)] disabled:opacity-50 transition-colors"
          >
            <Send size={14} />
            {sending ? t('common.loading') : t('invite.send')}
          </button>
        </form>
      </div>
    </div>
  );
}
