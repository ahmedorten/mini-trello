import { defineStore } from 'pinia';
import { computed, ref, watch } from 'vue';
import { i18n, LOCALE_DIRECTION, SUPPORTED_LOCALES, type AppLocale } from '@/i18n';

export const LOCALE_STORAGE_KEY = 'crm.locale';

function isSupportedLocale(value: unknown): value is AppLocale {
  return typeof value === 'string' && (SUPPORTED_LOCALES as readonly string[]).includes(value);
}

/** localStorage throws in a private window and in some embedded contexts. A
 *  locale preference must never be able to stop the app booting. */
function readStoredLocale(): AppLocale {
  try {
    const stored = localStorage.getItem(LOCALE_STORAGE_KEY);

    if (isSupportedLocale(stored)) {
      return stored;
    }
  } catch {
    // Storage is unavailable — fall through to the navigator-language guess.
  }

  return navigator.language.startsWith('ar') ? 'ar' : 'en';
}

function writeStoredLocale(value: AppLocale): void {
  try {
    localStorage.setItem(LOCALE_STORAGE_KEY, value);
  } catch {
    // A locale preference must never be able to break the app. The switcher
    // still works for the rest of the session; it just will not persist.
  }
}

export const useLocaleStore = defineStore('locale', () => {
  const locale = ref<AppLocale>(readStoredLocale());
  const dir = computed(() => LOCALE_DIRECTION[locale.value]);
  const isRtl = computed(() => dir.value === 'rtl');

  function setLocale(next: AppLocale): void {
    if (!isSupportedLocale(next)) {
      return;
    }

    locale.value = next;
  }

  // Product rule 7: imperative, no reload — a reload would drop the in-memory
  // access token and sign the user out.
  watch(
    locale,
    (value) => {
      i18n.global.locale.value = value;
      document.documentElement.lang = value;
      document.documentElement.dir = LOCALE_DIRECTION[value];
      writeStoredLocale(value);
    },
    // Synchronous so a caller reading `document.documentElement.dir` (or a
    // fresh store re-reading localStorage) right after `setLocale()` sees the
    // change immediately — no microtask gap, no single-frame direction flash.
    { immediate: true, flush: 'sync' },
  );

  return { locale, dir, isRtl, setLocale };
});
