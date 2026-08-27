import { beforeEach, describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { defineComponent, h, type PropType } from 'vue';
import AppSortHeader from './AppSortHeader.vue';

/** A <th> is only valid inside <thead><tr>, so host it there — mirrors the
 *  approach in AppTabs.spec.ts of mounting the real component in a realistic
 *  context rather than asserting against an invalid fragment. */
function mountHeader(props: {
  field: string;
  label: string;
  activeField: string;
  activeOrder: 'asc' | 'desc';
}) {
  const Host = defineComponent({
    props: {
      field: { type: String, required: true },
      label: { type: String, required: true },
      activeField: { type: String, required: true },
      activeOrder: { type: String as PropType<'asc' | 'desc'>, required: true },
    },
    emits: ['sort'],
    setup(hostProps, { emit }) {
      return () =>
        h('table', [
          h('thead', [
            h('tr', [
              h(AppSortHeader, {
                field: hostProps.field,
                label: hostProps.label,
                activeField: hostProps.activeField,
                activeOrder: hostProps.activeOrder,
                onSort: (field: string) => emit('sort', field),
              }),
            ]),
          ]),
        ]);
    },
  });

  return mount(Host, { props });
}

describe('AppSortHeader', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it('renders a th with aria-sort="none" when not the active field', () => {
    const wrapper = mountHeader({ field: 'name', label: 'Name', activeField: '', activeOrder: 'asc' });

    expect(wrapper.find('th').attributes('aria-sort')).toBe('none');
  });

  it('renders aria-sort="ascending" and the sort-asc icon when active and asc', () => {
    const wrapper = mountHeader({ field: 'name', label: 'Name', activeField: 'name', activeOrder: 'asc' });

    expect(wrapper.find('th').attributes('aria-sort')).toBe('ascending');
    expect(wrapper.find('svg').exists()).toBe(true);
  });

  it('renders aria-sort="descending" and the sort-desc icon when active and desc', () => {
    const wrapper = mountHeader({ field: 'name', label: 'Name', activeField: 'name', activeOrder: 'desc' });

    expect(wrapper.find('th').attributes('aria-sort')).toBe('descending');
    expect(wrapper.find('svg').exists()).toBe(true);
  });

  it('emits sort with its field on click', async () => {
    const wrapper = mountHeader({ field: 'name', label: 'Name', activeField: '', activeOrder: 'asc' });

    await wrapper.find('button').trigger('click');

    expect(wrapper.emitted('sort')?.[0]).toEqual(['name']);
  });

  it('renders no icon when inactive', () => {
    const wrapper = mountHeader({ field: 'name', label: 'Name', activeField: 'email', activeOrder: 'asc' });

    expect(wrapper.find('svg').exists()).toBe(false);
  });

  it('puts aria-sort on the th, not the button', () => {
    const wrapper = mountHeader({ field: 'name', label: 'Name', activeField: 'name', activeOrder: 'asc' });

    expect(wrapper.find('th').attributes('aria-sort')).toBe('ascending');
    expect(wrapper.find('button').attributes('aria-sort')).toBeUndefined();
  });
});
