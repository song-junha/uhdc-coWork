import { ko } from './ko';
import { en } from './en';

export type Locale = 'ko' | 'en';
export type TranslationKey = keyof typeof ko;

const translations: Record<Locale, Record<string, string>> = { ko, en };

export function t(key: TranslationKey, locale: Locale, params?: Record<string, string | number>): string {
  let text = translations[locale]?.[key] ?? translations['en'][key] ?? key;
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      text = text.replace(`{${k}}`, String(v));
    }
  }
  return text;
}

export const localeNames: Record<Locale, string> = {
  ko: '한국어',
  en: 'English',
};
