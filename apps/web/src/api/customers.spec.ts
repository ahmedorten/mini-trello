import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  downloadAttachment,
  listCustomers,
  uploadAttachment,
  type CustomerAttachment,
  type ListCustomersParams,
} from './customers';
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

describe('customers api', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('listCustomers passes its params object through untouched', async () => {
    const params: ListCustomersParams = { page: 2, pageSize: 10, search: 'orten' };
    mockedApiClient.get.mockResolvedValue({
      data: { items: [], meta: { page: 2, pageSize: 10, total: 0, totalPages: 0 } },
    });

    await listCustomers(params);

    expect(mockedApiClient.get).toHaveBeenCalledWith('/customers', { params });
  });

  it('uploadAttachment posts a FormData containing the file under the key "file"', async () => {
    mockedApiClient.post.mockResolvedValue({ data: sampleAttachment });
    const file = new File(['bytes'], 'contract.pdf', { type: 'application/pdf' });

    await uploadAttachment('c-1', file);

    expect(mockedApiClient.post).toHaveBeenCalledTimes(1);
    const [url, body, config] = mockedApiClient.post.mock.calls[0];
    expect(url).toBe('/customers/c-1/attachments');
    expect(body).toBeInstanceOf(FormData);
    expect((body as FormData).get('file')).toBe(file);
    expect(config).toEqual({ headers: { 'Content-Type': 'multipart/form-data' } });
  });

  it('downloadAttachment requests a blob, clicks a download anchor, and revokes the object URL', async () => {
    const blob = new Blob(['bytes']);
    mockedApiClient.get.mockResolvedValue({ data: blob });

    const createObjectURL = vi.fn().mockReturnValue('blob:mock-url');
    const revokeObjectURL = vi.fn();
    vi.stubGlobal('URL', { ...URL, createObjectURL, revokeObjectURL });

    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

    await downloadAttachment('c-1', sampleAttachment);

    expect(mockedApiClient.get).toHaveBeenCalledWith('/customers/c-1/attachments/a-1/content', {
      responseType: 'blob',
    });
    expect(createObjectURL).toHaveBeenCalledWith(blob);
    expect(clickSpy).toHaveBeenCalledTimes(1);
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:mock-url');

    clickSpy.mockRestore();
    vi.unstubAllGlobals();
  });
});
