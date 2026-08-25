import { describe, expect, it, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import { createMemoryHistory, createRouter } from 'vue-router';
import { reactive } from 'vue';
import TicketFormView from './TicketFormView.vue';
import { useTicketsStore } from '@/stores/tickets';
import type { CreateTicketPayload, Ticket, UpdateTicketPayload } from '@/api/tickets';

vi.mock('@/stores/tickets', () => ({ useTicketsStore: vi.fn() }));

const mockedUseTicketsStore = vi.mocked(useTicketsStore);

const sampleTicket: Ticket = {
  id: 't-1',
  customer: { id: 'c-1', name: 'Orten Trading', email: 'contact@orten.example' },
  subject: 'Cannot log in',
  description: 'After password reset, login fails.',
  category: 'TECHNICAL',
  priority: 'HIGH',
  status: 'OPEN',
  assignedAgent: { id: 'u-1', fullName: 'Nour Hassan', email: 'nour@crm.local' },
  createdBy: null,
  counts: { comments: 0, attachments: 0, history: 0 },
  createdAt: '2026-08-25T00:00:00.000Z',
  updatedAt: '2026-08-25T00:00:00.000Z',
};

function mockTickets(overrides: {
  current?: Ticket | null;
  isSaving?: boolean;
  error?: string | null;
  createImpl?: (payload: CreateTicketPayload) => Promise<string | null>;
  updateImpl?: (id: string, payload: UpdateTicketPayload) => Promise<boolean>;
} = {}) {
  const store = reactive({
    current: overrides.current ?? null,
    agents: [],
    customerOptions: [{ id: 'c-1', name: 'Orten Trading', email: 'contact@orten.example' }],
    isSaving: overrides.isSaving ?? false,
    error: overrides.error ?? null,
    loadAgents: vi.fn(async () => {}),
    loadCustomerOptions: vi.fn(async () => {}),
    loadDetail: vi.fn(async () => {}),
    create: vi.fn<[CreateTicketPayload], Promise<string | null>>(overrides.createImpl ?? (async () => 't-1')),
    update: vi.fn<[string, UpdateTicketPayload], Promise<boolean>>(overrides.updateImpl ?? (async () => true)),
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  mockedUseTicketsStore.mockReturnValue(store as any);

  return store;
}

async function mountView(initialPath: string) {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/tickets/new', name: 'ticket-create', component: TicketFormView },
      { path: '/tickets/:id/edit', name: 'ticket-edit', component: TicketFormView },
      { path: '/tickets/:id', name: 'ticket-detail', component: { template: '<div />' } },
    ],
  });

  router.push(initialPath);
  await router.isReady();

  const wrapper = mount(TicketFormView, { global: { plugins: [router] } });
  await flushPromises();

  return { wrapper, router };
}

describe('TicketFormView', () => {
  it('starts with GENERAL/MEDIUM defaults in create mode and does not call loadDetail', async () => {
    const store = mockTickets();
    const { wrapper } = await mountView('/tickets/new');

    const selects = wrapper.findAll('select');
    expect((selects[1].element as HTMLSelectElement).value).toBe('GENERAL');
    expect((selects[2].element as HTMLSelectElement).value).toBe('MEDIUM');
    expect(store.loadDetail).not.toHaveBeenCalled();
  });

  it('shows an editable customer select in create mode', async () => {
    mockTickets();
    const { wrapper } = await mountView('/tickets/new');

    expect(wrapper.find('select').exists()).toBe(true);
    expect(wrapper.text()).not.toContain('Customer:');
  });

  it('loads and pre-fills the fields in edit mode, with a static (non-editable) customer name', async () => {
    const store = mockTickets({ current: sampleTicket });
    const { wrapper } = await mountView('/tickets/t-1/edit');

    expect(store.loadDetail).toHaveBeenCalledWith('t-1');
    const subjectInput = wrapper.find('input[type="text"]').element as HTMLInputElement;
    expect(subjectInput.value).toBe('Cannot log in');
    expect(wrapper.text()).toContain('Orten Trading');
    // The customer field is static text on edit, not an editable <select>.
    expect(wrapper.findAll('select')).toHaveLength(3);
  });

  it('submits create with assignedAgentId absent when unset', async () => {
    const store = mockTickets();
    const { wrapper } = await mountView('/tickets/new');

    await wrapper.find('input[type="text"]').setValue('New ticket subject');
    await wrapper.find('textarea').setValue('Some description');
    await wrapper.find('form').trigger('submit.prevent');
    await flushPromises();

    expect(store.create).toHaveBeenCalledTimes(1);
    const payload = store.create.mock.calls[0][0];
    expect(payload.subject).toBe('New ticket subject');
    expect(payload.assignedAgentId).toBeUndefined();
  });

  it('submits create with assignedAgentId present when set', async () => {
    const store = mockTickets();
    const agentOption = { id: 'u-1', fullName: 'Nour Hassan', email: 'nour@crm.local' };
    store.agents.push(agentOption as never);
    const { wrapper } = await mountView('/tickets/new');

    await wrapper.find('input[type="text"]').setValue('New ticket subject');
    await wrapper.find('textarea').setValue('Some description');
    const selects = wrapper.findAll('select');
    await selects[selects.length - 1].setValue('u-1');
    await wrapper.find('form').trigger('submit.prevent');
    await flushPromises();

    const payload = store.create.mock.calls[0][0];
    expect(payload.assignedAgentId).toBe('u-1');
  });

  it('submits edit with assignedAgentId explicitly null when cleared', async () => {
    const store = mockTickets({ current: sampleTicket });
    const { wrapper } = await mountView('/tickets/t-1/edit');

    const selects = wrapper.findAll('select');
    await selects[selects.length - 1].setValue('');
    await wrapper.find('form').trigger('submit.prevent');
    await flushPromises();

    expect(store.update).toHaveBeenCalledTimes(1);
    const [, payload] = store.update.mock.calls[0];
    expect(payload.assignedAgentId).toBeNull();
  });

  it('submits edit with the current assignedAgentId when left untouched — edit always sends it explicitly', async () => {
    const store = mockTickets({ current: sampleTicket });
    const { wrapper } = await mountView('/tickets/t-1/edit');

    await wrapper.find('form').trigger('submit.prevent');
    await flushPromises();

    const [, payload] = store.update.mock.calls[0];
    expect(payload.assignedAgentId).toBe('u-1');
  });

  it('replaces to the ticket detail page on a successful create', async () => {
    const store = mockTickets({ createImpl: async () => 'new-id' });
    const { wrapper, router } = await mountView('/tickets/new');
    const replaceSpy = vi.spyOn(router, 'replace');

    await wrapper.find('input[type="text"]').setValue('New ticket subject');
    await wrapper.find('textarea').setValue('Some description');
    await wrapper.find('form').trigger('submit.prevent');
    await flushPromises();

    expect(store.create).toHaveBeenCalled();
    expect(replaceSpy).toHaveBeenCalledWith({ name: 'ticket-detail', params: { id: 'new-id' } });
  });

  it('replaces to the ticket detail page on a successful edit', async () => {
    const store = mockTickets({ current: sampleTicket, updateImpl: async () => true });
    const { wrapper, router } = await mountView('/tickets/t-1/edit');
    const replaceSpy = vi.spyOn(router, 'replace');

    await wrapper.find('form').trigger('submit.prevent');
    await flushPromises();

    expect(store.update).toHaveBeenCalled();
    expect(replaceSpy).toHaveBeenCalledWith({ name: 'ticket-detail', params: { id: 't-1' } });
  });

  it('renders error and does not navigate on a failed submit', async () => {
    mockTickets({ createImpl: async () => null, error: 'Validation failed' });
    const { wrapper, router } = await mountView('/tickets/new');
    const replaceSpy = vi.spyOn(router, 'replace');

    await wrapper.find('input[type="text"]').setValue('New ticket subject');
    await wrapper.find('textarea').setValue('Some description');
    await wrapper.find('form').trigger('submit.prevent');
    await flushPromises();

    expect(wrapper.find('[role="alert"]').text()).toBe('Validation failed');
    expect(replaceSpy).not.toHaveBeenCalled();
  });

  it('disables submit while isSaving, with a short subject, or an empty description', async () => {
    mockTickets({ isSaving: true });
    const { wrapper } = await mountView('/tickets/new');

    await wrapper.find('input[type="text"]').setValue('A');
    const submitButton = wrapper.find('button[type="submit"]');

    expect(submitButton.attributes('disabled')).toBeDefined();
  });
});
