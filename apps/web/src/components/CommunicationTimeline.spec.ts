import { beforeEach, describe, expect, it, vi } from 'vitest';
import { flushPromises, mount, RouterLinkStub } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { reactive } from 'vue';
import CommunicationTimeline from './CommunicationTimeline.vue';
import { useAuthStore } from '@/stores/auth';
import { createTicketInteraction, listTicketInteractions } from '@/api/tickets';
import {
  createInteraction,
  deleteInteraction,
  listInteractions,
  type CustomerInteraction,
} from '@/api/customers';
import { listCommunicationTimeline, sendMessage } from '@/api/communication';
import { CHANNEL_ICONS } from './channels';
import { ICON_PATHS } from './icons';

vi.mock('@/stores/auth', () => ({ useAuthStore: vi.fn() }));

vi.mock('@/api/tickets', async () => {
  const actual = await vi.importActual<typeof import('@/api/tickets')>('@/api/tickets');

  return { ...actual, listTicketInteractions: vi.fn(), createTicketInteraction: vi.fn() };
});

vi.mock('@/api/customers', async () => {
  const actual = await vi.importActual<typeof import('@/api/customers')>('@/api/customers');

  return {
    ...actual,
    deleteInteraction: vi.fn(),
    listInteractions: vi.fn(),
    createInteraction: vi.fn(),
  };
});

vi.mock('@/api/communication', () => ({
  listChannels: vi.fn(async () => [
    {
      key: 'EMAIL',
      canRespond: true,
      isRealtime: false,
      providerConfigured: false,
      acceptsInbound: true,
      addressKind: 'email',
      requiresAddress: true,
      maxBodyLength: null,
      supportsSubject: true,
    },
    {
      key: 'WHATSAPP',
      canRespond: true,
      isRealtime: true,
      providerConfigured: false,
      acceptsInbound: true,
      addressKind: 'phone',
      requiresAddress: true,
      maxBodyLength: 4096,
      supportsSubject: false,
    },
    {
      key: 'CHAT',
      canRespond: true,
      isRealtime: true,
      providerConfigured: false,
      acceptsInbound: true,
      addressKind: 'session',
      requiresAddress: false,
      maxBodyLength: 4096,
      supportsSubject: false,
    },
    {
      key: 'PHONE',
      canRespond: false,
      isRealtime: true,
      providerConfigured: false,
      acceptsInbound: false,
      addressKind: 'none',
      requiresAddress: false,
      maxBodyLength: null,
      supportsSubject: true,
    },
  ]),
  listCommunicationTimeline: vi.fn(),
  sendMessage: vi.fn(),
}));

// The composer embeds QuickReplyPicker; its own behaviour has a dedicated spec.
vi.mock('@/api/quickReplies', () => ({
  listQuickReplies: vi.fn(async () => []),
}));

const mockedUseAuthStore = vi.mocked(useAuthStore);
const mockedListTicketInteractions = vi.mocked(listTicketInteractions);
const mockedCreateTicketInteraction = vi.mocked(createTicketInteraction);
const mockedDeleteInteraction = vi.mocked(deleteInteraction);
const mockedListInteractions = vi.mocked(listInteractions);
const mockedCreateInteraction = vi.mocked(createInteraction);
const mockedListCommunicationTimeline = vi.mocked(listCommunicationTimeline);
const mockedSendMessage = vi.mocked(sendMessage);

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
    customer: { id: 'c-1', name: 'Layla Ibrahim', email: 'layla@crm.local' },
    deliveryStatus: 'LOGGED',
    channelAddress: null,
    externalId: null,
    failureReason: null,
    threadKey: null,
    ...overrides,
  };
}

function mockAuth(permissions: string[], userId = 'u-1') {
  const store = reactive({ user: { id: userId }, can: (p: string) => permissions.includes(p) });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  mockedUseAuthStore.mockReturnValue(store as any);
}

type TimelineProps = Partial<{
  ticketId: string | undefined;
  customerId: string | undefined;
  readonly: boolean;
  maxItems: number;
  items: CustomerInteraction[];
  customerContact: { email: string | null; phone: string | null };
}>;

function mountTimeline(props: TimelineProps = {}) {
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
    mockedListInteractions.mockReset();
    mockedCreateInteraction.mockReset();
    mockedListCommunicationTimeline.mockReset();
    mockedSendMessage.mockReset();
  });

  describe('source selection (Product rule 2)', () => {
    it('with ticketId it calls listTicketInteractions', async () => {
      mockAuth([]);
      mockedListTicketInteractions.mockResolvedValue([]);

      mountTimeline();
      await flushPromises();

      expect(mockedListTicketInteractions).toHaveBeenCalledTimes(1);
      expect(mockedListInteractions).not.toHaveBeenCalled();
      expect(mockedListCommunicationTimeline).not.toHaveBeenCalled();
    });

    it('with only customerId it calls listInteractions', async () => {
      mockAuth([]);
      mockedListInteractions.mockResolvedValue([]);

      mountTimeline({ ticketId: undefined });
      await flushPromises();

      expect(mockedListInteractions).toHaveBeenCalledWith('c-1', expect.any(Object));
      expect(mockedListTicketInteractions).not.toHaveBeenCalled();
      expect(mockedListCommunicationTimeline).not.toHaveBeenCalled();
    });

    it('with neither it calls listCommunicationTimeline', async () => {
      mockAuth([]);
      mockedListCommunicationTimeline.mockResolvedValue({
        items: [],
        meta: { page: 1, pageSize: 20, total: 0, totalPages: 1 },
      });

      mountTimeline({ ticketId: undefined, customerId: undefined });
      await flushPromises();

      expect(mockedListCommunicationTimeline).toHaveBeenCalledTimes(1);
      expect(mockedListTicketInteractions).not.toHaveBeenCalled();
      expect(mockedListInteractions).not.toHaveBeenCalled();
    });

    it('with items it calls none of the three and renders them', async () => {
      mockAuth([]);

      const wrapper = mountTimeline({
        ticketId: undefined,
        items: [makeInteraction({ subject: 'Supplied row' })],
      });
      await flushPromises();

      expect(mockedListTicketInteractions).not.toHaveBeenCalled();
      expect(mockedListInteractions).not.toHaveBeenCalled();
      expect(mockedListCommunicationTimeline).not.toHaveBeenCalled();
      expect(wrapper.text()).toContain('Supplied row');
    });

    it('the includeCustomerHistory toggle renders only for the ticket source', async () => {
      mockAuth([]);
      mockedListTicketInteractions.mockResolvedValue([]);
      mockedListInteractions.mockResolvedValue([]);

      const ticketWrapper = mountTimeline();
      await flushPromises();
      expect(ticketWrapper.find('.communication-timeline__toggle').exists()).toBe(true);

      const customerWrapper = mountTimeline({ ticketId: undefined });
      await flushPromises();
      expect(customerWrapper.find('.communication-timeline__toggle').exists()).toBe(false);
    });

    it('the toolbar filters hide when items are supplied — the inbox owns its own', async () => {
      mockAuth([]);

      const wrapper = mountTimeline({ ticketId: undefined, items: [makeInteraction()] });
      await flushPromises();

      expect(wrapper.findAll('.communication-timeline__toolbar select')).toHaveLength(0);
    });
  });

  describe('delivery status and channel icon (Product rule 6)', () => {
    it('renders a delivery-status badge on every entry, LOGGED included', async () => {
      mockAuth([]);
      mockedListTicketInteractions.mockResolvedValue([makeInteraction()]);

      const wrapper = mountTimeline();
      await flushPromises();

      expect(wrapper.text()).toContain('Logged');
    });

    it('renders FAILED with its failureReason', async () => {
      mockAuth([]);
      mockedListTicketInteractions.mockResolvedValue([
        makeInteraction({ deliveryStatus: 'FAILED', failureReason: 'mailbox full' }),
      ]);

      const wrapper = mountTimeline();
      await flushPromises();

      expect(wrapper.text()).toContain('Failed');
      expect(wrapper.find('.communication-timeline__failure').text()).toContain('mailbox full');
    });

    it('takes the channel icon from CHANNEL_ICONS, not a fixed name', async () => {
      mockAuth([]);
      mockedListTicketInteractions.mockResolvedValue([makeInteraction({ channel: 'SMS' })]);

      const wrapper = mountTimeline();
      await flushPromises();

      const path = wrapper.find('.communication-timeline__badges svg path').attributes('d');
      expect(path).toBe(ICON_PATHS[CHANNEL_ICONS.SMS]);
    });

    it('renders channelAddress left-to-right (Product rule 14)', async () => {
      mockAuth([]);
      mockedListTicketInteractions.mockResolvedValue([
        makeInteraction({ channelAddress: 'layla@crm.local' }),
      ]);

      const wrapper = mountTimeline();
      await flushPromises();

      const address = wrapper.find('.communication-timeline__address');
      expect(address.text()).toBe('layla@crm.local');
      expect(address.attributes('dir')).toBe('ltr');
    });
  });

  describe('the channel-aware composer', () => {
    async function openComposer(props: TimelineProps = {}) {
      mockedListTicketInteractions.mockResolvedValue([]);
      mockedListInteractions.mockResolvedValue([]);

      const wrapper = mountTimeline(props);
      await flushPromises();
      await wrapper.findAll('button').find((b) => b.text() === 'Respond')!.trigger('click');
      await flushPromises();

      return wrapper;
    }

    function addressInput(wrapper: ReturnType<typeof mountTimeline>) {
      return wrapper.find('.communication-timeline__composer input[dir="ltr"]');
    }

    it('renders the address field for EMAIL and pre-fills it from customerContact', async () => {
      mockAuth(['interactions:write']);
      const wrapper = await openComposer({
        customerContact: { email: 'layla@crm.local', phone: null },
      });

      const composerSelect = wrapper.find('.communication-timeline__composer select');
      await composerSelect.setValue('EMAIL');
      await flushPromises();

      expect(addressInput(wrapper).exists()).toBe(true);
      expect((addressInput(wrapper).element as HTMLInputElement).value).toBe('layla@crm.local');
    });

    it('hides the address field for a channel that needs none', async () => {
      mockAuth(['interactions:write']);
      const wrapper = await openComposer({
        customerContact: { email: 'layla@crm.local', phone: null },
      });

      await wrapper.find('.communication-timeline__composer select').setValue('EMAIL');
      await flushPromises();
      expect(addressInput(wrapper).exists()).toBe(true);

      // CHAT's addressKind is 'session' and requiresAddress is false.
      await wrapper.find('.communication-timeline__composer select').setValue('CHAT');
      await flushPromises();
      expect(addressInput(wrapper).exists()).toBe(false);
      expect(wrapper.text()).not.toContain('This channel needs an address before it can send.');
    });

    it('hides the subject field for a supportsSubject: false channel', async () => {
      mockAuth(['interactions:write']);
      const wrapper = await openComposer({
        customerContact: { email: null, phone: '+201001234567' },
      });

      await wrapper.find('.communication-timeline__composer select').setValue('WHATSAPP');
      await flushPromises();

      const textInputs = wrapper.findAll('.communication-timeline__composer input[type="text"]');
      // Only the address input remains; the subject input is gone.
      expect(textInputs).toHaveLength(1);
      expect(textInputs[0].attributes('dir')).toBe('ltr');
    });

    it("the textarea's maxlength equals the channel's maxBodyLength", async () => {
      mockAuth(['interactions:write']);
      const wrapper = await openComposer({
        customerContact: { email: null, phone: '+201001234567' },
      });

      await wrapper.find('.communication-timeline__composer select').setValue('WHATSAPP');
      await flushPromises();

      expect(wrapper.find('.communication-timeline__composer textarea').attributes('maxlength')).toBe('4096');
    });

    it('falls back to the 8000-character DTO cap when the channel has no limit', async () => {
      mockAuth(['interactions:write']);
      const wrapper = await openComposer({
        customerContact: { email: 'layla@crm.local', phone: null },
      });

      await wrapper.find('.communication-timeline__composer select').setValue('EMAIL');
      await flushPromises();

      expect(wrapper.find('.communication-timeline__composer textarea').attributes('maxlength')).toBe('8000');
    });

    it('disables Send while a required address is empty, with an inline explanation', async () => {
      mockAuth(['interactions:write']);
      const wrapper = await openComposer({ customerContact: { email: null, phone: null } });

      await wrapper.find('.communication-timeline__composer select').setValue('EMAIL');
      await flushPromises();

      expect(wrapper.text()).toContain('This channel needs an address before it can send.');
      const send = wrapper.findAll('button').find((b) => b.text() === 'Send')!;
      expect(send.attributes('disabled')).toBeDefined();
    });
  });

  describe('submit routing (Product rule 4)', () => {
    async function submit(wrapper: ReturnType<typeof mountTimeline>) {
      const subject = wrapper.find('.communication-timeline__composer input[type="text"]:not([dir="ltr"])');

      if (subject.exists()) {
        await subject.setValue('Response subject');
      }

      await wrapper.find('.communication-timeline__composer textarea').setValue('Body text.');
      await wrapper.find('.communication-timeline__composer').trigger('submit.prevent');
      await flushPromises();
    }

    it('a communication:send holder with a customerId dispatches, with no direction in the payload', async () => {
      mockAuth(['interactions:write', 'communication:send']);
      mockedListTicketInteractions.mockResolvedValue([]);
      mockedSendMessage.mockResolvedValue(makeInteraction());

      const wrapper = mountTimeline({ customerContact: { email: 'layla@crm.local', phone: null } });
      await flushPromises();
      await wrapper.findAll('button').find((b) => b.text() === 'Respond')!.trigger('click');
      await flushPromises();
      await submit(wrapper);

      expect(mockedSendMessage).toHaveBeenCalledTimes(1);
      expect(mockedCreateTicketInteraction).not.toHaveBeenCalled();

      const [payload] = mockedSendMessage.mock.calls[0];
      expect(payload).not.toHaveProperty('direction');
      expect(payload.customerId).toBe('c-1');
      expect(payload.ticketId).toBe('t-1');
      expect(payload.address).toBe('layla@crm.local');
    });

    it('without communication:send it falls back to the ticket log route', async () => {
      mockAuth(['interactions:write']);
      mockedListTicketInteractions.mockResolvedValue([]);
      mockedCreateTicketInteraction.mockResolvedValue(makeInteraction());

      const wrapper = mountTimeline({ customerContact: { email: 'layla@crm.local', phone: null } });
      await flushPromises();
      await wrapper.findAll('button').find((b) => b.text() === 'Respond')!.trigger('click');
      await flushPromises();
      await submit(wrapper);

      expect(mockedCreateTicketInteraction).toHaveBeenCalledTimes(1);
      expect(mockedSendMessage).not.toHaveBeenCalled();
      expect(mockedCreateTicketInteraction.mock.calls[0][1].direction).toBe('OUTBOUND');
    });

    it('without communication:send and no ticket it falls back to the customer log route', async () => {
      mockAuth(['interactions:write']);
      mockedListInteractions.mockResolvedValue([]);
      mockedCreateInteraction.mockResolvedValue(makeInteraction());

      const wrapper = mountTimeline({
        ticketId: undefined,
        customerContact: { email: 'layla@crm.local', phone: null },
      });
      await flushPromises();
      await wrapper.findAll('button').find((b) => b.text() === 'Respond')!.trigger('click');
      await flushPromises();
      await submit(wrapper);

      expect(mockedCreateInteraction).toHaveBeenCalledTimes(1);
      expect(mockedCreateInteraction.mock.calls[0][0]).toBe('c-1');
      expect(mockedSendMessage).not.toHaveBeenCalled();
    });
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
    expect(channelOptions).toEqual(['EMAIL', 'WHATSAPP', 'CHAT']);

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

  it('an ingested interaction with no author renders the systemAuthor fallback', async () => {
    mockAuth(['interactions:write']);
    mockedListTicketInteractions.mockResolvedValue([
      makeInteraction({ id: 'i-inbound', direction: 'INBOUND', createdBy: null }),
    ]);

    const wrapper = mountTimeline();
    await flushPromises();

    expect(wrapper.text()).toContain('Received automatically');
  });

  it('hides Delete on a null-author entry for a caller without customers:archive', async () => {
    mockAuth(['interactions:write']);
    mockedListTicketInteractions.mockResolvedValue([
      makeInteraction({ id: 'i-inbound', createdBy: null }),
    ]);

    const wrapper = mountTimeline();
    await flushPromises();

    // Matches the server: a null author is nobody's row, so only an
    // ARCHIVE_PERMISSION holder can delete it — and the API would 403.
    expect(wrapper.text()).not.toContain('Delete');
  });

  it('shows Delete on a null-author entry for a customers:archive holder', async () => {
    mockAuth(['interactions:write', 'customers:archive']);
    mockedListTicketInteractions.mockResolvedValue([
      makeInteraction({ id: 'i-inbound', createdBy: null }),
    ]);

    const wrapper = mountTimeline();
    await flushPromises();

    expect(wrapper.text()).toContain('Delete');
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
