import { describe, expect, it, beforeEach } from 'vitest';
import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import AppIcon from './AppIcon.vue';
import { useLocaleStore } from '@/stores/locale';

const ICON_NAMES = [
  'dashboard', 'workspace', 'tickets', 'customers', 'users', 'tasks', 'communication', 'status',
  'search', 'plus', 'edit', 'trash', 'download', 'upload', 'close', 'check', 'alert-triangle',
  'alert-circle', 'info', 'clock', 'globe', 'logout', 'menu', 'chevron-start', 'chevron-end',
  'chevron-down', 'paperclip', 'send', 'user-check',
] as const;

describe('AppIcon', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it.each(ICON_NAMES)('renders a non-empty path for "%s"', (name) => {
    const wrapper = mount(AppIcon, { props: { name } });
    const path = wrapper.find('path');

    expect(path.exists()).toBe(true);
    expect(path.attributes('d')).toBeTruthy();
  });

  it('is aria-hidden and not focusable with no label', () => {
    const wrapper = mount(AppIcon, { props: { name: 'menu' } });

    expect(wrapper.attributes('aria-hidden')).toBe('true');
    expect(wrapper.attributes('focusable')).toBe('false');
    expect(wrapper.attributes('role')).toBeUndefined();
  });

  it('renders role=img and aria-label when a label is given', () => {
    const wrapper = mount(AppIcon, { props: { name: 'menu', label: 'Open menu' } });

    expect(wrapper.attributes('role')).toBe('img');
    expect(wrapper.attributes('aria-label')).toBe('Open menu');
    expect(wrapper.attributes('aria-hidden')).toBeUndefined();
  });

  it('chevron-start renders a different path from chevron-end in LTR', () => {
    const start = mount(AppIcon, { props: { name: 'chevron-start' } });
    const end = mount(AppIcon, { props: { name: 'chevron-end' } });

    expect(start.find('path').attributes('d')).not.toBe(end.find('path').attributes('d'));
  });

  it('swaps chevron-start/chevron-end paths when the locale store is ar', () => {
    const ltrStart = mount(AppIcon, { props: { name: 'chevron-start' } }).find('path').attributes('d');
    const ltrEnd = mount(AppIcon, { props: { name: 'chevron-end' } }).find('path').attributes('d');

    const locale = useLocaleStore();
    locale.setLocale('ar');

    const rtlStart = mount(AppIcon, { props: { name: 'chevron-start' } }).find('path').attributes('d');
    const rtlEnd = mount(AppIcon, { props: { name: 'chevron-end' } }).find('path').attributes('d');

    expect(rtlStart).toBe(ltrEnd);
    expect(rtlEnd).toBe(ltrStart);
  });
});
