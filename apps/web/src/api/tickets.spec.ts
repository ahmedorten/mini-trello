import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  assignTicket,
  createTicketInteraction,
  downloadTicketAttachment,
  listTickets,
  listTicketInteractions,
  uploadTicketAttachment,
  type CreateTicketInteractionPayload,
  type ListTicketsParams,
  type Ticket,
  type TicketAttachment,
} from './tickets';
import type { CustomerInteraction } from './customers';
import { apiClient } from './client';

vi.mock('./client', () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
}));

const mockedApiClient = vi.mocked(apiClient, true);

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

describe('tickets api', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('listTickets passes its params object through untouched', async () => {
    const params: ListTicketsParams = { page: 2, pageSize: 10, search: 'login' };
    mockedApiClient.get.mockResolvedValue({
      data: { items: [], meta: { page: 2, pageSize: 10, total: 0, totalPages: 0 } },
    });

    await listTickets(params);

    expect(mockedApiClient.get).toHaveBeenCalledWith('/tickets', { params });
  });

  it('listTickets puts sort and order on the query string', async () => {
    mockedApiClient.get.mockResolvedValue({
      data: { items: [], meta: { page: 1, pageSize: 20, total: 0, totalPages: 0 } },
    });

    await listTickets({ sort: 'subject', order: 'asc' });

    expect(mockedApiClient.get).toHaveBeenCalledWith('/tickets', {
      params: { sort: 'subject', order: 'asc' },
    });
  });

  it('uploadTicketAttachment posts a FormData containing the file under the key "file"', async () => {
    mockedApiClient.post.mockResolvedValue({ data: sampleAttachment });
    const file = new File(['bytes'], 'screenshot.png', { type: 'image/png' });

    await uploadTicketAttachment('t-1', file);

    expect(mockedApiClient.post).toHaveBeenCalledTimes(1);
    const [url, body, config] = mockedApiClient.post.mock.calls[0];
    expect(url).toBe('/tickets/t-1/attachments');
    expect(body).toBeInstanceOf(FormData);
    expect((body as FormData).get('file')).toBe(file);
    expect(config).toEqual({ headers: { 'Content-Type': 'multipart/form-data' } });
  });

  it('downloadTicketAttachment requests a blob, clicks a download anchor, and revokes the object URL', async () => {
    const blob = new Blob(['bytes']);
    mockedApiClient.get.mockResolvedValue({ data: blob });

    const createObjectURL = vi.fn().mockReturnValue('blob:mock-url');
    const revokeObjectURL = vi.fn();
    vi.stubGlobal('URL', { ...URL, createObjectURL, revokeObjectURL });

    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

    await downloadTicketAttachment('t-1', sampleAttachment);

    expect(mockedApiClient.get).toHaveBeenCalledWith('/tickets/t-1/attachments/a-1/content', {
      responseType: 'blob',
    });
    expect(createObjectURL).toHaveBeenCalledWith(blob);
    expect(clickSpy).toHaveBeenCalledTimes(1);
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:mock-url');

    clickSpy.mockRestore();
    vi.unstubAllGlobals();
  });

  const sampleInteraction: CustomerInteraction = {
    id: 'i-1',
    customerId: 'c-1',
    channel: 'EMAIL',
    direction: 'OUTBOUND',
    subject: 'Response',
    body: 'We logged your response.',
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
  };

  it('listTicketInteractions forwards its three params', async () => {
    mockedApiClient.get.mockResolvedValue({ data: [sampleInteraction] });

    await listTicketInteractions('t-1', { channel: 'EMAIL', direction: 'OUTBOUND', includeCustomerHistory: true });

    expect(mockedApiClient.get).toHaveBeenCalledWith('/tickets/t-1/interactions', {
      params: { channel: 'EMAIL', direction: 'OUTBOUND', includeCustomerHistory: true },
    });
  });

  it('createTicketInteraction posts to /tickets/:id/interactions with no customerId in the payload', async () => {
    mockedApiClient.post.mockResolvedValue({ data: sampleInteraction });
    const payload: CreateTicketInteractionPayload = {
      channel: 'EMAIL',
      direction: 'OUTBOUND',
      subject: 'Response',
      occurredAt: '2026-08-25T00:00:00.000Z',
    };

    await createTicketInteraction('t-1', payload);

    expect(mockedApiClient.post).toHaveBeenCalledWith('/tickets/t-1/interactions', payload);
    const [, body] = mockedApiClient.post.mock.calls[0];
    expect(body).not.toHaveProperty('customerId');
  });

  it('assignTicket patches /tickets/:id/assignment with { assignedAgentId }, including null', async () => {
    const sampleTicket: Ticket = {
      id: 't-1',
      customer: { id: 'c-1', name: 'Orten Trading', email: 'contact@orten.example' },
      subject: 'Cannot log in',
      description: 'Details',
      category: 'GENERAL',
      priority: 'MEDIUM',
      status: 'OPEN',
      assignedAgent: null,
      createdBy: null,
      counts: { comments: 0, attachments: 0, history: 0 },
      createdAt: '2026-08-25T00:00:00.000Z',
      updatedAt: '2026-08-25T00:00:00.000Z',
    };
    mockedApiClient.patch.mockResolvedValue({ data: sampleTicket });

    await assignTicket('t-1', 'agent-1');
    expect(mockedApiClient.patch).toHaveBeenCalledWith('/tickets/t-1/assignment', { assignedAgentId: 'agent-1' });

    await assignTicket('t-1', null);
    expect(mockedApiClient.patch).toHaveBeenCalledWith('/tickets/t-1/assignment', { assignedAgentId: null });
  });
});
