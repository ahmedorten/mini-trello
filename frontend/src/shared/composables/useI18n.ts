import { useI18n as useVueI18n } from 'vue-i18n';
import { computed } from 'vue';

export function useI18n() {
  const { t, locale } = useVueI18n();

  const dir = computed(() => (locale.value === 'ar' ? 'rtl' : 'ltr'));

  const setLocale = (lang: 'en' | 'ar') => {
    locale.value = lang;
    localStorage.setItem('mini_trello_locale', lang);
    if (typeof document !== 'undefined') {
      document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
      document.documentElement.lang = lang;
    }
  };

  return {
    t,
    locale: computed({
      get: () => locale.value as 'en' | 'ar',
      set: (val) => setLocale(val),
    }),
    dir,
    setLocale,
  };
}
