import { beforeEach, describe, expect, it, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import QuickReplyPicker from './QuickReplyPicker.vue';
import { useLocaleStore } from '@/stores/locale';
import { listQuickReplies, type QuickReply } from '@/api/quickReplies';

vi.mock('@/api/quickReplies', () => ({
  listQuickReplies: vi.fn(),
}));

const mockedListQuickReplies = vi.mocked(listQuickReplies);

function makeReply(overrides: Partial<QuickReply> = {}): QuickReply {
  return {
    id: 'qr-1',
    key: 'greeting.welcome',
    locale: 'en',
    title: 'Welcome',
    body: 'Thanks for reaching out!',
    channel: null,
    isActive: true,
    createdBy: null,
    createdAt: '2026-08-25T00:00:00.000Z',
    updatedAt: '2026-08-25T00:00:00.000Z',
    ...overrides,
  };
}

describe('QuickReplyPicker', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedListQuickReplies.mockReset();
  });

  it('fetches with the current locale', async () => {
    setActivePinia(createPinia());
    mockedListQuickReplies.mockResolvedValue([makeReply()]);

    mount(QuickReplyPicker, { props: { modelValue: '' } });
    await flushPromises();

    expect(mockedListQuickReplies).toHaveBeenCalledWith({ locale: 'en', channel: undefined });
  });

  it('refetches with en when a non-en locale returns [], and not when the locale is en', async () => {
    const pinia = createPinia();
    setActivePinia(pinia);
    const localeStore = useLocaleStore(pinia);
    localeStore.setLocale('ar');

    mockedListQuickReplies.mockResolvedValueOnce([]).mockResolvedValueOnce([makeReply()]);

    mount(QuickReplyPicker, { props: { modelValue: '' } });
    await flushPromises();

    expect(mockedListQuickReplies).toHaveBeenCalledTimes(2);
    expect(mockedListQuickReplies).toHaveBeenNthCalledWith(1, { locale: 'ar', channel: undefined });
    expect(mockedListQuickReplies).toHaveBeenNthCalledWith(2, { locale: 'en', channel: undefined });

    localeStore.setLocale('en');
  });

  it('selecting appends to a non-empty modelValue with a separator and emits update:modelValue, never sends', async () => {
    setActivePinia(createPinia());
    mockedListQuickReplies.mockResolvedValue([makeReply({ body: 'Closing line.' })]);

    const wrapper = mount(QuickReplyPicker, { props: { modelValue: 'Hello there,' } });
    await flushPromises();

    await wrapper.find('button').trigger('click');

    expect(wrapper.emitted('update:modelValue')).toEqual([['Hello there,\nClosing line.']]);
  });

  it('a 403 degrades to a no-access empty state', async () => {
    setActivePinia(createPinia());
    mockedListQuickReplies.mockRejectedValue(new Error('forbidden'));

    const wrapper = mount(QuickReplyPicker, { props: { modelValue: '' } });
    await flushPromises();

    expect(wrapper.text()).toContain('You do not have access to quick replies.');
  });

  it('browse mode renders no insert action', async () => {
    setActivePinia(createPinia());
    mockedListQuickReplies.mockResolvedValue([makeReply()]);

    const wrapper = mount(QuickReplyPicker, { props: { modelValue: '', mode: 'browse' } });
    await flushPromises();

    expect(wrapper.text()).not.toContain('Insert');
    expect(wrapper.text()).toContain('Copy');
  });
});
