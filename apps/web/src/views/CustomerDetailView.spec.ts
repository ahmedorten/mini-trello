import { describe, expect, it, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { createMemoryHistory, createRouter } from 'vue-router';
import { reactive } from 'vue';
import { createPinia } from 'pinia';
import CustomerDetailView from './CustomerDetailView.vue';
import { useAuthStore } from '@/stores/auth';
import { useCustomersStore } from '@/stores/customers';
import type { Customer, CustomerNote } from '@/api/customers';

vi.mock('@/stores/auth', () => ({ useAuthStore: vi.fn() }));
vi.mock('@/stores/customers', () => ({ useCustomersStore: vi.fn() }));

// The interactions tab now mounts the shared timeline, which fetches its own
// rows. Stubbing the component keeps this spec about the view.
vi.mock('@/components/CommunicationTimeline.vue', () => ({
  default: {
    name: 'CommunicationTimeline',
    props: ['ticketId', 'customerId', 'readonly', 'maxItems', 'items', 'customerContact'],
    template: '<div class="communication-timeline-stub" />',
  },
}));

const mockedUseAuthStore = vi.mocked(useAuthStore);
const mockedUseCustomersStore = vi.mocked(useCustomersStore);

const sampleCustomer: Customer = {
  id: 'c-1',
  type: 'COMPANY',
  name: 'Orten Trading',
  companyName: 'Orten Trading LLC',
  email: 'contact@orten.example',
  phone: '+20 100 000 0000',
  alternatePhone: null,
  addressLine1: null,
  addressLine2: null,
  city: 'Cairo',
  country: null,
  postalCode: null,
  status: 'ACTIVE',
  assignedAgent: null,
  createdBy: null,
  counts: { notes: 0, attachments: 0, interactions: 0 },
  createdAt: '2026-08-25T00:00:00.000Z',
  updatedAt: '2026-08-25T00:00:00.000Z',
};

function mockAuth(permissions: string[], currentUserId = 'u-1') {
  const store = reactive({
    user: { id: currentUserId },
    can: (permission: string) => permissions.includes(permission),
  });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  mockedUseAuthStore.mockReturnValue(store as any);

  return store;
}

function mockCustomers(overrides: {
  current?: Customer | null;
  notes?: CustomerNote[];
  attachments?: unknown[];
  error?: string | null;
} = {}) {
  const store = reactive({
    current: 'current' in overrides ? overrides.current : sampleCustomer,
    notes: overrides.notes ?? [],
    attachments: overrides.attachments ?? [],
    error: overrides.error ?? null,
    loadDetail: vi.fn(async () => {}),
    clearDetail: vi.fn(),
    setStatus: vi.fn(async () => true),
    addNote: vi.fn(async () => true),
    editNote: vi.fn(async () => true),
    removeNote: vi.fn(async () => true),
    uploadFile: vi.fn(async () => true),
    downloadFile: vi.fn(async () => true),
    removeAttachment: vi.fn(async () => true),
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  mockedUseCustomersStore.mockReturnValue(store as any);

  return store;
}

async function mountView() {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/customers/:id', name: 'customer-detail', component: CustomerDetailView },
      { path: '/customers/:id/edit', name: 'customer-edit', component: { template: '<div />' } },
    ],
  });

  router.push('/customers/c-1');
  await router.isReady();

  const wrapper = mount(CustomerDetailView, { global: { plugins: [router, createPinia()] } });
  await wrapper.vm.$nextTick();

  return wrapper;
}

describe('CustomerDetailView', () => {
  it('renders the customer name, status badge, and — for null contact fields', async () => {
    mockAuth(['customers:read']);
    mockCustomers();
    const wrapper = await mountView();

    expect(wrapper.text()).toContain('Orten Trading');
    expect(wrapper.text()).toContain('Active');
    expect(wrapper.text()).toContain('—');
  });

  it('renders only the error block when error is set and current is null', async () => {
    mockAuth(['customers:read']);
    mockCustomers({ current: null, error: 'No such customer.' });
    const wrapper = await mountView();

    expect(wrapper.find('[role="alert"]').text()).toBe('No such customer.');
    expect(wrapper.find('.customer-detail__tabs').exists()).toBe(false);
  });

  it('switches tabs so only the active panel is in the DOM', async () => {
    mockAuth(['customers:read']);
    mockCustomers();
    const wrapper = await mountView();

    expect(wrapper.text()).toContain('No notes yet.');

    const tabs = wrapper.findAll('[role="tab"]');
    await tabs[1].trigger('click');
    expect(wrapper.text()).toContain('No attachments yet.');
    expect(wrapper.text()).not.toContain('No notes yet.');

    await tabs[2].trigger('click');
    expect(wrapper.text()).toContain('current history');
    expect(wrapper.text()).not.toContain('No attachments yet.');
  });

  it('omits the note form without notes:write', async () => {
    mockAuth(['customers:read']);
    mockCustomers();
    const wrapper = await mountView();

    expect(wrapper.find('textarea').exists()).toBe(false);
  });

  it('shows the note form with notes:write', async () => {
    mockAuth(['customers:read', 'notes:write']);
    mockCustomers();
    const wrapper = await mountView();

    expect(wrapper.find('textarea').exists()).toBe(true);
  });

  it('shows note Edit/Delete controls only for the note author', async () => {
    mockAuth(['customers:read', 'notes:write'], 'u-1');
    const ownNote: CustomerNote = {
      id: 'n-1',
      customerId: 'c-1',
      author: { id: 'u-1', fullName: 'Me', email: 'me@crm.local' },
      body: 'Mine',
      createdAt: '2026-08-25T00:00:00.000Z',
      updatedAt: '2026-08-25T00:00:00.000Z',
    };
    const othersNote: CustomerNote = {
      id: 'n-2',
      customerId: 'c-1',
      author: { id: 'u-2', fullName: 'Someone else', email: 'other@crm.local' },
      body: 'Theirs',
      createdAt: '2026-08-25T00:00:00.000Z',
      updatedAt: '2026-08-25T00:00:00.000Z',
    };
    mockCustomers({ notes: [ownNote, othersNote] });
    const wrapper = await mountView();

    const items = wrapper.findAll('.customer-detail__note');
    expect(items[0].findAll('button').map((b) => b.text())).toEqual(['Edit', 'Delete']);
    expect(items[1].findAll('button')).toHaveLength(0);
  });

  it('deletes a note only when window.confirm is stubbed true', async () => {
    mockAuth(['customers:read', 'notes:write'], 'u-1');
    const ownNote: CustomerNote = {
      id: 'n-1',
      customerId: 'c-1',
      author: { id: 'u-1', fullName: 'Me', email: 'me@crm.local' },
      body: 'Mine',
      createdAt: '2026-08-25T00:00:00.000Z',
      updatedAt: '2026-08-25T00:00:00.000Z',
    };
    const store = mockCustomers({ notes: [ownNote] });
    const wrapper = await mountView();

    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);
    const deleteButton = wrapper.findAll('.customer-detail__note button').find((b) => b.text() === 'Delete')!;
    await deleteButton.trigger('click');
    expect(store.removeNote).not.toHaveBeenCalled();

    confirmSpy.mockReturnValue(true);
    await deleteButton.trigger('click');
    expect(store.removeNote).toHaveBeenCalledWith('c-1', 'n-1');
  });

  it('omits the upload control without attachments:write but always shows Download', async () => {
    mockAuth(['customers:read']);
    mockCustomers({
      attachments: [
        {
          id: 'a-1',
          customerId: 'c-1',
          fileName: 'contract.pdf',
          mimeType: 'application/pdf',
          sizeBytes: 2048,
          checksumSha256: 'abc',
          uploadedBy: { id: 'u-1', fullName: 'Me', email: 'me@crm.local' },
          createdAt: '2026-08-25T00:00:00.000Z',
        },
      ],
    });
    const wrapper = await mountView();

    const tabs = wrapper.findAll('[role="tab"]');
    await tabs[1].trigger('click');

    expect(wrapper.find('input[type="file"]').exists()).toBe(false);
    const buttons = wrapper.findAll('.customer-detail__attachment button').map((b) => b.text());
    expect(buttons).toEqual(['Download']);
  });

  it('renders the shared CommunicationTimeline with the customer and its contact details', async () => {
    mockAuth(['customers:read', 'interactions:write']);
    mockCustomers();
    const wrapper = await mountView();

    const tabs = wrapper.findAll('[role="tab"]');
    await tabs[2].trigger('click');

    const timeline = wrapper.findComponent({ name: 'CommunicationTimeline' });

    expect(timeline.exists()).toBe(true);
    expect(timeline.props('customerId')).toBe('c-1');
    expect(timeline.props('customerContact')).toEqual({
      email: 'contact@orten.example',
      phone: '+20 100 000 0000',
    });
    // There is no second, hand-rolled list any more.
    expect(wrapper.find('.customer-detail__interaction-form').exists()).toBe(false);
  });

  it('keeps the ticketing note beside the timeline', async () => {
    mockAuth(['customers:read']);
    mockCustomers();
    const wrapper = await mountView();

    const tabs = wrapper.findAll('[role="tab"]');
    await tabs[2].trigger('click');

    expect(wrapper.find('.customers__muted').exists()).toBe(true);
  });

  it('omits ARCHIVED from the status select without customers:archive and includes it with', async () => {
    mockAuth(['customers:read', 'customers:write']);
    mockCustomers();
    const wrapper = await mountView();

    const optionsWithout = wrapper.find('.customer-detail__controls select').findAll('option').map((o) => o.text());
    expect(optionsWithout).not.toContain('Archived');

    mockedUseAuthStore.mockReset();
    mockAuth(['customers:read', 'customers:write', 'customers:archive']);
    const wrapperWith = await mountView();
    const optionsWith = wrapperWith
      .find('.customer-detail__controls select')
      .findAll('option')
      .map((o) => o.text());
    expect(optionsWith).toContain('Archived');
  });

  it('disables the status select for an already-archived customer without customers:archive', async () => {
    mockAuth(['customers:read', 'customers:write']);
    mockCustomers({ current: { ...sampleCustomer, status: 'ARCHIVED' } });
    const wrapper = await mountView();

    const select = wrapper.find('.customer-detail__controls select');
    expect(select.attributes('disabled')).toBeDefined();
  });

  it('renders the ticketing note in the History tab', async () => {
    mockAuth(['customers:read']);
    mockCustomers();
    const wrapper = await mountView();

    const tabs = wrapper.findAll('[role="tab"]');
    await tabs[2].trigger('click');

    expect(wrapper.text()).toContain(
      'Support tickets will appear in this timeline once ticketing ships.',
    );
  });

  it('calls clearDetail on unmount', async () => {
    mockAuth(['customers:read']);
    const store = mockCustomers();
    const wrapper = await mountView();

    wrapper.unmount();

    expect(store.clearDetail).toHaveBeenCalledTimes(1);
  });
});
