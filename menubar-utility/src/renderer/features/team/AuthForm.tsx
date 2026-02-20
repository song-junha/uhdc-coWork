import { useState } from 'react';
import { LogIn, UserPlus, AlertCircle } from 'lucide-react';
import { useI18n } from '../../hooks/useI18n';
import { useTeamStore } from './useTeamStore';

export default function AuthForm() {
  const { t } = useI18n();
  const { signIn, signUp, isLoading, error, clearError } = useTeamStore();
  const [mode, setMode] = useState<'signIn' | 'signUp'>('signIn');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (mode === 'signIn') {
        await signIn(email, password);
      } else {
        await signUp(email, password, displayName);
      }
    } catch {
      // error is set in store
    }
  };

  const toggleMode = () => {
    setMode(mode === 'signIn' ? 'signUp' : 'signIn');
    clearError();
  };

  return (
    <div className="flex flex-col items-center justify-center h-full px-6">
      <div className="w-full max-w-[280px]">
        <div className="flex items-center justify-center gap-2 mb-4">
          {mode === 'signIn' ? <LogIn size={20} /> : <UserPlus size={20} />}
          <h3 className="text-sm font-semibold text-[var(--text)]">
            {t(mode === 'signIn' ? 'auth.signIn' : 'auth.signUp')}
          </h3>
        </div>

        {error && (
          <div className="flex items-center gap-2 p-2 mb-3 text-[11px] text-red-500 bg-red-500/10 rounded-lg">
            <AlertCircle size={14} />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3">
          {mode === 'signUp' && (
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder={t('auth.displayName')}
              required
              className="w-full px-3 py-2 text-sm bg-[var(--surface)] border border-[var(--border)] rounded-lg text-[var(--text)] placeholder:text-[var(--text-secondary)]/50"
            />
          )}
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={t('auth.email')}
            required
            className="w-full px-3 py-2 text-sm bg-[var(--surface)] border border-[var(--border)] rounded-lg text-[var(--text)] placeholder:text-[var(--text-secondary)]/50"
          />
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={t('auth.password')}
            required
            minLength={6}
            className="w-full px-3 py-2 text-sm bg-[var(--surface)] border border-[var(--border)] rounded-lg text-[var(--text)] placeholder:text-[var(--text-secondary)]/50"
          />
          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-2 text-sm font-medium bg-[var(--primary)] text-white rounded-lg hover:bg-[var(--primary-hover)] disabled:opacity-50 transition-colors"
          >
            {isLoading ? t('common.loading') : t(mode === 'signIn' ? 'auth.signIn' : 'auth.signUp')}
          </button>
        </form>

        <button
          onClick={toggleMode}
          className="w-full mt-3 text-[11px] text-[var(--primary)] hover:underline"
        >
          {t(mode === 'signIn' ? 'auth.switchToSignUp' : 'auth.switchToSignIn')}
        </button>
      </div>
    </div>
  );
}
