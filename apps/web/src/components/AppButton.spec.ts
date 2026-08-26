import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import AppButton from './AppButton.vue';

describe('AppButton', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders a real <button> defaulting to type="button"', () => {
    const wrapper = mount(AppButton, { slots: { default: 'Click me' } });

    expect(wrapper.element.tagName).toBe('BUTTON');
    expect(wrapper.attributes('type')).toBe('button');
  });

  it('respects an explicit type="submit"', () => {
    const wrapper = mount(AppButton, { props: { type: 'submit' }, slots: { default: 'Save' } });

    expect(wrapper.attributes('type')).toBe('submit');
  });

  it('loading sets disabled and renders the spinner', () => {
    const wrapper = mount(AppButton, { props: { loading: true }, slots: { default: 'Save' } });

    expect(wrapper.attributes('disabled')).toBeDefined();
    expect(wrapper.find('.app-button__spinner').exists()).toBe(true);
  });

  it.each(['primary', 'secondary', 'ghost', 'danger'] as const)('applies the %s variant class', (variant) => {
    const wrapper = mount(AppButton, { props: { variant }, slots: { default: 'Go' } });

    expect(wrapper.classes()).toContain(`app-button--${variant}`);
  });

  it('warns in dev when iconOnly is set without an aria-label', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    mount(AppButton, { props: { iconOnly: true, icon: 'close' } });

    expect(warnSpy).toHaveBeenCalled();
  });

  it('does not warn when iconOnly has an aria-label', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    mount(AppButton, { props: { iconOnly: true, icon: 'close', ariaLabel: 'Close' } });

    expect(warnSpy).not.toHaveBeenCalled();
  });

  it('does not fire the click handler while disabled', async () => {
    const onClick = vi.fn();
    const wrapper = mount(AppButton, {
      props: { disabled: true },
      attrs: { onClick },
      slots: { default: 'Save' },
    });

    await wrapper.trigger('click');

    expect(onClick).not.toHaveBeenCalled();
  });

  it('fires the click handler when enabled', async () => {
    const onClick = vi.fn();
    const wrapper = mount(AppButton, { attrs: { onClick }, slots: { default: 'Save' } });

    await wrapper.trigger('click');

    expect(onClick).toHaveBeenCalledTimes(1);
  });
});
