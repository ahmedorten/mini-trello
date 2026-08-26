import { describe, expect, it, beforeEach } from 'vitest';
import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import AppPagination from './AppPagination.vue';
import { useLocaleStore } from '@/stores/locale';

describe('AppPagination', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it('disables Previous on page 1', () => {
    const wrapper = mount(AppPagination, { props: { page: 1, totalPages: 3, total: 25 } });
    const buttons = wrapper.findAll('button');

    expect(buttons[0].attributes('disabled')).toBeDefined();
    expect(buttons[1].attributes('disabled')).toBeUndefined();
  });

  it('disables Next on the last page', () => {
    const wrapper = mount(AppPagination, { props: { page: 3, totalPages: 3, total: 25 } });
    const buttons = wrapper.findAll('button');

    expect(buttons[0].attributes('disabled')).toBeUndefined();
    expect(buttons[1].attributes('disabled')).toBeDefined();
  });

  it('emits change with page + 1 on Next and page - 1 on Previous', async () => {
    const wrapper = mount(AppPagination, { props: { page: 2, totalPages: 3, total: 25 } });
    const buttons = wrapper.findAll('button');

    await buttons[1].trigger('click');
    expect(wrapper.emitted('change')?.[0]).toEqual([3]);

    await buttons[0].trigger('click');
    expect(wrapper.emitted('change')?.[1]).toEqual([1]);
  });

  it('renders the interpolated summary', () => {
    const wrapper = mount(AppPagination, { props: { page: 2, totalPages: 5, total: 42 } });

    expect(wrapper.find('.app-pagination__summary').text()).toBe('Page 2 of 5 — 42 total');
  });

  it('swaps the Previous chevron path under ar', () => {
    const ltrWrapper = mount(AppPagination, { props: { page: 2, totalPages: 3, total: 25 } });
    const ltrPath = ltrWrapper.find('button svg path').attributes('d');

    const locale = useLocaleStore();
    locale.setLocale('ar');

    const rtlWrapper = mount(AppPagination, { props: { page: 2, totalPages: 3, total: 25 } });
    const rtlPath = rtlWrapper.find('button svg path').attributes('d');

    expect(rtlPath).not.toBe(ltrPath);
  });
});
