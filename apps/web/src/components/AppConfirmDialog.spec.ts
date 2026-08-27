import { beforeEach, describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import AppConfirmDialog from './AppConfirmDialog.vue';

describe('AppConfirmDialog', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it('renders the interpolated message from messageKey and messageParams', () => {
    const wrapper = mount(AppConfirmDialog, {
      props: { open: true, messageKey: 'user.action.deactivateConfirm', messageParams: { name: 'Nour Hassan' } },
    });

    expect(wrapper.find('.app-confirm__message').text()).toContain('Nour Hassan');
  });

  it('renders Cancel before Confirm in the DOM (Product rule 6)', () => {
    const wrapper = mount(AppConfirmDialog, { props: { open: true, messageKey: 'task.confirmDelete' } });
    const buttons = wrapper.find('.form-actions').findAll('button');

    expect(buttons[0].text()).toBe('Cancel');
    expect(buttons[1].text()).toBe('Delete');
  });

  it('emits confirm when the danger button is clicked', async () => {
    const wrapper = mount(AppConfirmDialog, { props: { open: true, messageKey: 'task.confirmDelete' } });
    const buttons = wrapper.find('.form-actions').findAll('button');

    await buttons[1].trigger('click');

    expect(wrapper.emitted('confirm')).toHaveLength(1);
  });

  it('emits update:open false when Cancel is clicked', async () => {
    const wrapper = mount(AppConfirmDialog, { props: { open: true, messageKey: 'task.confirmDelete' } });
    const buttons = wrapper.find('.form-actions').findAll('button');

    await buttons[0].trigger('click');

    expect(wrapper.emitted('update:open')?.[0]).toEqual([false]);
  });

  it('renders nothing when open is false', () => {
    const wrapper = mount(AppConfirmDialog, { props: { open: false, messageKey: 'task.confirmDelete' } });

    expect(wrapper.find('[role="dialog"]').exists()).toBe(false);
  });

  it('uses common.delete as the default confirm label and honours confirmLabelKey', () => {
    const withDefault = mount(AppConfirmDialog, { props: { open: true, messageKey: 'task.confirmDelete' } });
    expect(withDefault.find('.form-actions').findAll('button')[1].text()).toBe('Delete');

    const withOverride = mount(AppConfirmDialog, {
      props: { open: true, messageKey: 'user.action.deactivateConfirm', confirmLabelKey: 'user.action.deactivate' },
    });
    expect(withOverride.find('.form-actions').findAll('button')[1].text()).toBe('Deactivate');
  });

  it('shows the confirm button in a loading state when busy', () => {
    const wrapper = mount(AppConfirmDialog, { props: { open: true, messageKey: 'task.confirmDelete', busy: true } });
    const confirmButton = wrapper.find('.form-actions').findAll('button')[1];

    expect(confirmButton.attributes('aria-busy')).toBe('true');
  });
});
