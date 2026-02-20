import { create } from 'zustand';
import { t, type Locale, type TranslationKey } from '../../shared/i18n';

interface I18nStore {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: TranslationKey, params?: Record<string, string | number>) => string;
}

export const useI18n = create<I18nStore>((set, get) => ({
  locale: 'ko',
  setLocale: (locale) => {
    set({ locale });
    window.electronAPI.settings.set('language', locale);
  },
  t: (key, params) => t(key, get().locale, params),
}));

// Init from settings
window.electronAPI?.settings.get('language').then((lang) => {
  if (lang === 'ko' || lang === 'en') {
    useI18n.setState({ locale: lang });
  }
});
