import { describe, expect, it, beforeEach } from 'vitest';
import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import AppStateBlock from './AppStateBlock.vue';

describe('AppStateBlock', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it('renders the default loading message with role=status and aria-live=polite', () => {
    const wrapper = mount(AppStateBlock, { props: { variant: 'loading' } });

    expect(wrapper.text()).toContain('Loading…');
    expect(wrapper.attributes('role')).toBe('status');
    expect(wrapper.attributes('aria-live')).toBe('polite');
  });

  it('renders the default empty message with no role', () => {
    const wrapper = mount(AppStateBlock, { props: { variant: 'empty' } });

    expect(wrapper.text()).toContain('Nothing to show.');
    expect(wrapper.attributes('role')).toBeUndefined();
  });

  it('renders the default error message with role=alert', () => {
    const wrapper = mount(AppStateBlock, { props: { variant: 'error' } });

    expect(wrapper.text()).toContain('Something went wrong.');
    expect(wrapper.attributes('role')).toBe('alert');
  });

  it('renders the default warning message with role=alert', () => {
    const wrapper = mount(AppStateBlock, { props: { variant: 'warning' } });

    expect(wrapper.text()).toContain('Heads up.');
    expect(wrapper.attributes('role')).toBe('alert');
  });

  it('renders the default success message', () => {
    const wrapper = mount(AppStateBlock, { props: { variant: 'success' } });

    expect(wrapper.text()).toContain('Done.');
  });

  it('a custom message overrides the default', () => {
    const wrapper = mount(AppStateBlock, { props: { variant: 'error', message: 'Custom failure text' } });

    expect(wrapper.text()).toContain('Custom failure text');
    expect(wrapper.text()).not.toContain('Something went wrong.');
  });

  it('renders the actions slot', () => {
    const wrapper = mount(AppStateBlock, {
      props: { variant: 'empty' },
      slots: { actions: '<button>Retry</button>' },
    });

    expect(wrapper.find('button').exists()).toBe(true);
    expect(wrapper.text()).toContain('Retry');
  });
});
