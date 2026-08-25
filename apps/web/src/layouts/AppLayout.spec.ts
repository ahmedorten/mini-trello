import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import { createRouter, createWebHistory } from 'vue-router';
import AppLayout from './AppLayout.vue';

const routes = [
  { path: '/', name: 'dashboard', component: { template: '<div>Dashboard</div>' } },
  { path: '/system-status', name: 'system-status', component: { template: '<div>Status</div>' } },
];

async function mountLayout() {
  const router = createRouter({ history: createWebHistory(), routes });
  router.push('/');
  await router.isReady();

  return mount(AppLayout, {
    global: { plugins: [router] },
  });
}

describe('AppLayout', () => {
  it('renders the brand text', async () => {
    const wrapper = await mountLayout();

    expect(wrapper.text()).toContain('Customer Support CRM');
  });

  it('renders a nav landmark with exactly two links', async () => {
    const wrapper = await mountLayout();

    const nav = wrapper.find('nav[aria-label="Main navigation"]');
    expect(nav.exists()).toBe(true);

    const links = nav.findAll('a');
    expect(links).toHaveLength(2);
    expect(links[0].attributes('href')).toBe('/');
    expect(links[1].attributes('href')).toBe('/system-status');
  });
});
