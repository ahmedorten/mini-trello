import { createI18n } from 'vue-i18n';
import en from './locales/en.json';
import ar from './locales/ar.json';

export const SUPPORTED_LOCALES = ['en', 'ar'] as const;
export type AppLocale = (typeof SUPPORTED_LOCALES)[number];

/** Layout direction per locale. The single source of truth for `dir`. */
export const LOCALE_DIRECTION: Record<AppLocale, 'ltr' | 'rtl'> = {
  en: 'ltr',
  ar: 'rtl',
};

/** Western digits in Arabic too — Product rule 11. */
const datetimeFormats = {
  en: {
    short: { year: 'numeric', month: 'short', day: 'numeric' },
    long: { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' },
  },
  ar: {
    short: { year: 'numeric', month: 'short', day: 'numeric', numberingSystem: 'latn' },
    long: { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', numberingSystem: 'latn' },
  },
} as const;

export const i18n = createI18n({
  legacy: false,
  globalInjection: true,
  locale: 'en',
  fallbackLocale: 'en',
  messages: { en, ar },
  datetimeFormats,
  numberFormats: {
    en: { decimal: { style: 'decimal' } },
    ar: { decimal: { style: 'decimal', numberingSystem: 'latn' } },
  },
});
