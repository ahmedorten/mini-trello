import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import AppBadge from './AppBadge.vue';
import { TICKET_PRIORITIES, TICKET_STATUSES } from '@/api/tickets';

describe('AppBadge', () => {
  it.each(TICKET_STATUSES)('maps status %s to a coloured badge with the catalogue label', (status) => {
    const wrapper = mount(AppBadge, { props: { status } });

    expect(wrapper.attributes('style')).toContain('--app-badge-fg');
    expect(wrapper.text().length).toBeGreaterThan(0);
    expect(wrapper.text()).not.toBe(status);
  });

  it.each(TICKET_PRIORITIES)('maps priority %s to a coloured badge with the catalogue label', (priority) => {
    const wrapper = mount(AppBadge, { props: { priority } });

    expect(wrapper.attributes('style')).toContain('--app-badge-fg');
    expect(wrapper.text().length).toBeGreaterThan(0);
    expect(wrapper.text()).not.toBe(priority);
  });

  it('falls back to the neutral tone for an unknown status value', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const wrapper = mount(AppBadge, { props: { status: 'SOMETHING_NEW' as any } });

    expect(wrapper.attributes('style')).toContain('var(--color-text-muted)');
  });

  it('renders slot content and the given tone when neither status nor priority is set', () => {
    const wrapper = mount(AppBadge, { props: { tone: 'ok' }, slots: { default: 'Custom label' } });

    expect(wrapper.text()).toBe('Custom label');
    expect(wrapper.attributes('style')).toContain('var(--color-ok)');
  });
});
