import { describe, expect, it, beforeEach } from 'vitest';
import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import AppTabs from './AppTabs.vue';
import { useLocaleStore } from '@/stores/locale';

const tabs = [
  { key: 'notes', labelKey: 'customer.tab.notes', count: 3 },
  { key: 'attachments', labelKey: 'customer.tab.attachments' },
  { key: 'history', labelKey: 'customer.tab.history' },
];

describe('AppTabs', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it('renders one role=tab per entry inside a role=tablist', () => {
    const wrapper = mount(AppTabs, { props: { tabs, modelValue: 'notes' } });

    expect(wrapper.attributes('role')).toBe('tablist');
    expect(wrapper.findAll('[role="tab"]')).toHaveLength(3);
  });

  it('tracks aria-selected against the model', () => {
    const wrapper = mount(AppTabs, { props: { tabs, modelValue: 'attachments' } });
    const tabEls = wrapper.findAll('[role="tab"]');

    expect(tabEls[0].attributes('aria-selected')).toBe('false');
    expect(tabEls[1].attributes('aria-selected')).toBe('true');
    expect(tabEls[2].attributes('aria-selected')).toBe('false');
  });

  it('clicking a tab emits update:modelValue with its key', async () => {
    const wrapper = mount(AppTabs, { props: { tabs, modelValue: 'notes' } });

    await wrapper.findAll('[role="tab"]')[1].trigger('click');

    expect(wrapper.emitted('update:modelValue')?.[0]).toEqual(['attachments']);
  });

  it('only the active tab has tabindex 0 — the rest are -1 (roving tabindex)', () => {
    const wrapper = mount(AppTabs, { props: { tabs, modelValue: 'attachments' } });
    const tabEls = wrapper.findAll('[role="tab"]');

    expect(tabEls[0].attributes('tabindex')).toBe('-1');
    expect(tabEls[1].attributes('tabindex')).toBe('0');
    expect(tabEls[2].attributes('tabindex')).toBe('-1');
  });

  it('renders the count in parentheses when supplied', () => {
    const wrapper = mount(AppTabs, { props: { tabs, modelValue: 'notes' } });

    expect(wrapper.findAll('[role="tab"]')[0].text()).toContain('(3)');
  });

  it('ArrowRight advances to the next tab in LTR', async () => {
    const wrapper = mount(AppTabs, { props: { tabs, modelValue: 'notes' } });

    await wrapper.find('[role="tablist"]').trigger('keydown', { key: 'ArrowRight' });

    expect(wrapper.emitted('update:modelValue')?.[0]).toEqual(['attachments']);
  });

  it('ArrowRight retreats to the previous tab in RTL', async () => {
    const locale = useLocaleStore();
    locale.setLocale('ar');

    const wrapper = mount(AppTabs, { props: { tabs, modelValue: 'attachments' } });

    await wrapper.find('[role="tablist"]').trigger('keydown', { key: 'ArrowRight' });

    expect(wrapper.emitted('update:modelValue')?.[0]).toEqual(['notes']);
  });
});
