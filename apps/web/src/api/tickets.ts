import { apiClient } from './client';
import type { PaginationMeta } from './users';
import type { UserRef } from './customers';

export type TicketCategory =
  | 'GENERAL' | 'TECHNICAL' | 'BILLING' | 'ACCOUNT' | 'FEATURE_REQUEST' | 'BUG_REPORT' | 'OTHER';
export type TicketPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
export type TicketStatus = 'OPEN' | 'IN_PROGRESS' | 'ON_HOLD' | 'RESOLVED' | 'CLOSED';

/** The values, in display order, for every picker in this feature. Keep in
 *  step with the Prisma enums in apps/api/prisma/schema.prisma. */
export const TICKET_CATEGORIES: TicketCategory[] = [
  'GENERAL', 'TECHNICAL', 'BILLING', 'ACCOUNT', 'FEATURE_REQUEST', 'BUG_REPORT', 'OTHER',
];
export const TICKET_PRIORITIES: TicketPriority[] = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'];
export const TICKET_STATUSES: TicketStatus[] = ['OPEN', 'IN_PROGRESS', 'ON_HOLD', 'RESOLVED', 'CLOSED'];

/** Mirrors CustomerRefDto in apps/api/src/tickets/dto/ticket-response.dto.ts */
export interface CustomerRef {
  id: string;
  name: string;
  email: string | null;
}

/** Mirrors TicketResponseDto. */
export interface Ticket {
  id: string;
  customer: CustomerRef;
  subject: string;
  description: string;
  category: TicketCategory;
  priority: TicketPriority;
  status: TicketStatus;
  assignedAgent: UserRef | null;
  createdBy: UserRef | null;
  counts: { comments: number; attachments: number; history: number };
  createdAt: string;
  updatedAt: string;
}

export interface PaginatedTickets {
  items: Ticket[];
  meta: PaginationMeta;
}

export interface ListTicketsParams {
  page?: number;
  pageSize?: number;
  search?: string;
  category?: TicketCategory;
  priority?: TicketPriority;
  status?: TicketStatus;
  assignedAgentId?: string;
  customerId?: string;
}

/** Mirrors CreateTicketDto. */
export interface CreateTicketPayload {
  customerId: string;
  subject: string;
  description: string;
  category?: TicketCategory;
  priority?: TicketPriority;
  assignedAgentId?: string;
}

/** Mirrors UpdateTicketDto. `assignedAgentId: null` clears it; an absent key
 *  leaves it alone. `customerId` is deliberately absent — immutable. */
export interface UpdateTicketPayload {
  subject?: string;
  description?: string;
  category?: TicketCategory;
  priority?: TicketPriority;
  assignedAgentId?: string | null;
}

/** Mirrors CommentResponseDto. */
export interface TicketComment {
  id: string;
  ticketId: string;
  author: UserRef;
  body: string;
  createdAt: string;
  updatedAt: string;
}

export interface CommentPayload {
  body: string;
}

/** Mirrors ticket-attachment.dto.ts's AttachmentResponseDto shape. */
export interface TicketAttachment {
  id: string;
  ticketId: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  checksumSha256: string;
  uploadedBy: UserRef;
  createdAt: string;
}

/** Mirrors TicketHistoryResponseDto. */
export interface TicketHistoryEntry {
  id: string;
  ticketId: string;
  field: string;
  oldValue: string | null;
  newValue: string | null;
  changedBy: UserRef;
  createdAt: string;
}

export async function listTickets(params: ListTicketsParams): Promise<PaginatedTickets> {
  const response = await apiClient.get<PaginatedTickets>('/tickets', { params });

  return response.data;
}

export async function getTicket(id: string): Promise<Ticket> {
  const response = await apiClient.get<Ticket>(`/tickets/${id}`);

  return response.data;
}

export async function createTicket(payload: CreateTicketPayload): Promise<Ticket> {
  const response = await apiClient.post<Ticket>('/tickets', payload);

  return response.data;
}

export async function updateTicket(id: string, payload: UpdateTicketPayload): Promise<Ticket> {
  const response = await apiClient.patch<Ticket>(`/tickets/${id}`, payload);

  return response.data;
}

export async function setTicketStatus(id: string, status: TicketStatus): Promise<Ticket> {
  const response = await apiClient.patch<Ticket>(`/tickets/${id}/status`, { status });

  return response.data;
}

export async function listComments(ticketId: string): Promise<TicketComment[]> {
  const response = await apiClient.get<TicketComment[]>(`/tickets/${ticketId}/comments`);

  return response.data;
}

export async function createComment(ticketId: string, payload: CommentPayload): Promise<TicketComment> {
  const response = await apiClient.post<TicketComment>(`/tickets/${ticketId}/comments`, payload);

  return response.data;
}

export async function updateComment(ticketId: string, id: string, payload: CommentPayload): Promise<TicketComment> {
  const response = await apiClient.patch<TicketComment>(`/tickets/${ticketId}/comments/${id}`, payload);

  return response.data;
}

export async function deleteComment(ticketId: string, id: string): Promise<void> {
  await apiClient.delete(`/tickets/${ticketId}/comments/${id}`);
}

export async function listTicketAttachments(ticketId: string): Promise<TicketAttachment[]> {
  const response = await apiClient.get<TicketAttachment[]>(`/tickets/${ticketId}/attachments`);

  return response.data;
}

export async function uploadTicketAttachment(ticketId: string, file: File): Promise<TicketAttachment> {
  const form = new FormData();
  form.append('file', file);

  const response = await apiClient.post<TicketAttachment>(
    `/tickets/${ticketId}/attachments`,
    form,
    { headers: { 'Content-Type': 'multipart/form-data' } },
  );

  return response.data;
}

export async function downloadTicketAttachment(ticketId: string, attachment: TicketAttachment): Promise<void> {
  const response = await apiClient.get<Blob>(
    `/tickets/${ticketId}/attachments/${attachment.id}/content`,
    { responseType: 'blob' },
  );

  const url = URL.createObjectURL(response.data);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = attachment.fileName;
  anchor.click();
  URL.revokeObjectURL(url);
}

export async function deleteTicketAttachment(ticketId: string, id: string): Promise<void> {
  await apiClient.delete(`/tickets/${ticketId}/attachments/${id}`);
}

export async function listTicketHistory(ticketId: string): Promise<TicketHistoryEntry[]> {
  const response = await apiClient.get<TicketHistoryEntry[]>(`/tickets/${ticketId}/history`);

  return response.data;
}
