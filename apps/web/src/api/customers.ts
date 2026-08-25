import { apiClient } from './client';
import type { PaginationMeta } from './users';

export type CustomerStatus = 'PROSPECT' | 'ACTIVE' | 'INACTIVE' | 'ARCHIVED';
export type CustomerType = 'INDIVIDUAL' | 'COMPANY';
export type InteractionChannel = 'PHONE' | 'EMAIL' | 'CHAT' | 'MEETING' | 'OTHER';
export type InteractionDirection = 'INBOUND' | 'OUTBOUND';

/** The values, in display order, for every picker in this feature. Keep in step
 *  with the Prisma enums in apps/api/prisma/schema.prisma. */
export const CUSTOMER_STATUSES: CustomerStatus[] = ['PROSPECT', 'ACTIVE', 'INACTIVE', 'ARCHIVED'];
export const CUSTOMER_TYPES: CustomerType[] = ['INDIVIDUAL', 'COMPANY'];
export const INTERACTION_CHANNELS: InteractionChannel[] = ['PHONE', 'EMAIL', 'CHAT', 'MEETING', 'OTHER'];

/** Mirrors UserRefDto in apps/api/src/customers/dto/customer-response.dto.ts */
export interface UserRef {
  id: string;
  fullName: string;
  email: string;
}

/** Mirrors CustomerResponseDto. */
export interface Customer {
  id: string;
  type: CustomerType;
  name: string;
  companyName: string | null;
  email: string | null;
  phone: string | null;
  alternatePhone: string | null;
  addressLine1: string | null;
  addressLine2: string | null;
  city: string | null;
  country: string | null;
  postalCode: string | null;
  status: CustomerStatus;
  assignedAgent: UserRef | null;
  createdBy: UserRef | null;
  counts: { notes: number; attachments: number; interactions: number };
  createdAt: string;
  updatedAt: string;
}

export interface PaginatedCustomers {
  items: Customer[];
  meta: PaginationMeta;
}

export interface ListCustomersParams {
  page?: number;
  pageSize?: number;
  search?: string;
  status?: CustomerStatus;
  type?: CustomerType;
  assignedAgentId?: string;
  city?: string;
}

/** Mirrors CreateCustomerDto. */
export interface CreateCustomerPayload {
  type?: CustomerType;
  name: string;
  companyName?: string;
  email?: string;
  phone?: string;
  alternatePhone?: string;
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  country?: string;
  postalCode?: string;
  status?: CustomerStatus;
  assignedAgentId?: string;
}

/** Mirrors UpdateCustomerDto. `null` on a nullable field clears it; an absent
 *  key leaves it alone — the asymmetry with CreateCustomerPayload is deliberate. */
export interface UpdateCustomerPayload {
  type?: CustomerType;
  name?: string;
  companyName?: string | null;
  email?: string | null;
  phone?: string | null;
  alternatePhone?: string | null;
  addressLine1?: string | null;
  addressLine2?: string | null;
  city?: string | null;
  country?: string | null;
  postalCode?: string | null;
  assignedAgentId?: string | null;
}

/** Mirrors NoteResponseDto. */
export interface CustomerNote {
  id: string;
  customerId: string;
  author: UserRef;
  body: string;
  createdAt: string;
  updatedAt: string;
}

export interface NotePayload {
  body: string;
}

/** Mirrors AttachmentResponseDto. `storageKey` is deliberately absent. */
export interface CustomerAttachment {
  id: string;
  customerId: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  checksumSha256: string;
  uploadedBy: UserRef;
  createdAt: string;
}

/** Mirrors InteractionResponseDto. */
export interface CustomerInteraction {
  id: string;
  customerId: string;
  channel: InteractionChannel;
  direction: InteractionDirection;
  subject: string;
  body: string | null;
  occurredAt: string;
  createdBy: UserRef;
  createdAt: string;
}

/** Mirrors CreateInteractionDto. */
export interface CreateInteractionPayload {
  channel: InteractionChannel;
  direction: InteractionDirection;
  subject: string;
  body?: string;
  occurredAt: string;
}

export async function listCustomers(params: ListCustomersParams): Promise<PaginatedCustomers> {
  const response = await apiClient.get<PaginatedCustomers>('/customers', { params });

  return response.data;
}

export interface CustomerRefOption {
  id: string;
  name: string;
  email: string | null;
}

/** A page-size-capped list for a <select>, not the paginated list UI.
 *  Mirrors listAgents() in api/users.ts. */
export async function listCustomerRefs(): Promise<CustomerRefOption[]> {
  const { items } = await listCustomers({ pageSize: 100 });

  return items.map((customer) => ({ id: customer.id, name: customer.name, email: customer.email }));
}

export async function getCustomer(id: string): Promise<Customer> {
  const response = await apiClient.get<Customer>(`/customers/${id}`);

  return response.data;
}

export async function createCustomer(payload: CreateCustomerPayload): Promise<Customer> {
  const response = await apiClient.post<Customer>('/customers', payload);

  return response.data;
}

export async function updateCustomer(id: string, payload: UpdateCustomerPayload): Promise<Customer> {
  const response = await apiClient.patch<Customer>(`/customers/${id}`, payload);

  return response.data;
}

export async function setCustomerStatus(id: string, status: CustomerStatus): Promise<Customer> {
  const response = await apiClient.patch<Customer>(`/customers/${id}/status`, { status });

  return response.data;
}

export async function listNotes(customerId: string): Promise<CustomerNote[]> {
  const response = await apiClient.get<CustomerNote[]>(`/customers/${customerId}/notes`);

  return response.data;
}

export async function createNote(customerId: string, payload: NotePayload): Promise<CustomerNote> {
  const response = await apiClient.post<CustomerNote>(`/customers/${customerId}/notes`, payload);

  return response.data;
}

export async function updateNote(customerId: string, id: string, payload: NotePayload): Promise<CustomerNote> {
  const response = await apiClient.patch<CustomerNote>(`/customers/${customerId}/notes/${id}`, payload);

  return response.data;
}

export async function deleteNote(customerId: string, id: string): Promise<void> {
  await apiClient.delete(`/customers/${customerId}/notes/${id}`);
}

export async function listAttachments(customerId: string): Promise<CustomerAttachment[]> {
  const response = await apiClient.get<CustomerAttachment[]>(`/customers/${customerId}/attachments`);

  return response.data;
}

export async function uploadAttachment(customerId: string, file: File): Promise<CustomerAttachment> {
  const form = new FormData();
  form.append('file', file);

  // The instance defaults to application/json; multipart needs its own type so
  // the browser can attach the boundary.
  const response = await apiClient.post<CustomerAttachment>(
    `/customers/${customerId}/attachments`,
    form,
    { headers: { 'Content-Type': 'multipart/form-data' } },
  );

  return response.data;
}

/**
 * The download endpoint needs the Authorization header, so a plain <a href>
 * would 401 — the access token lives in memory, not in a cookie. Fetch the
 * bytes through apiClient, then hand the browser an object URL.
 */
export async function downloadAttachment(customerId: string, attachment: CustomerAttachment): Promise<void> {
  const response = await apiClient.get<Blob>(
    `/customers/${customerId}/attachments/${attachment.id}/content`,
    { responseType: 'blob' },
  );

  const url = URL.createObjectURL(response.data);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = attachment.fileName;
  anchor.click();
  URL.revokeObjectURL(url);
}

export async function deleteAttachment(customerId: string, id: string): Promise<void> {
  await apiClient.delete(`/customers/${customerId}/attachments/${id}`);
}

export async function listInteractions(customerId: string): Promise<CustomerInteraction[]> {
  const response = await apiClient.get<CustomerInteraction[]>(`/customers/${customerId}/interactions`);

  return response.data;
}

export async function createInteraction(
  customerId: string,
  payload: CreateInteractionPayload,
): Promise<CustomerInteraction> {
  const response = await apiClient.post<CustomerInteraction>(`/customers/${customerId}/interactions`, payload);

  return response.data;
}

export async function deleteInteraction(customerId: string, id: string): Promise<void> {
  await apiClient.delete(`/customers/${customerId}/interactions/${id}`);
}
