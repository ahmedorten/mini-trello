import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import AppCard from './AppCard.vue';

describe('AppCard', () => {
  it('renders the title in an h2 when given', () => {
    const wrapper = mount(AppCard, { props: { title: 'Recent tickets' } });

    const heading = wrapper.find('h2');
    expect(heading.exists()).toBe(true);
    expect(heading.text()).toBe('Recent tickets');
  });

  it('renders no h2 when no title is given', () => {
    const wrapper = mount(AppCard);

    expect(wrapper.find('h2').exists()).toBe(false);
  });

  it('renders the default slot content', () => {
    const wrapper = mount(AppCard, { slots: { default: '<p>Body content</p>' } });

    expect(wrapper.text()).toContain('Body content');
  });

  it('renders the actions and footer slots', () => {
    const wrapper = mount(AppCard, {
      props: { title: 'Title' },
      slots: { actions: '<button>Do</button>', footer: '<span>Footer text</span>' },
    });

    expect(wrapper.find('button').exists()).toBe(true);
    expect(wrapper.text()).toContain('Footer text');
  });
});
