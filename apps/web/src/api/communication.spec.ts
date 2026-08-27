import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  listChannels,
  listCommunicationTimeline,
  listConversations,
  sendMessage,
  type ChannelDescriptor,
  type SendMessagePayload,
} from './communication';
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

const sampleChannel: ChannelDescriptor = {
  key: 'EMAIL',
  canRespond: true,
  isRealtime: false,
  providerConfigured: false,
  acceptsInbound: true,
  addressKind: 'email',
  requiresAddress: true,
  maxBodyLength: null,
  supportsSubject: true,
};

describe('communication api', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('listChannels unwraps the { items } envelope', async () => {
    mockedApiClient.get.mockResolvedValue({ data: { items: [sampleChannel] } });

    const result = await listChannels();

    expect(mockedApiClient.get).toHaveBeenCalledWith('/communication/channels');
    expect(result).toEqual([sampleChannel]);
  });

  it('sendMessage POSTs to /communication/messages with the payload verbatim', async () => {
    const payload: SendMessagePayload = {
      customerId: 'c-1',
      channel: 'EMAIL',
      subject: 'Following up',
      body: 'We are on it.',
      address: 'layla@crm.local',
    };
    mockedApiClient.post.mockResolvedValue({ data: { id: 'i-1' } });

    const result = await sendMessage(payload);

    expect(mockedApiClient.post).toHaveBeenCalledWith('/communication/messages', payload);
    expect(result).toEqual({ id: 'i-1' });
  });

  it('sendMessage never sends a direction — the route always writes OUTBOUND', async () => {
    mockedApiClient.post.mockResolvedValue({ data: { id: 'i-1' } });

    await sendMessage({ customerId: 'c-1', channel: 'EMAIL', body: 'Hi' });

    const [, payload] = mockedApiClient.post.mock.calls[0];

    expect(payload).not.toHaveProperty('direction');
  });

  it('listCommunicationTimeline GETs /communication/timeline with the params object', async () => {
    const body = { items: [], meta: { page: 1, pageSize: 20, total: 0, totalPages: 1 } };
    mockedApiClient.get.mockResolvedValue({ data: body });

    const result = await listCommunicationTimeline({ page: 2, channel: 'SMS', mine: true });

    expect(mockedApiClient.get).toHaveBeenCalledWith('/communication/timeline', {
      params: { page: 2, channel: 'SMS', mine: true },
    });
    expect(result).toEqual(body);
  });

  it('listConversations GETs /communication/conversations with the params object', async () => {
    const body = { items: [], meta: { page: 1, pageSize: 20, total: 0, totalPages: 1 } };
    mockedApiClient.get.mockResolvedValue({ data: body });

    const result = await listConversations({ customerId: 'c-1' });

    expect(mockedApiClient.get).toHaveBeenCalledWith('/communication/conversations', {
      params: { customerId: 'c-1' },
    });
    expect(result).toEqual(body);
  });
});
