import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mount, type VueWrapper } from '@vue/test-utils';
import { defineComponent, ref } from 'vue';
import { createPinia, setActivePinia } from 'pinia';
import AppModal from './AppModal.vue';

const Harness = defineComponent({
  components: { AppModal },
  setup() {
    const open = ref(false);

    return { open };
  },
  template: `
    <div>
      <button id="trigger" @click="open = true">Open</button>
      <AppModal :open="open" title-key="common.confirm" @update:open="open = $event">
        <button id="first">First</button>
        <button id="last">Last</button>
      </AppModal>
    </div>
  `,
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let activeWrapper: VueWrapper<any> | null = null;

function focusableButtons(wrapper: VueWrapper<InstanceType<typeof Harness>>) {
  return wrapper.find('[role="dialog"]').findAll('button');
}

describe('AppModal', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  afterEach(() => {
    // A failed assertion aborts the test body before its own wrapper.unmount()
    // runs, which would otherwise leave stale #trigger/#first/#last nodes
    // (duplicate ids) attached to document.body for the next test.
    activeWrapper?.unmount();
    activeWrapper = null;
  });

  it('renders nothing when open is false', () => {
    const wrapper = mount(AppModal, { props: { open: false, titleKey: 'common.confirm' } });

    expect(wrapper.find('[role="dialog"]').exists()).toBe(false);
  });

  it('renders role=dialog, aria-modal, and aria-labelledby pointing at the title', () => {
    const wrapper = mount(AppModal, { props: { open: true, titleKey: 'common.confirm' } });
    const dialog = wrapper.find('[role="dialog"]');

    expect(dialog.exists()).toBe(true);
    expect(dialog.attributes('aria-modal')).toBe('true');
    const titleId = dialog.attributes('aria-labelledby');
    expect(titleId).toBeTruthy();
    expect(wrapper.find(`#${titleId}`).text()).toBe('Confirm');
  });

  it('moves focus to the first focusable child on open', async () => {
    const wrapper = mount(Harness, { attachTo: document.body });
    activeWrapper = wrapper;

    await wrapper.find('#trigger').trigger('click');
    await wrapper.vm.$nextTick();
    await wrapper.vm.$nextTick();

    const first = focusableButtons(wrapper)[0].element;
    expect(document.activeElement).toBe(first);
  });

  it('Tab from the last focusable child wraps to the first', async () => {
    const wrapper = mount(Harness, { attachTo: document.body });
    activeWrapper = wrapper;

    await wrapper.find('#trigger').trigger('click');
    await wrapper.vm.$nextTick();
    await wrapper.vm.$nextTick();

    const buttons = focusableButtons(wrapper);
    const first = buttons[0].element as HTMLElement;
    const last = buttons[buttons.length - 1].element as HTMLElement;
    last.focus();

    await wrapper.find('[role="dialog"]').trigger('keydown', { key: 'Tab' });

    expect(document.activeElement).toBe(first);
  });

  it('Shift+Tab from the first focusable child wraps to the last', async () => {
    const wrapper = mount(Harness, { attachTo: document.body });
    activeWrapper = wrapper;

    await wrapper.find('#trigger').trigger('click');
    await wrapper.vm.$nextTick();
    await wrapper.vm.$nextTick();

    const buttons = focusableButtons(wrapper);
    const first = buttons[0].element as HTMLElement;
    const last = buttons[buttons.length - 1].element as HTMLElement;
    first.focus();

    await wrapper.find('[role="dialog"]').trigger('keydown', { key: 'Tab', shiftKey: true });

    expect(document.activeElement).toBe(last);
  });

  it('Escape emits update:open with false', async () => {
    const wrapper = mount(AppModal, { props: { open: true, titleKey: 'common.confirm' } });

    await wrapper.find('[role="dialog"]').trigger('keydown', { key: 'Escape' });

    expect(wrapper.emitted('update:open')?.[0]).toEqual([false]);
  });

  it('restores focus to the trigger on close', async () => {
    const wrapper = mount(Harness, { attachTo: document.body });
    activeWrapper = wrapper;
    const trigger = wrapper.find('#trigger').element as HTMLElement;

    // trigger('click') dispatches a synthetic event and does not focus the
    // element the way a real user click does — focus it explicitly so the
    // modal captures a realistic "focus before open" starting point.
    trigger.focus();
    await wrapper.find('#trigger').trigger('click');
    await wrapper.vm.$nextTick();
    await wrapper.vm.$nextTick();

    await wrapper.find('[role="dialog"]').trigger('keydown', { key: 'Escape' });
    await wrapper.vm.$nextTick();
    await wrapper.vm.$nextTick();

    expect(document.activeElement).toBe(trigger);
  });
});
