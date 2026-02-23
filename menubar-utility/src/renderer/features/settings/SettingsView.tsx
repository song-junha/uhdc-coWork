import { useEffect, useState } from 'react';
import { ChevronLeft, Globe, Palette, Cloud, Power, RotateCcw } from 'lucide-react';
import { useI18n } from '../../hooks/useI18n';
import { useTheme } from '../../hooks/useTheme';
import { localeNames, type Locale } from '../../../shared/i18n';

interface SettingsViewProps {
  onClose: () => void;
}

export default function SettingsView({ onClose }: SettingsViewProps) {
  const { t, locale, setLocale } = useI18n();
  const { theme, setTheme } = useTheme();
  const [supabaseConnected, setSupabaseConnected] = useState(false);
  const [cloudSyncEnabled, setCloudSyncEnabled] = useState(false);
  const [cloudSyncLoading, setCloudSyncLoading] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  useEffect(() => {
    (async () => {
      const syncEnabled = await window.electronAPI.settings.get('cloud_sync_enabled');
      setCloudSyncEnabled(syncEnabled === 'true');

      const user = await window.electronAPI.auth.autoAuth();
      setSupabaseConnected(!!user);
    })();
  }, []);

  const toggleCloudSync = async () => {
    if (!supabaseConnected) return;

    const newValue = !cloudSyncEnabled;
    setCloudSyncLoading(true);

    try {
      await window.electronAPI.settings.set('cloud_sync_enabled', String(newValue));
      setCloudSyncEnabled(newValue);

      if (newValue) {
        // ON: push local data first, then pull remote
        await window.electronAPI.sync.pushAllPersonal();
        await window.electronAPI.sync.pullAllPersonal();
      }
    } catch {
      // Revert on error
      setCloudSyncEnabled(!newValue);
      await window.electronAPI.settings.set('cloud_sync_enabled', String(!newValue));
    } finally {
      setCloudSyncLoading(false);
    }
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

        {/* Cloud Sync */}
        <div>
          <label className="flex items-center gap-2 text-[11px] font-medium text-[var(--text-secondary)] mb-2">
            <Cloud size={14} />
            {t('settings.cloudSync')}
          </label>
          <div className="flex items-center justify-between p-3 bg-[var(--surface)] border border-[var(--border)] rounded-lg">
            <div className="flex-1 min-w-0">
              <p className="text-sm text-[var(--text)]">
                {t('settings.cloudSync.description')}
              </p>
              {!supabaseConnected && (
                <p className="text-[10px] text-[var(--text-secondary)] mt-0.5">
                  {t('settings.cloudSync.requiresSupabase')}
                </p>
              )}
              {cloudSyncLoading && (
                <p className="text-[10px] text-[var(--primary)] mt-0.5">
                  {t('settings.cloudSync.syncing')}
                </p>
              )}
            </div>
            <button
              onClick={toggleCloudSync}
              disabled={!supabaseConnected || cloudSyncLoading}
              className={`relative ml-3 w-11 h-6 rounded-full transition-colors flex-shrink-0 ${
                cloudSyncEnabled
                  ? 'bg-[var(--primary)]'
                  : 'bg-gray-300 dark:bg-gray-600'
              } ${!supabaseConnected || cloudSyncLoading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
            >
              <span
                className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                  cloudSyncEnabled ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>
        </div>
      </div>

      <div className="px-3 py-2 border-t border-[var(--border)] space-y-2">
        <button
          onClick={() => {
            if (confirm(t('settings.resetDataConfirm'))) {
              window.electronAPI.app.resetData();
            }
          }}
          className="w-full flex items-center justify-center gap-2 py-2 text-sm text-[var(--text-secondary)] hover:bg-[var(--surface)] rounded-lg transition-colors"
        >
          <RotateCcw size={14} />
          {t('settings.resetData')}
        </button>
        <button
          onClick={() => window.electronAPI.app.quit()}
          className="w-full flex items-center justify-center gap-2 py-2 text-sm text-[var(--danger)] hover:bg-[var(--danger)]/10 rounded-lg transition-colors"
        >
          <Power size={14} />
          {t('settings.quit')}
        </button>
        <p className="text-[10px] text-[var(--text-secondary)] text-center">
          {t('settings.version')}: 1.0.0
        </p>
      </div>
    </div>
  );
}
