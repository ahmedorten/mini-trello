import { apiClient } from './client';
import type {
  CustomerInteraction,
  InteractionChannel,
  InteractionCustomerRef,
  InteractionDeliveryStatus,
  InteractionDirection,
} from './customers';
import type { PaginationMeta } from './users';

export type ChannelAddressKind = 'email' | 'phone' | 'session' | 'none';

/**
 * The communication abstraction this project actually has: there is no
 * outbound provider anywhere in this feature. `canRespond` drives whether the
 * workspace offers a Respond composer for the channel; `providerConfigured`
 * is false for every channel today — the seam a future work item flips.
 * `addressKind` drives which counterparty input the composer renders.
 * Mirrors ChannelDescriptorDto in apps/api/src/communication/dto/channel.dto.ts.
 */
export interface ChannelDescriptor {
  key: InteractionChannel;
  canRespond: boolean;
  isRealtime: boolean;
  providerConfigured: boolean;
  acceptsInbound: boolean;
  addressKind: ChannelAddressKind;
  requiresAddress: boolean;
  maxBodyLength: number | null;
  supportsSubject: boolean;
}

export async function listChannels(): Promise<ChannelDescriptor[]> {
  const response = await apiClient.get<{ items: ChannelDescriptor[] }>('/communication/channels');

  return response.data.items;
}

/** Mirrors SendMessageDto. No `direction`: the route always writes OUTBOUND. */
export interface SendMessagePayload {
  customerId: string;
  ticketId?: string;
  channel: InteractionChannel;
  subject?: string;
  body: string;
  address?: string;
  occurredAt?: string;
}

export interface ListTimelineParams {
  page?: number;
  pageSize?: number;
  channel?: InteractionChannel;
  direction?: InteractionDirection;
  deliveryStatus?: InteractionDeliveryStatus;
  customerId?: string;
  ticketId?: string;
  assignedAgentId?: string;
  mine?: boolean;
  occurredFrom?: string;
  occurredTo?: string;
  search?: string;
  ticketLinkedOnly?: boolean;
}

export interface PaginatedTimeline {
  items: CustomerInteraction[];
  meta: PaginationMeta;
}

/** Mirrors ConversationDto. `threadKey` is null for interactions logged before
 *  the delivery columns existed — the UI labels that group "Earlier history". */
export interface Conversation {
  customer: InteractionCustomerRef;
  channel: InteractionChannel;
  threadKey: string | null;
  messageCount: number;
  lastOccurredAt: string;
  lastMessage: CustomerInteraction;
}

export interface ConversationList {
  items: Conversation[];
  meta: PaginationMeta;
}

export interface ListConversationsParams {
  page?: number;
  pageSize?: number;
  customerId?: string;
  channel?: InteractionChannel;
  assignedAgentId?: string;
  mine?: boolean;
}

export async function sendMessage(payload: SendMessagePayload): Promise<CustomerInteraction> {
  const response = await apiClient.post<CustomerInteraction>('/communication/messages', payload);

  return response.data;
}

export async function listCommunicationTimeline(
  params: ListTimelineParams = {},
): Promise<PaginatedTimeline> {
  const response = await apiClient.get<PaginatedTimeline>('/communication/timeline', { params });

  return response.data;
}

export async function listConversations(
  params: ListConversationsParams = {},
): Promise<ConversationList> {
  const response = await apiClient.get<ConversationList>('/communication/conversations', {
    params,
  });

  return response.data;
}
