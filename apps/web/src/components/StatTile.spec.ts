import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import { createRouter, createWebHistory } from 'vue-router';
import StatTile from './StatTile.vue';

describe('StatTile', () => {
  it('renders the translated label and the numeric value', () => {
    const wrapper = mount(StatTile, { props: { labelKey: 'nav.tickets', value: 42 } });

    expect(wrapper.text()).toContain('Tickets');
    expect(wrapper.text()).toContain('42');
  });

  it('renders as a plain div with no `to`', () => {
    const wrapper = mount(StatTile, { props: { labelKey: 'nav.tickets', value: 1 } });

    expect(wrapper.find('a').exists()).toBe(false);
  });

  it('renders as a router-link when `to` is given', async () => {
    const router = createRouter({
      history: createWebHistory(),
      routes: [
        { path: '/', name: 'home', component: { template: '<div />' } },
        { path: '/tickets', name: 'tickets', component: { template: '<div />' } },
      ],
    });
    router.push('/');
    await router.isReady();

    const wrapper = mount(StatTile, {
      props: { labelKey: 'nav.tickets', value: 1, to: '/tickets' },
      global: { plugins: [router] },
    });

    expect(wrapper.find('a').attributes('href')).toBe('/tickets');
  });
});
