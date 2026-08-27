import { describe, expect, it, beforeEach } from 'vitest';
import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import AppPagination, { PAGE_SIZE_OPTIONS } from './AppPagination.vue';
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

  it('renders no page-size select when pageSize is omitted', () => {
    const wrapper = mount(AppPagination, { props: { page: 1, totalPages: 3, total: 25 } });

    expect(wrapper.find('select').exists()).toBe(false);
  });

  it('renders the select with the current pageSize when supplied', () => {
    const wrapper = mount(AppPagination, { props: { page: 1, totalPages: 3, total: 25, pageSize: 20 } });

    expect(wrapper.find('select').exists()).toBe(true);
    expect((wrapper.find('select').element as HTMLSelectElement).value).toBe('20');
  });

  it('emits pageSizeChange with a number on select', async () => {
    const wrapper = mount(AppPagination, { props: { page: 1, totalPages: 3, total: 25, pageSize: 20 } });

    await wrapper.find('select').setValue('50');

    expect(wrapper.emitted('pageSizeChange')?.[0]).toEqual([50]);
  });

  it('offers no option above the API MAX_PAGE_SIZE of 100', () => {
    expect(Math.max(...PAGE_SIZE_OPTIONS)).toBeLessThanOrEqual(100);
  });
});
