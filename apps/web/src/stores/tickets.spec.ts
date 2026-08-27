import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { useTicketsStore } from './tickets';
import {
  createComment,
  createTicket,
  deleteComment,
  deleteTicketAttachment,
  downloadTicketAttachment,
  getTicket,
  listComments,
  listTicketAttachments,
  listTicketHistory,
  listTickets,
  setTicketStatus,
  updateComment,
  updateTicket,
  uploadTicketAttachment,
  type PaginatedTickets,
  type Ticket,
  type TicketAttachment,
  type TicketComment,
  type TicketHistoryEntry,
} from '@/api/tickets';
import { listAgents, type UserSummary } from '@/api/users';
import { listCustomerRefs, type CustomerRefOption } from '@/api/customers';

vi.mock('@/api/tickets', () => ({
  listTickets: vi.fn(),
  getTicket: vi.fn(),
  createTicket: vi.fn(),
  updateTicket: vi.fn(),
  setTicketStatus: vi.fn(),
  listComments: vi.fn(),
  createComment: vi.fn(),
  updateComment: vi.fn(),
  deleteComment: vi.fn(),
  listTicketAttachments: vi.fn(),
  uploadTicketAttachment: vi.fn(),
  downloadTicketAttachment: vi.fn(),
  deleteTicketAttachment: vi.fn(),
  listTicketHistory: vi.fn(),
}));

vi.mock('@/api/users', () => ({
  listAgents: vi.fn(),
}));

vi.mock('@/api/customers', () => ({
  listCustomerRefs: vi.fn(),
}));

const mockedListTickets = vi.mocked(listTickets);
const mockedGetTicket = vi.mocked(getTicket);
const mockedCreateTicket = vi.mocked(createTicket);
const mockedUpdateTicket = vi.mocked(updateTicket);
const mockedSetTicketStatus = vi.mocked(setTicketStatus);
const mockedListComments = vi.mocked(listComments);
const mockedCreateComment = vi.mocked(createComment);
const mockedUpdateComment = vi.mocked(updateComment);
const mockedDeleteComment = vi.mocked(deleteComment);
const mockedListTicketAttachments = vi.mocked(listTicketAttachments);
const mockedUploadTicketAttachment = vi.mocked(uploadTicketAttachment);
const mockedDownloadTicketAttachment = vi.mocked(downloadTicketAttachment);
const mockedDeleteTicketAttachment = vi.mocked(deleteTicketAttachment);
const mockedListTicketHistory = vi.mocked(listTicketHistory);
const mockedListAgents = vi.mocked(listAgents);
const mockedListCustomerRefs = vi.mocked(listCustomerRefs);

const sampleTicket: Ticket = {
  id: 't-1',
  customer: { id: 'c-1', name: 'Orten Trading', email: 'contact@orten.example' },
  subject: 'Cannot log in',
  description: 'After password reset, login fails.',
  category: 'GENERAL',
  priority: 'MEDIUM',
  status: 'OPEN',
  assignedAgent: null,
  createdBy: null,
  counts: { comments: 0, attachments: 0, history: 0 },
  createdAt: '2026-08-25T00:00:00.000Z',
  updatedAt: '2026-08-25T00:00:00.000Z',
};

const samplePage: PaginatedTickets = {
  items: [sampleTicket],
  meta: { page: 1, pageSize: 20, total: 1, totalPages: 1 },
};

const sampleComment: TicketComment = {
  id: 'cm-1',
  ticketId: 't-1',
  author: { id: 'u-1', fullName: 'Nour Hassan', email: 'nour@crm.local' },
  body: 'Called back',
  createdAt: '2026-08-25T00:00:00.000Z',
  updatedAt: '2026-08-25T00:00:00.000Z',
};

const sampleAttachment: TicketAttachment = {
  id: 'a-1',
  ticketId: 't-1',
  fileName: 'screenshot.png',
  mimeType: 'image/png',
  sizeBytes: 1024,
  checksumSha256: 'abc',
  uploadedBy: { id: 'u-1', fullName: 'Nour Hassan', email: 'nour@crm.local' },
  createdAt: '2026-08-25T00:00:00.000Z',
};

const sampleHistory: TicketHistoryEntry = {
  id: 'h-1',
  ticketId: 't-1',
  field: 'status',
  oldValue: 'OPEN',
  newValue: 'IN_PROGRESS',
  changedBy: { id: 'u-1', fullName: 'Nour Hassan', email: 'nour@crm.local' },
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

const sampleCustomerOption: CustomerRefOption = { id: 'c-1', name: 'Orten Trading', email: 'contact@orten.example' };

describe('useTicketsStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
  });

  it('load populates items and meta', async () => {
    mockedListTickets.mockResolvedValue(samplePage);
    const store = useTicketsStore();

    await store.load();

    expect(store.items).toEqual([sampleTicket]);
    expect(store.meta).toEqual(samplePage.meta);
    expect(store.error).toBeNull();
  });

  it('a rejection sets error and clears items and meta', async () => {
    mockedListTickets.mockResolvedValueOnce(samplePage);
    const store = useTicketsStore();
    await store.load();
    expect(store.items).toHaveLength(1);

    mockedListTickets.mockRejectedValueOnce(new Error('network down'));
    await store.load();

    expect(store.items).toEqual([]);
    expect(store.meta).toBeNull();
    expect(store.error).toBe('network down');
  });

  it('currentParams omits every empty filter', async () => {
    mockedListTickets.mockResolvedValue(samplePage);
    const store = useTicketsStore();

    await store.load();

    const params = mockedListTickets.mock.calls[0][0];
    expect(params.search).toBeUndefined();
    expect(params.category).toBeUndefined();
    expect(params.priority).toBeUndefined();
    expect(params.status).toBeUndefined();
    expect(params.assignedAgentId).toBeUndefined();
  });

  it('setSearch resets the page to 1', async () => {
    mockedListTickets.mockResolvedValue(samplePage);
    const store = useTicketsStore();
    store.filters.page = 3;

    store.setSearch('login');
    await Promise.resolve();
    expect(store.filters.page).toBe(1);
  });

  it('setCategoryFilter, setPriorityFilter, setStatusFilter, and setAssignedAgentFilter reset the page to 1', async () => {
    mockedListTickets.mockResolvedValue(samplePage);
    const store = useTicketsStore();

    store.filters.page = 3;
    store.setCategoryFilter('TECHNICAL');
    await Promise.resolve();
    expect(store.filters.page).toBe(1);

    store.filters.page = 3;
    store.setPriorityFilter('HIGH');
    await Promise.resolve();
    expect(store.filters.page).toBe(1);

    store.filters.page = 3;
    store.setStatusFilter('OPEN');
    await Promise.resolve();
    expect(store.filters.page).toBe(1);

    store.filters.page = 3;
    store.setAssignedAgentFilter('u-1');
    await Promise.resolve();
    expect(store.filters.page).toBe(1);
  });

  it('setSort sets the field ascending and resets page to 1', async () => {
    mockedListTickets.mockResolvedValue(samplePage);
    const store = useTicketsStore();
    store.filters.page = 3;

    store.setSort('subject');
    await Promise.resolve();

    expect(store.filters.sort).toBe('subject');
    expect(store.filters.order).toBe('asc');
    expect(store.filters.page).toBe(1);
  });

  it('setSort on the active field flips the direction', async () => {
    mockedListTickets.mockResolvedValue(samplePage);
    const store = useTicketsStore();
    store.setSort('subject');
    await Promise.resolve();

    store.setSort('subject');
    await Promise.resolve();

    expect(store.filters.order).toBe('desc');
  });

  it('setSort on a new field resets the direction to asc', async () => {
    mockedListTickets.mockResolvedValue(samplePage);
    const store = useTicketsStore();
    store.setSort('subject');
    await Promise.resolve();
    store.setSort('subject');
    await Promise.resolve();
    expect(store.filters.order).toBe('desc');

    store.setSort('createdAt');
    await Promise.resolve();

    expect(store.filters.sort).toBe('createdAt');
    expect(store.filters.order).toBe('asc');
  });

  it('setPageSize resets page to 1', async () => {
    mockedListTickets.mockResolvedValue(samplePage);
    const store = useTicketsStore();
    store.filters.page = 3;

    store.setPageSize(50);
    await Promise.resolve();

    expect(store.filters.pageSize).toBe(50);
    expect(store.filters.page).toBe(1);
  });

  it('currentParams omits sort and order when sort is empty', async () => {
    mockedListTickets.mockResolvedValue(samplePage);
    const store = useTicketsStore();

    await store.load();

    const params = mockedListTickets.mock.calls[0][0];
    expect(params.sort).toBeUndefined();
    expect(params.order).toBeUndefined();
  });

  it('currentParams omits order when sort is empty but order is set', async () => {
    mockedListTickets.mockResolvedValue(samplePage);
    const store = useTicketsStore();
    store.filters.order = 'asc';

    await store.load();

    const params = mockedListTickets.mock.calls[0][0];
    expect(params.sort).toBeUndefined();
    expect(params.order).toBeUndefined();
  });

  it('the latestRequestId guard discards a slower earlier response', async () => {
    const store = useTicketsStore();

    let resolveFirst: (value: PaginatedTickets) => void;
    let resolveSecond: (value: PaginatedTickets) => void;

    mockedListTickets
      .mockImplementationOnce(() => new Promise((resolve) => { resolveFirst = resolve; }))
      .mockImplementationOnce(() => new Promise((resolve) => { resolveSecond = resolve; }));

    const firstLoad = store.load();
    const secondLoad = store.load();

    const secondPage: PaginatedTickets = {
      items: [{ ...sampleTicket, id: 't-2', subject: 'Second' }],
      meta: { page: 1, pageSize: 20, total: 1, totalPages: 1 },
    };

    resolveSecond!(secondPage);
    await secondLoad;
    resolveFirst!(samplePage);
    await firstLoad;

    expect(store.items).toEqual(secondPage.items);
  });

  it('loadDetail populates current, comments, attachments, and history', async () => {
    mockedGetTicket.mockResolvedValue(sampleTicket);
    mockedListComments.mockResolvedValue([sampleComment]);
    mockedListTicketAttachments.mockResolvedValue([sampleAttachment]);
    mockedListTicketHistory.mockResolvedValue([sampleHistory]);

    const store = useTicketsStore();
    await store.loadDetail('t-1');

    expect(store.current).toEqual(sampleTicket);
    expect(store.comments).toEqual([sampleComment]);
    expect(store.attachments).toEqual([sampleAttachment]);
    expect(store.history).toEqual([sampleHistory]);
  });

  it('loadDetail leaves current null and sets error on rejection', async () => {
    mockedGetTicket.mockRejectedValue(new Error('not found'));
    mockedListComments.mockResolvedValue([]);
    mockedListTicketAttachments.mockResolvedValue([]);
    mockedListTicketHistory.mockResolvedValue([]);

    const store = useTicketsStore();
    await store.loadDetail('missing');

    expect(store.current).toBeNull();
    expect(store.error).toBe('not found');
  });

  it('the separate latestDetailRequestId guard discards a slower earlier detail response', async () => {
    const store = useTicketsStore();
    mockedListComments.mockResolvedValue([]);
    mockedListTicketAttachments.mockResolvedValue([]);
    mockedListTicketHistory.mockResolvedValue([]);

    let resolveFirst: (value: Ticket) => void;
    let resolveSecond: (value: Ticket) => void;

    mockedGetTicket
      .mockImplementationOnce(() => new Promise((resolve) => { resolveFirst = resolve; }))
      .mockImplementationOnce(() => new Promise((resolve) => { resolveSecond = resolve; }));

    const firstLoad = store.loadDetail('t-1');
    const secondLoad = store.loadDetail('t-2');

    resolveSecond!({ ...sampleTicket, id: 't-2' });
    await secondLoad;
    resolveFirst!(sampleTicket);
    await firstLoad;

    expect(store.current?.id).toBe('t-2');
  });

  it('loadAgents swallows a rejection into an empty array', async () => {
    mockedListAgents.mockRejectedValue(new Error('forbidden'));
    const store = useTicketsStore();

    await store.loadAgents();

    expect(store.error).toBeNull();
    expect(store.agents).toEqual([]);
  });

  it('loadCustomerOptions swallows a rejection into an empty array', async () => {
    mockedListCustomerRefs.mockRejectedValue(new Error('forbidden'));
    const store = useTicketsStore();

    await store.loadCustomerOptions();

    expect(store.error).toBeNull();
    expect(store.customerOptions).toEqual([]);
  });

  it('loadCustomerOptions populates customerOptions on success', async () => {
    mockedListCustomerRefs.mockResolvedValue([sampleCustomerOption]);
    const store = useTicketsStore();

    await store.loadCustomerOptions();

    expect(store.customerOptions).toEqual([sampleCustomerOption]);
  });

  it('create returns the new id on success and null on failure', async () => {
    const store = useTicketsStore();

    mockedCreateTicket.mockResolvedValueOnce(sampleTicket);
    const id = await store.create({ customerId: 'c-1', subject: 'Cannot log in', description: 'Details' });
    expect(id).toBe('t-1');

    mockedCreateTicket.mockRejectedValueOnce(new Error('unknown customerId'));
    const failedId = await store.create({ customerId: 'bad', subject: 'x', description: 'y' });
    expect(failedId).toBeNull();
    expect(store.error).toBe('unknown customerId');
  });

  it('update calls loadDetail again on success and not on failure', async () => {
    mockedGetTicket.mockResolvedValue(sampleTicket);
    mockedListComments.mockResolvedValue([]);
    mockedListTicketAttachments.mockResolvedValue([]);
    mockedListTicketHistory.mockResolvedValue([]);

    const store = useTicketsStore();

    mockedUpdateTicket.mockResolvedValueOnce(sampleTicket);
    const ok = await store.update('t-1', { subject: 'Updated' });
    expect(ok).toBe(true);
    expect(store.current).toEqual(sampleTicket);

    mockedUpdateTicket.mockRejectedValueOnce(new Error('validation failed'));
    const fail = await store.update('t-1', { subject: 'x' });
    expect(fail).toBe(false);
    expect(store.error).toBe('validation failed');
  });

  it('setStatus calls loadDetail again on success and not on failure', async () => {
    mockedGetTicket.mockResolvedValue(sampleTicket);
    mockedListComments.mockResolvedValue([]);
    mockedListTicketAttachments.mockResolvedValue([]);
    mockedListTicketHistory.mockResolvedValue([]);

    const store = useTicketsStore();

    mockedSetTicketStatus.mockResolvedValueOnce(sampleTicket);
    const ok = await store.setStatus('t-1', 'IN_PROGRESS');
    expect(ok).toBe(true);

    mockedSetTicketStatus.mockRejectedValueOnce(new Error('boom'));
    const fail = await store.setStatus('t-1', 'CLOSED');
    expect(fail).toBe(false);
    expect(store.error).toBe('boom');
  });

  it('addComment refreshes comments and current; on failure it does neither', async () => {
    mockedGetTicket.mockResolvedValue({ ...sampleTicket, counts: { comments: 1, attachments: 0, history: 0 } });
    mockedListComments.mockResolvedValue([sampleComment]);
    const store = useTicketsStore();

    mockedCreateComment.mockResolvedValueOnce(sampleComment);
    const ok = await store.addComment('t-1', { body: 'Called back' });

    expect(ok).toBe(true);
    expect(store.comments).toEqual([sampleComment]);
    expect(store.current?.counts.comments).toBe(1);

    mockedCreateComment.mockRejectedValueOnce(new Error('boom'));
    const fail = await store.addComment('t-1', { body: 'Another' });

    expect(fail).toBe(false);
    expect(mockedListComments).toHaveBeenCalledTimes(1);
  });

  it('editComment refreshes comments on success and not on failure', async () => {
    mockedListComments.mockResolvedValue([sampleComment]);
    const store = useTicketsStore();

    mockedUpdateComment.mockResolvedValueOnce(sampleComment);
    const ok = await store.editComment('t-1', 'cm-1', { body: 'Edited' });
    expect(ok).toBe(true);
    expect(store.comments).toEqual([sampleComment]);

    mockedUpdateComment.mockRejectedValueOnce(new Error('forbidden'));
    const fail = await store.editComment('t-1', 'cm-1', { body: 'Edited again' });
    expect(fail).toBe(false);
  });

  it('removeComment refreshes comments and current on success', async () => {
    mockedGetTicket.mockResolvedValue(sampleTicket);
    mockedListComments.mockResolvedValue([]);
    mockedDeleteComment.mockResolvedValueOnce(undefined);
    const store = useTicketsStore();

    const ok = await store.removeComment('t-1', 'cm-1');

    expect(ok).toBe(true);
    expect(store.comments).toEqual([]);
  });

  it('uploadFile refreshes attachments and current on success', async () => {
    mockedGetTicket.mockResolvedValue(sampleTicket);
    mockedListTicketAttachments.mockResolvedValue([sampleAttachment]);
    mockedUploadTicketAttachment.mockResolvedValueOnce(sampleAttachment);
    const store = useTicketsStore();

    const file = new File(['x'], 'screenshot.png', { type: 'image/png' });
    const ok = await store.uploadFile('t-1', file);

    expect(ok).toBe(true);
    expect(store.attachments).toEqual([sampleAttachment]);
  });

  it('downloadFile delegates to the api layer', async () => {
    mockedDownloadTicketAttachment.mockResolvedValueOnce(undefined);
    const store = useTicketsStore();

    const ok = await store.downloadFile('t-1', sampleAttachment);

    expect(ok).toBe(true);
    expect(mockedDownloadTicketAttachment).toHaveBeenCalledWith('t-1', sampleAttachment);
  });

  it('removeAttachment refreshes attachments and current on success', async () => {
    mockedGetTicket.mockResolvedValue(sampleTicket);
    mockedListTicketAttachments.mockResolvedValue([]);
    mockedDeleteTicketAttachment.mockResolvedValueOnce(undefined);
    const store = useTicketsStore();

    const ok = await store.removeAttachment('t-1', 'a-1');

    expect(ok).toBe(true);
    expect(store.attachments).toEqual([]);
  });

  it('has no addHistoryEntry/removeHistoryEntry action — history has no write endpoint', () => {
    const store = useTicketsStore();
    const record = store as unknown as Record<string, unknown>;

    expect(record.addHistoryEntry).toBeUndefined();
    expect(record.removeHistoryEntry).toBeUndefined();
  });

  it('clearDetail empties current and all three collections but not agents/customerOptions', async () => {
    mockedGetTicket.mockResolvedValue(sampleTicket);
    mockedListComments.mockResolvedValue([sampleComment]);
    mockedListTicketAttachments.mockResolvedValue([sampleAttachment]);
    mockedListTicketHistory.mockResolvedValue([sampleHistory]);
    mockedListAgents.mockResolvedValue([sampleAgent]);
    mockedListCustomerRefs.mockResolvedValue([sampleCustomerOption]);

    const store = useTicketsStore();
    await store.loadDetail('t-1');
    await store.loadAgents();
    await store.loadCustomerOptions();

    store.clearDetail();

    expect(store.current).toBeNull();
    expect(store.comments).toEqual([]);
    expect(store.attachments).toEqual([]);
    expect(store.history).toEqual([]);
    expect(store.error).toBeNull();
    expect(store.agents).toEqual([sampleAgent]);
    expect(store.customerOptions).toEqual([sampleCustomerOption]);
  });
});
