import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { useCustomersStore } from './customers';
import {
  createCustomer,
  createNote,
  deleteAttachment,
  deleteNote,
  downloadAttachment,
  getCustomer,
  listAttachments,
  listCustomers,
  listNotes,
  setCustomerStatus,
  updateCustomer,
  updateNote,
  uploadAttachment,
  type Customer,
  type CustomerAttachment,
  type CustomerNote,
  type PaginatedCustomers,
} from '@/api/customers';
import { listAgents, type UserSummary } from '@/api/users';

vi.mock('@/api/customers', () => ({
  listCustomers: vi.fn(),
  getCustomer: vi.fn(),
  createCustomer: vi.fn(),
  updateCustomer: vi.fn(),
  setCustomerStatus: vi.fn(),
  listNotes: vi.fn(),
  createNote: vi.fn(),
  updateNote: vi.fn(),
  deleteNote: vi.fn(),
  listAttachments: vi.fn(),
  uploadAttachment: vi.fn(),
  downloadAttachment: vi.fn(),
  deleteAttachment: vi.fn(),
}));

vi.mock('@/api/users', () => ({
  listAgents: vi.fn(),
}));

const mockedListCustomers = vi.mocked(listCustomers);
const mockedGetCustomer = vi.mocked(getCustomer);
const mockedCreateCustomer = vi.mocked(createCustomer);
const mockedUpdateCustomer = vi.mocked(updateCustomer);
const mockedSetCustomerStatus = vi.mocked(setCustomerStatus);
const mockedListNotes = vi.mocked(listNotes);
const mockedCreateNote = vi.mocked(createNote);
const mockedUpdateNote = vi.mocked(updateNote);
const mockedDeleteNote = vi.mocked(deleteNote);
const mockedListAttachments = vi.mocked(listAttachments);
const mockedUploadAttachment = vi.mocked(uploadAttachment);
const mockedDownloadAttachment = vi.mocked(downloadAttachment);
const mockedDeleteAttachment = vi.mocked(deleteAttachment);
const mockedListAgents = vi.mocked(listAgents);

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
  country: 'Egypt',
  postalCode: null,
  status: 'ACTIVE',
  assignedAgent: null,
  createdBy: null,
  counts: { notes: 0, attachments: 0, interactions: 0 },
  createdAt: '2026-08-25T00:00:00.000Z',
  updatedAt: '2026-08-25T00:00:00.000Z',
};

const samplePage: PaginatedCustomers = {
  items: [sampleCustomer],
  meta: { page: 1, pageSize: 20, total: 1, totalPages: 1 },
};

const sampleNote: CustomerNote = {
  id: 'n-1',
  customerId: 'c-1',
  author: { id: 'u-1', fullName: 'Nour Hassan', email: 'nour@crm.local' },
  body: 'Called back',
  createdAt: '2026-08-25T00:00:00.000Z',
  updatedAt: '2026-08-25T00:00:00.000Z',
};

const sampleAttachment: CustomerAttachment = {
  id: 'a-1',
  customerId: 'c-1',
  fileName: 'contract.pdf',
  mimeType: 'application/pdf',
  sizeBytes: 1024,
  checksumSha256: 'abc',
  uploadedBy: { id: 'u-1', fullName: 'Nour Hassan', email: 'nour@crm.local' },
  createdAt: '2026-08-25T00:00:00.000Z',
};

const sampleAgent: UserSummary = {
  id: 'u-1',
  email: 'agent@crm.local',
  fullName: 'Nour Hassan',
  isActive: true,
  mustChangePassword: false,
  department: null,
  branch: null,
  roles: ['support-agent'],
  lastLoginAt: null,
  createdAt: '2026-08-25T00:00:00.000Z',
};

describe('useCustomersStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
  });

  it('load populates items and meta', async () => {
    mockedListCustomers.mockResolvedValue(samplePage);
    const store = useCustomersStore();

    await store.load();

    expect(store.items).toEqual([sampleCustomer]);
    expect(store.meta).toEqual(samplePage.meta);
    expect(store.error).toBeNull();
  });

  it('a rejection sets error and clears items and meta', async () => {
    mockedListCustomers.mockResolvedValueOnce(samplePage);
    const store = useCustomersStore();
    await store.load();
    expect(store.items).toHaveLength(1);

    mockedListCustomers.mockRejectedValueOnce(new Error('network down'));
    await store.load();

    expect(store.items).toEqual([]);
    expect(store.meta).toBeNull();
    expect(store.error).toBe('network down');
  });

  it('currentParams omits every empty filter', async () => {
    mockedListCustomers.mockResolvedValue(samplePage);
    const store = useCustomersStore();

    await store.load();

    // Present as keys with `undefined` values on the in-memory object — axios's
    // paramsSerializer drops those before they ever reach the querystring.
    const params = mockedListCustomers.mock.calls[0][0];
    expect(params.status).toBeUndefined();
    expect(params.type).toBeUndefined();
    expect(params.search).toBeUndefined();
    expect(params.city).toBeUndefined();
  });

  it('setSearch, setStatusFilter, and setTypeFilter reset the page to 1', async () => {
    mockedListCustomers.mockResolvedValue(samplePage);
    const store = useCustomersStore();
    store.filters.page = 3;

    store.setSearch('orten');
    await Promise.resolve();
    expect(store.filters.page).toBe(1);

    store.filters.page = 3;
    store.setStatusFilter('ACTIVE');
    await Promise.resolve();
    expect(store.filters.page).toBe(1);

    store.filters.page = 3;
    store.setTypeFilter('COMPANY');
    await Promise.resolve();
    expect(store.filters.page).toBe(1);
  });

  it('setSort sets the field ascending and resets page to 1', async () => {
    mockedListCustomers.mockResolvedValue(samplePage);
    const store = useCustomersStore();
    store.filters.page = 3;

    store.setSort('name');
    await Promise.resolve();

    expect(store.filters.sort).toBe('name');
    expect(store.filters.order).toBe('asc');
    expect(store.filters.page).toBe(1);
  });

  it('setSort on the active field flips the direction', async () => {
    mockedListCustomers.mockResolvedValue(samplePage);
    const store = useCustomersStore();
    store.setSort('name');
    await Promise.resolve();

    store.setSort('name');
    await Promise.resolve();

    expect(store.filters.order).toBe('desc');
  });

  it('setSort on a new field resets the direction to asc', async () => {
    mockedListCustomers.mockResolvedValue(samplePage);
    const store = useCustomersStore();
    store.setSort('name');
    await Promise.resolve();
    store.setSort('name');
    await Promise.resolve();
    expect(store.filters.order).toBe('desc');

    store.setSort('createdAt');
    await Promise.resolve();

    expect(store.filters.sort).toBe('createdAt');
    expect(store.filters.order).toBe('asc');
  });

  it('setPageSize resets page to 1', async () => {
    mockedListCustomers.mockResolvedValue(samplePage);
    const store = useCustomersStore();
    store.filters.page = 3;

    store.setPageSize(50);
    await Promise.resolve();

    expect(store.filters.pageSize).toBe(50);
    expect(store.filters.page).toBe(1);
  });

  it('currentParams omits sort and order when sort is empty', async () => {
    mockedListCustomers.mockResolvedValue(samplePage);
    const store = useCustomersStore();

    await store.load();

    const params = mockedListCustomers.mock.calls[0][0];
    expect(params.sort).toBeUndefined();
    expect(params.order).toBeUndefined();
  });

  it('currentParams omits order when sort is empty but order is set', async () => {
    mockedListCustomers.mockResolvedValue(samplePage);
    const store = useCustomersStore();
    store.filters.order = 'desc';

    await store.load();

    const params = mockedListCustomers.mock.calls[0][0];
    expect(params.sort).toBeUndefined();
    expect(params.order).toBeUndefined();
  });

  it('the latestRequestId guard discards a slower earlier response', async () => {
    const store = useCustomersStore();

    let resolveFirst: (value: PaginatedCustomers) => void;
    let resolveSecond: (value: PaginatedCustomers) => void;

    mockedListCustomers
      .mockImplementationOnce(
        () => new Promise((resolve) => { resolveFirst = resolve; }),
      )
      .mockImplementationOnce(
        () => new Promise((resolve) => { resolveSecond = resolve; }),
      );

    const firstLoad = store.load();
    const secondLoad = store.load();

    const secondPage: PaginatedCustomers = {
      items: [{ ...sampleCustomer, id: 'c-2', name: 'Second' }],
      meta: { page: 1, pageSize: 20, total: 1, totalPages: 1 },
    };

    resolveSecond!(secondPage);
    await secondLoad;
    resolveFirst!(samplePage);
    await firstLoad;

    expect(store.items).toEqual(secondPage.items);
  });

  it('loadDetail populates current, notes, attachments, and interactions', async () => {
    mockedGetCustomer.mockResolvedValue(sampleCustomer);
    mockedListNotes.mockResolvedValue([sampleNote]);
    mockedListAttachments.mockResolvedValue([sampleAttachment]);

    const store = useCustomersStore();
    await store.loadDetail('c-1');

    expect(store.current).toEqual(sampleCustomer);
    expect(store.notes).toEqual([sampleNote]);
    expect(store.attachments).toEqual([sampleAttachment]);
    // The interaction slice moved out: CommunicationTimeline fetches its own
    // rows, so a second copy here would be the two-owners staleness bug.
    expect(mockedGetCustomer).toHaveBeenCalledTimes(1);
    expect(mockedListNotes).toHaveBeenCalledTimes(1);
    expect(mockedListAttachments).toHaveBeenCalledTimes(1);
  });

  it('loadDetail leaves current null and sets error on rejection', async () => {
    mockedGetCustomer.mockRejectedValue(new Error('not found'));
    mockedListNotes.mockResolvedValue([]);
    mockedListAttachments.mockResolvedValue([]);

    const store = useCustomersStore();
    await store.loadDetail('missing');

    expect(store.current).toBeNull();
    expect(store.error).toBe('not found');
  });

  it('loadAgents failing leaves error null and agents empty', async () => {
    mockedListAgents.mockRejectedValue(new Error('forbidden'));
    const store = useCustomersStore();

    await store.loadAgents();

    expect(store.error).toBeNull();
    expect(store.agents).toEqual([]);
  });

  it('loadAgents populates agents on success', async () => {
    mockedListAgents.mockResolvedValue([sampleAgent]);
    const store = useCustomersStore();

    await store.loadAgents();

    expect(store.agents).toEqual([sampleAgent]);
  });

  it('create returns the new id on success and null on failure', async () => {
    const store = useCustomersStore();

    mockedCreateCustomer.mockResolvedValueOnce(sampleCustomer);
    const id = await store.create({ name: 'Orten Trading' });
    expect(id).toBe('c-1');

    mockedCreateCustomer.mockRejectedValueOnce(new Error('email taken'));
    const failedId = await store.create({ name: 'Orten Trading' });
    expect(failedId).toBeNull();
    expect(store.error).toBe('email taken');
  });

  it('update calls loadDetail again on success and not on failure', async () => {
    mockedGetCustomer.mockResolvedValue(sampleCustomer);
    mockedListNotes.mockResolvedValue([]);
    mockedListAttachments.mockResolvedValue([]);

    const store = useCustomersStore();

    mockedUpdateCustomer.mockResolvedValueOnce(sampleCustomer);
    const ok = await store.update('c-1', { name: 'Orten' });
    expect(ok).toBe(true);
    expect(store.current).toEqual(sampleCustomer);

    mockedUpdateCustomer.mockRejectedValueOnce(new Error('conflict'));
    const fail = await store.update('c-1', { name: 'Orten' });
    expect(fail).toBe(false);
    expect(store.error).toBe('conflict');
  });

  it('setStatus calls loadDetail again on success and not on failure', async () => {
    mockedGetCustomer.mockResolvedValue(sampleCustomer);
    mockedListNotes.mockResolvedValue([]);
    mockedListAttachments.mockResolvedValue([]);

    const store = useCustomersStore();

    mockedSetCustomerStatus.mockResolvedValueOnce(sampleCustomer);
    const ok = await store.setStatus('c-1', 'ACTIVE');
    expect(ok).toBe(true);

    mockedSetCustomerStatus.mockRejectedValueOnce(new Error('needs customers:archive'));
    const fail = await store.setStatus('c-1', 'ARCHIVED');
    expect(fail).toBe(false);
    expect(store.error).toBe('needs customers:archive');
  });

  it('addNote refreshes notes and current; on failure it does neither', async () => {
    mockedGetCustomer.mockResolvedValue({ ...sampleCustomer, counts: { notes: 1, attachments: 0, interactions: 0 } });
    mockedListNotes.mockResolvedValue([sampleNote]);
    const store = useCustomersStore();

    mockedCreateNote.mockResolvedValueOnce(sampleNote);
    const ok = await store.addNote('c-1', { body: 'Called back' });

    expect(ok).toBe(true);
    expect(store.notes).toEqual([sampleNote]);
    expect(store.current?.counts.notes).toBe(1);

    mockedCreateNote.mockRejectedValueOnce(new Error('boom'));
    const fail = await store.addNote('c-1', { body: 'Another' });

    expect(fail).toBe(false);
    expect(mockedListNotes).toHaveBeenCalledTimes(1);
  });

  it('editNote refreshes notes on success and not on failure', async () => {
    mockedListNotes.mockResolvedValue([sampleNote]);
    const store = useCustomersStore();

    mockedUpdateNote.mockResolvedValueOnce(sampleNote);
    const ok = await store.editNote('c-1', 'n-1', { body: 'Edited' });
    expect(ok).toBe(true);
    expect(store.notes).toEqual([sampleNote]);

    mockedUpdateNote.mockRejectedValueOnce(new Error('forbidden'));
    const fail = await store.editNote('c-1', 'n-1', { body: 'Edited again' });
    expect(fail).toBe(false);
  });

  it('removeNote refreshes notes and current on success', async () => {
    mockedGetCustomer.mockResolvedValue(sampleCustomer);
    mockedListNotes.mockResolvedValue([]);
    mockedDeleteNote.mockResolvedValueOnce(undefined);
    const store = useCustomersStore();

    const ok = await store.removeNote('c-1', 'n-1');

    expect(ok).toBe(true);
    expect(store.notes).toEqual([]);
  });

  it('uploadFile refreshes attachments and current on success', async () => {
    mockedGetCustomer.mockResolvedValue(sampleCustomer);
    mockedListAttachments.mockResolvedValue([sampleAttachment]);
    mockedUploadAttachment.mockResolvedValueOnce(sampleAttachment);
    const store = useCustomersStore();

    const file = new File(['x'], 'contract.pdf', { type: 'application/pdf' });
    const ok = await store.uploadFile('c-1', file);

    expect(ok).toBe(true);
    expect(store.attachments).toEqual([sampleAttachment]);
  });

  it('downloadFile delegates to the api layer', async () => {
    mockedDownloadAttachment.mockResolvedValueOnce(undefined);
    const store = useCustomersStore();

    const ok = await store.downloadFile('c-1', sampleAttachment);

    expect(ok).toBe(true);
    expect(mockedDownloadAttachment).toHaveBeenCalledWith('c-1', sampleAttachment);
  });

  it('removeAttachment refreshes attachments and current on success', async () => {
    mockedGetCustomer.mockResolvedValue(sampleCustomer);
    mockedListAttachments.mockResolvedValue([]);
    mockedDeleteAttachment.mockResolvedValueOnce(undefined);
    const store = useCustomersStore();

    const ok = await store.removeAttachment('c-1', 'a-1');

    expect(ok).toBe(true);
    expect(store.attachments).toEqual([]);
  });

  it('clearDetail empties current and both remaining collections', async () => {
    mockedGetCustomer.mockResolvedValue(sampleCustomer);
    mockedListNotes.mockResolvedValue([sampleNote]);
    mockedListAttachments.mockResolvedValue([sampleAttachment]);

    const store = useCustomersStore();
    await store.loadDetail('c-1');

    store.clearDetail();

    expect(store.current).toBeNull();
    expect(store.notes).toEqual([]);
    expect(store.attachments).toEqual([]);
    expect(store.error).toBeNull();
  });
});
