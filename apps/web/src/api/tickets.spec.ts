import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  downloadTicketAttachment,
  listTickets,
  uploadTicketAttachment,
  type ListTicketsParams,
  type TicketAttachment,
} from './tickets';
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
});
