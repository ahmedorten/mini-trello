import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { LOCALE_STORAGE_KEY, useLocaleStore } from './locale';
import { i18n } from '@/i18n';

function setNavigatorLanguage(value: string): void {
  Object.defineProperty(navigator, 'language', { value, configurable: true });
}

describe('useLocaleStore', () => {
  const originalLanguage = navigator.language;

  beforeEach(() => {
    setActivePinia(createPinia());
    localStorage.clear();
    document.documentElement.removeAttribute('lang');
    document.documentElement.removeAttribute('dir');
    setNavigatorLanguage('en-US');
  });

  afterEach(() => {
    setNavigatorLanguage(originalLanguage);
    vi.restoreAllMocks();
  });

  it('defaults to en with empty storage and an English navigator language', () => {
    const store = useLocaleStore();

    expect(store.locale).toBe('en');
    expect(store.dir).toBe('ltr');
    expect(store.isRtl).toBe(false);
  });

  it('defaults to ar when navigator.language is ar-EG and storage is empty', () => {
    setNavigatorLanguage('ar-EG');
    const store = useLocaleStore();

    expect(store.locale).toBe('ar');
  });

  it('setLocale("ar") updates dir, isRtl, document attributes, and the i18n instance', () => {
    const store = useLocaleStore();

    store.setLocale('ar');

    expect(store.locale).toBe('ar');
    expect(store.dir).toBe('rtl');
    expect(store.isRtl).toBe(true);
    expect(document.documentElement.dir).toBe('rtl');
    expect(document.documentElement.lang).toBe('ar');
    expect(i18n.global.locale.value).toBe('ar');
  });

  it('setLocale("fr") is a no-op for an unsupported locale', () => {
    const store = useLocaleStore();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    store.setLocale('fr' as any);

    expect(store.locale).toBe('en');
  });

  it('persists the choice to localStorage and a fresh store reads it back', () => {
    const store = useLocaleStore();
    store.setLocale('ar');

    expect(localStorage.getItem(LOCALE_STORAGE_KEY)).toBe('ar');

    setActivePinia(createPinia());
    const freshStore = useLocaleStore();
    expect(freshStore.locale).toBe('ar');
  });

  it('boots defaulting to en when localStorage.getItem throws', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('storage disabled');
    });

    const store = useLocaleStore();

    expect(store.locale).toBe('en');
  });

  it('does not throw when localStorage.setItem throws on switch', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('storage disabled');
    });

    const store = useLocaleStore();

    expect(() => store.setLocale('ar')).not.toThrow();
    expect(store.locale).toBe('ar');
  });
});
