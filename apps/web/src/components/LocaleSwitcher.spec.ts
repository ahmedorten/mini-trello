import { describe, expect, it, beforeEach } from 'vitest';
import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import LocaleSwitcher from './LocaleSwitcher.vue';
import { useLocaleStore } from '@/stores/locale';

describe('LocaleSwitcher', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it('renders one option per supported locale, each labelled in its own language', () => {
    const wrapper = mount(LocaleSwitcher);
    const options = wrapper.findAll('option');

    expect(options).toHaveLength(2);
    expect(options.map((o) => o.text())).toEqual(['English', 'العربية']);
    expect(options.map((o) => o.attributes('value'))).toEqual(['en', 'ar']);
  });

  it('has an accessible name', () => {
    const wrapper = mount(LocaleSwitcher);

    expect(wrapper.find('select').attributes('aria-label')).toBeTruthy();
  });

  it('selecting a locale calls setLocale', async () => {
    const wrapper = mount(LocaleSwitcher);
    const localeStore = useLocaleStore();

    await wrapper.find('select').setValue('ar');

    expect(localeStore.locale).toBe('ar');
  });
});
