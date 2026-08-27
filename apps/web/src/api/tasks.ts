import { apiClient } from './client';
import type { UserRef } from './customers';
import type { CustomerRef } from './tickets';
import type { PaginationMeta } from './users';

export type AgentTaskStatus = 'OPEN' | 'IN_PROGRESS' | 'DONE' | 'CANCELLED';

/** Display order, matching the Prisma enum in apps/api/prisma/schema.prisma. */
export const AGENT_TASK_STATUSES: AgentTaskStatus[] = ['OPEN', 'IN_PROGRESS', 'DONE', 'CANCELLED'];

export type AgentTaskScope = 'mine' | 'all';

/** The ticket a task is attributed to. Mirrors InteractionTicketRefDto —
 *  enough to render a link, nothing that duplicates TicketResponseDto. */
export interface AgentTaskTicketRef {
  id: string;
  subject: string;
}

/** Mirrors AgentTaskResponseDto. */
export interface AgentTask {
  id: string;
  title: string;
  notes: string | null;
  status: AgentTaskStatus;
  dueAt: string | null;
  remindAt: string | null;
  completedAt: string | null;
  assignee: UserRef;
  createdBy: UserRef;
  ticket: AgentTaskTicketRef | null;
  customer: CustomerRef | null;
  isOverdue: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface PaginatedAgentTasks {
  items: AgentTask[];
  meta: PaginationMeta;
}

export interface ListAgentTasksParams {
  page?: number;
  pageSize?: number;
  scope?: AgentTaskScope;
  status?: AgentTaskStatus;
  assigneeId?: string;
  ticketId?: string;
  customerId?: string;
  dueBefore?: string;
  overdueOnly?: boolean;
}

/** Mirrors CreateAgentTaskDto. `assigneeId` defaults to the caller server-side
 *  when absent; assigning someone else requires tasks:manage. */
export interface CreateAgentTaskPayload {
  title: string;
  notes?: string;
  status?: AgentTaskStatus;
  dueAt?: string;
  remindAt?: string;
  assigneeId?: string;
  ticketId?: string;
  customerId?: string;
}

/** Mirrors UpdateAgentTaskDto. `null` on a nullable field clears it; an
 *  absent key leaves it alone. */
export interface UpdateAgentTaskPayload {
  title?: string;
  notes?: string | null;
  status?: AgentTaskStatus;
  dueAt?: string | null;
  remindAt?: string | null;
  assigneeId?: string;
  ticketId?: string | null;
  customerId?: string | null;
}

export async function listTasks(params: ListAgentTasksParams): Promise<PaginatedAgentTasks> {
  const response = await apiClient.get<PaginatedAgentTasks>('/tasks', { params });

  return response.data;
}

export async function getTask(id: string): Promise<AgentTask> {
  const response = await apiClient.get<AgentTask>(`/tasks/${id}`);

  return response.data;
}

export async function createTask(payload: CreateAgentTaskPayload): Promise<AgentTask> {
  const response = await apiClient.post<AgentTask>('/tasks', payload);

  return response.data;
}

export async function updateTask(id: string, payload: UpdateAgentTaskPayload): Promise<AgentTask> {
  const response = await apiClient.patch<AgentTask>(`/tasks/${id}`, payload);

  return response.data;
}

export async function setTaskStatus(id: string, status: AgentTaskStatus): Promise<AgentTask> {
  const response = await apiClient.patch<AgentTask>(`/tasks/${id}/status`, { status });

  return response.data;
}

export async function deleteTask(id: string): Promise<void> {
  await apiClient.delete(`/tasks/${id}`);
}
