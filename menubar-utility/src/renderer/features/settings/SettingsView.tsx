import { useEffect, useState } from 'react';
import { ChevronLeft, Globe, Palette, Database } from 'lucide-react';
import { useI18n } from '../../hooks/useI18n';
import { useTheme } from '../../hooks/useTheme';
import { localeNames, type Locale } from '../../../shared/i18n';

interface SettingsViewProps {
  onClose: () => void;
}

export default function SettingsView({ onClose }: SettingsViewProps) {
  const { t, locale, setLocale } = useI18n();
  const { theme, setTheme } = useTheme();
  const [supabaseUrl, setSupabaseUrl] = useState('');
  const [supabaseKey, setSupabaseKey] = useState('');
  const [supabaseStatus, setSupabaseStatus] = useState<'connected' | 'disconnected'>('disconnected');

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  useEffect(() => {
    (async () => {
      const url = await window.electronAPI.settings.get('supabase_url');
      const key = await window.electronAPI.settings.get('supabase_anon_key');
      setSupabaseUrl(url ?? '');
      setSupabaseKey(key ?? '');
      setSupabaseStatus(url && key ? 'connected' : 'disconnected');
    })();
  }, []);

  const saveSupabaseConfig = async () => {
    await window.electronAPI.settings.set('supabase_url', supabaseUrl.trim());
    await window.electronAPI.settings.set('supabase_anon_key', supabaseKey.trim());
    setSupabaseStatus(supabaseUrl.trim() && supabaseKey.trim() ? 'connected' : 'disconnected');
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 px-3 py-2 border-b border-[var(--border)] bg-[var(--surface)]">
        <button onClick={onClose} className="text-[var(--text-secondary)] hover:text-[var(--text)]">
          <ChevronLeft size={18} />
        </button>
        <span className="text-sm font-semibold">{t('settings.title')}</span>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-4">
        {/* Language */}
        <div>
          <label className="flex items-center gap-2 text-[11px] font-medium text-[var(--text-secondary)] mb-2">
            <Globe size={14} />
            {t('settings.language')}
          </label>
          <div className="flex gap-2">
            {(Object.entries(localeNames) as [Locale, string][]).map(([key, name]) => (
              <button
                key={key}
                onClick={() => setLocale(key)}
                className={`flex-1 py-2 text-sm rounded-lg border transition-colors ${
                  locale === key
                    ? 'border-[var(--primary)] bg-[var(--primary)]/10 text-[var(--primary)] font-medium'
                    : 'border-[var(--border)] text-[var(--text-secondary)] hover:border-[var(--primary)]'
                }`}
              >
                {name}
              </button>
            ))}
          </div>
        </div>

        {/* Theme */}
        <div>
          <label className="flex items-center gap-2 text-[11px] font-medium text-[var(--text-secondary)] mb-2">
            <Palette size={14} />
            {t('settings.theme')}
          </label>
          <div className="flex gap-2">
            {(['light', 'dark', 'system'] as const).map((t_) => (
              <button
                key={t_}
                onClick={() => setTheme(t_)}
                className={`flex-1 py-2 text-sm rounded-lg border transition-colors ${
                  theme === t_
                    ? 'border-[var(--primary)] bg-[var(--primary)]/10 text-[var(--primary)] font-medium'
                    : 'border-[var(--border)] text-[var(--text-secondary)] hover:border-[var(--primary)]'
                }`}
              >
                {t(`settings.theme.${t_}`)}
              </button>
            ))}
          </div>
        </div>

        {/* Supabase */}
        <div>
          <label className="flex items-center gap-2 text-[11px] font-medium text-[var(--text-secondary)] mb-2">
            <Database size={14} />
            {t('settings.supabase')}
            <span className={`ml-auto text-[10px] px-1.5 py-0.5 rounded-full ${
              supabaseStatus === 'connected'
                ? 'bg-green-500/10 text-green-600'
                : 'bg-gray-500/10 text-[var(--text-secondary)]'
            }`}>
              {t(supabaseStatus === 'connected' ? 'settings.supabaseConnected' : 'settings.supabaseDisconnected')}
            </span>
          </label>
          <div className="space-y-2">
            <div>
              <input
                type="text"
                value={supabaseUrl}
                onChange={(e) => setSupabaseUrl(e.target.value)}
                onBlur={saveSupabaseConfig}
                placeholder={t('settings.supabaseUrlHint')}
                className="w-full px-3 py-2 text-sm bg-[var(--surface)] border border-[var(--border)] rounded-lg text-[var(--text)] placeholder:text-[var(--text-secondary)]/50"
              />
              <p className="text-[10px] text-[var(--text-secondary)] mt-0.5">{t('settings.supabaseUrl')}</p>
            </div>
            <div>
              <input
                type="password"
                value={supabaseKey}
                onChange={(e) => setSupabaseKey(e.target.value)}
                onBlur={saveSupabaseConfig}
                placeholder="eyJhbGciOiJIUzI1NiIs..."
                className="w-full px-3 py-2 text-sm bg-[var(--surface)] border border-[var(--border)] rounded-lg text-[var(--text)] placeholder:text-[var(--text-secondary)]/50"
              />
              <p className="text-[10px] text-[var(--text-secondary)] mt-0.5">{t('settings.supabaseAnonKey')}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="px-3 py-2 border-t border-[var(--border)] text-center">
        <p className="text-[10px] text-[var(--text-secondary)]">
          {t('settings.version')}: 0.1.0
        </p>
      </div>
    </div>
  );
}
