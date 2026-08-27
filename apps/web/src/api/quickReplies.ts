import { apiClient } from './client';
import type { InteractionChannel, UserRef } from './customers';

/** Mirrors QuickReplyResponseDto. */
export interface QuickReply {
  id: string;
  key: string;
  locale: string;
  title: string;
  body: string;
  channel: InteractionChannel | null;
  isActive: boolean;
  createdBy: UserRef | null;
  createdAt: string;
  updatedAt: string;
}

export interface ListQuickRepliesParams {
  locale?: string;
  channel?: InteractionChannel;
  includeInactive?: boolean;
}

/** Mirrors CreateQuickReplyDto. `key` and `locale` are immutable after creation. */
export interface CreateQuickReplyPayload {
  key: string;
  locale: string;
  title: string;
  body: string;
  channel?: InteractionChannel;
  isActive?: boolean;
}

/** Mirrors UpdateQuickReplyDto. `channel: null` makes a reply channel-agnostic
 *  again; an absent key leaves it alone. */
export interface UpdateQuickReplyPayload {
  title?: string;
  body?: string;
  channel?: InteractionChannel | null;
  isActive?: boolean;
}

export async function listQuickReplies(params: ListQuickRepliesParams = {}): Promise<QuickReply[]> {
  const response = await apiClient.get<QuickReply[]>('/quick-replies', { params });

  return response.data;
}

export async function createQuickReply(payload: CreateQuickReplyPayload): Promise<QuickReply> {
  const response = await apiClient.post<QuickReply>('/quick-replies', payload);

  return response.data;
}

export async function updateQuickReply(id: string, payload: UpdateQuickReplyPayload): Promise<QuickReply> {
  const response = await apiClient.patch<QuickReply>(`/quick-replies/${id}`, payload);

  return response.data;
}

export async function deleteQuickReply(id: string): Promise<void> {
  await apiClient.delete(`/quick-replies/${id}`);
}
