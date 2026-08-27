import { beforeEach, describe, expect, it, vi } from 'vitest';
import { flushPromises, mount, RouterLinkStub } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { reactive } from 'vue';
import CommunicationTimeline from './CommunicationTimeline.vue';
import { useAuthStore } from '@/stores/auth';
import { createTicketInteraction, listTicketInteractions } from '@/api/tickets';
import { deleteInteraction, type CustomerInteraction } from '@/api/customers';

vi.mock('@/stores/auth', () => ({ useAuthStore: vi.fn() }));

vi.mock('@/api/tickets', async () => {
  const actual = await vi.importActual<typeof import('@/api/tickets')>('@/api/tickets');

  return { ...actual, listTicketInteractions: vi.fn(), createTicketInteraction: vi.fn() };
});

vi.mock('@/api/customers', async () => {
  const actual = await vi.importActual<typeof import('@/api/customers')>('@/api/customers');

  return { ...actual, deleteInteraction: vi.fn() };
});

vi.mock('@/api/communication', () => ({
  listChannels: vi.fn(async () => [
    { key: 'EMAIL', canRespond: true, isRealtime: false, providerConfigured: false },
    { key: 'WHATSAPP', canRespond: true, isRealtime: true, providerConfigured: false },
    { key: 'PHONE', canRespond: false, isRealtime: true, providerConfigured: false },
  ]),
}));

// The composer embeds QuickReplyPicker; its own behaviour has a dedicated spec.
vi.mock('@/api/quickReplies', () => ({
  listQuickReplies: vi.fn(async () => []),
}));

const mockedUseAuthStore = vi.mocked(useAuthStore);
const mockedListTicketInteractions = vi.mocked(listTicketInteractions);
const mockedCreateTicketInteraction = vi.mocked(createTicketInteraction);
const mockedDeleteInteraction = vi.mocked(deleteInteraction);

function makeInteraction(overrides: Partial<CustomerInteraction> = {}): CustomerInteraction {
  return {
    id: 'i-1',
    customerId: 'c-1',
    channel: 'EMAIL',
    direction: 'OUTBOUND',
    subject: 'Follow-up',
    body: 'We are looking into this.',
    occurredAt: '2026-08-25T00:00:00.000Z',
    createdBy: { id: 'u-1', fullName: 'Nour Hassan', email: 'nour@crm.local' },
    createdAt: '2026-08-25T00:00:00.000Z',
    ticketId: 't-1',
    ticket: { id: 't-1', subject: 'Cannot log in' },
    ...overrides,
  };
}

function mockAuth(permissions: string[], userId = 'u-1') {
  const store = reactive({ user: { id: userId }, can: (p: string) => permissions.includes(p) });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  mockedUseAuthStore.mockReturnValue(store as any);
}

function mountTimeline(props: Partial<{ ticketId: string; customerId: string; readonly: boolean; maxItems: number }> = {}) {
  const pinia = createPinia();
  setActivePinia(pinia);

  return mount(CommunicationTimeline, {
    props: { ticketId: 't-1', customerId: 'c-1', ...props },
    global: { plugins: [pinia], stubs: { RouterLink: RouterLinkStub } },
  });
}

describe('CommunicationTimeline', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedUseAuthStore.mockReset();
    mockedListTicketInteractions.mockReset();
    mockedCreateTicketInteraction.mockReset();
    mockedDeleteInteraction.mockReset();
  });

  it('renders entries newest-first exactly as returned, without re-sorting', async () => {
    mockAuth(['interactions:write']);
    const outOfOrder = [
      makeInteraction({ id: 'i-2', occurredAt: '2026-08-20T00:00:00.000Z', subject: 'Older' }),
      makeInteraction({ id: 'i-3', occurredAt: '2026-08-27T00:00:00.000Z', subject: 'Newest' }),
      makeInteraction({ id: 'i-1', occurredAt: '2026-08-24T00:00:00.000Z', subject: 'Middle' }),
    ];
    mockedListTicketInteractions.mockResolvedValue(outOfOrder);

    const wrapper = mountTimeline();
    await flushPromises();

    const subjects = wrapper.findAll('.communication-timeline__subject').map((el) => el.text());
    expect(subjects).toEqual(['Older', 'Newest', 'Middle']);
  });

  it('shows a channel badge with a localised label and an icon per entry', async () => {
    mockAuth([]);
    mockedListTicketInteractions.mockResolvedValue([makeInteraction({ channel: 'WHATSAPP' })]);

    const wrapper = mountTimeline();
    await flushPromises();

    expect(wrapper.text()).toContain('WhatsApp');
    expect(wrapper.find('.communication-timeline__badges svg').exists()).toBe(true);
  });

  it('distinguishes this-ticket, other-ticket, and ticket-less entries', async () => {
    mockAuth([]);
    mockedListTicketInteractions.mockResolvedValue([
      makeInteraction({ id: 'i-this', ticket: { id: 't-1', subject: 'This one' } }),
      makeInteraction({ id: 'i-other', ticket: { id: 't-2', subject: 'A different ticket' } }),
      makeInteraction({ id: 'i-none', ticketId: null, ticket: null }),
    ]);

    const wrapper = mountTimeline();
    await flushPromises();

    const entries = wrapper.findAll('.communication-timeline__entry');
    expect(entries[0].classes()).not.toContain('communication-timeline__entry--other');
    expect(entries[1].classes()).toContain('communication-timeline__entry--other');
    expect(entries[1].text()).toContain('A different ticket');
    expect(entries[2].classes()).not.toContain('communication-timeline__entry--other');
  });

  it('includeCustomerHistory defaults to false and toggling it refetches with the flag', async () => {
    mockAuth([]);
    mockedListTicketInteractions.mockResolvedValue([]);

    const wrapper = mountTimeline();
    await flushPromises();

    expect(mockedListTicketInteractions).toHaveBeenLastCalledWith('t-1', expect.objectContaining({ includeCustomerHistory: false }));

    await wrapper.find('.communication-timeline__toggle input[type="checkbox"]').setValue(true);
    await flushPromises();

    expect(mockedListTicketInteractions).toHaveBeenLastCalledWith('t-1', expect.objectContaining({ includeCustomerHistory: true }));
  });

  it('changing the channel filter refetches', async () => {
    mockAuth([]);
    mockedListTicketInteractions.mockResolvedValue([]);

    const wrapper = mountTimeline();
    await flushPromises();
    mockedListTicketInteractions.mockClear();

    const selects = wrapper.findAll('.communication-timeline__toolbar select');
    await selects[0].setValue('EMAIL');
    await flushPromises();

    expect(mockedListTicketInteractions).toHaveBeenCalledWith('t-1', expect.objectContaining({ channel: 'EMAIL' }));
  });

  it('hides the composer when readonly, and without interactions:write', async () => {
    mockAuth([]);
    mockedListTicketInteractions.mockResolvedValue([]);

    const readonlyWrapper = mountTimeline({ readonly: true });
    await flushPromises();
    expect(readonlyWrapper.text()).not.toContain('Respond');

    mockAuth(['interactions:write']);
    const noPermissionWrapper = mountTimeline();
    await flushPromises();
    // still has permission in this branch — verify the negative case separately
    void noPermissionWrapper;

    mockedUseAuthStore.mockReset();
    mockAuth([]);
    const noWriteWrapper = mountTimeline();
    await flushPromises();
    expect(noWriteWrapper.text()).not.toContain('Respond');
  });

  it('the composer channel select lists only canRespond channels, shows the standing notice, and fixes direction to OUTBOUND', async () => {
    mockAuth(['interactions:write']);
    mockedListTicketInteractions.mockResolvedValue([]);

    const wrapper = mountTimeline();
    await flushPromises();

    await wrapper.find('button').trigger('click');
    await flushPromises();

    expect(wrapper.text()).toContain('Recording this response logs it in the interaction history. No message is sent to the customer.');

    const channelOptions = wrapper.find('.communication-timeline__composer select').findAll('option').map((o) => o.element.value);
    expect(channelOptions).toEqual(['EMAIL', 'WHATSAPP']);

    expect(wrapper.find('.communication-timeline__direction').text()).toContain('Outbound');
    expect(wrapper.find('.communication-timeline__composer').findAll('select')).toHaveLength(1);
  });

  it('submits without a customerId in the payload', async () => {
    mockAuth(['interactions:write']);
    mockedListTicketInteractions.mockResolvedValue([]);
    mockedCreateTicketInteraction.mockResolvedValue(makeInteraction());

    const wrapper = mountTimeline();
    await flushPromises();
    await wrapper.find('button').trigger('click');
    await flushPromises();

    await wrapper.find('.communication-timeline__composer input[type="text"]').setValue('Response subject');
    await wrapper.find('.communication-timeline__composer').trigger('submit.prevent');
    await flushPromises();

    expect(mockedCreateTicketInteraction).toHaveBeenCalledTimes(1);
    const [ticketId, payload] = mockedCreateTicketInteraction.mock.calls[0];
    expect(ticketId).toBe('t-1');
    expect(payload).not.toHaveProperty('customerId');
    expect(payload.direction).toBe('OUTBOUND');
  });

  it('delete is behind window.confirm', async () => {
    mockAuth(['interactions:write'], 'u-1');
    mockedListTicketInteractions.mockResolvedValue([makeInteraction({ createdBy: { id: 'u-1', fullName: 'Me', email: 'me@crm.local' } })]);
    mockedDeleteInteraction.mockResolvedValue(undefined);

    const wrapper = mountTimeline();
    await flushPromises();

    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);
    const deleteButton = wrapper.findAll('button').find((b) => b.text() === 'Delete')!;
    await deleteButton.trigger('click');
    expect(mockedDeleteInteraction).not.toHaveBeenCalled();

    confirmSpy.mockReturnValue(true);
    await deleteButton.trigger('click');
    expect(mockedDeleteInteraction).toHaveBeenCalledWith('c-1', 'i-1');
  });

  it('maxItems caps rendering and shows a showing-N-of-M footer', async () => {
    mockAuth([]);
    mockedListTicketInteractions.mockResolvedValue([
      makeInteraction({ id: 'i-1' }),
      makeInteraction({ id: 'i-2' }),
      makeInteraction({ id: 'i-3' }),
    ]);

    const wrapper = mountTimeline({ maxItems: 2 });
    await flushPromises();

    expect(wrapper.findAll('.communication-timeline__entry')).toHaveLength(2);
    expect(wrapper.text()).toContain('Showing 2 of 3');
  });

  it('renders loading, error, and empty states', async () => {
    mockAuth([]);
    mockedListTicketInteractions.mockRejectedValueOnce(new Error('down'));

    const wrapper = mountTimeline();
    await flushPromises();
    expect(wrapper.text()).toContain('down');

    mockedListTicketInteractions.mockResolvedValueOnce([]);
    const emptyWrapper = mountTimeline();
    await flushPromises();
    expect(emptyWrapper.text()).toContain('No communication logged yet.');
  });
});
