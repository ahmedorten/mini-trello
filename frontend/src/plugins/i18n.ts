import { createI18n } from 'vue-i18n';
import type { App } from 'vue';
import en from '../locales/en';
import ar from '../locales/ar';

// Retrieve default locale from LocalStorage or browser preference
const getInitialLocale = (): 'en' | 'ar' => {
  const stashed = localStorage.getItem('mini_trello_locale');
  if (stashed === 'en' || stashed === 'ar') return stashed;
  
  // Default to browser preference or English
  const lang = navigator.language.split('-')[0];
  return lang === 'ar' ? 'ar' : 'en';
};

const initialLocale = getInitialLocale();

// Set root direction on boot
if (typeof document !== 'undefined') {
  document.documentElement.dir = initialLocale === 'ar' ? 'rtl' : 'ltr';
  document.documentElement.lang = initialLocale;
}

export const i18n = createI18n({
  legacy: false, // Use Composition API
  locale: initialLocale,
  fallbackLocale: 'en',
  messages: {
    en,
    ar,
  },
});

export default function setupI18n(app: App) {
  app.use(i18n);
}
