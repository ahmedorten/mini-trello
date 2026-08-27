import { apiClient } from './client';
import type { Ticket, TicketScope } from './tickets';

export type { TicketScope } from './tickets';

export const TICKET_SCOPES: TicketScope[] = ['workable', 'mine', 'unassigned', 'all'];

/** Mirrors DashboardBucketDto. */
export interface DashboardBucket {
  key: string;
  count: number;
}

/** Mirrors AgentTicketCountsDto. */
export interface AgentTicketCounts {
  assigned: number;
  open: number;
  pending: number;
  overdue: number;
  unassigned: number;
  resolvedLast7Days: number;
}

export type AgentTaskStatus = 'OPEN' | 'IN_PROGRESS' | 'DONE' | 'CANCELLED';

/** Mirrors AgentTaskSummaryDto. */
export interface AgentTaskSummary {
  id: string;
  title: string;
  status: AgentTaskStatus;
  dueAt: string | null;
  remindAt: string | null;
  ticketId: string | null;
  customerId: string | null;
  isOverdue: boolean;
}

/** Mirrors AgentDashboardDto. */
export interface AgentDashboard {
  counts: AgentTicketCounts;
  byStatus: DashboardBucket[];
  byPriority: DashboardBucket[];
  byCategory: DashboardBucket[];
  focusTickets: Ticket[];
  overdueTickets: Ticket[];
  unassignedTickets: Ticket[];
  tasksDueSoon: AgentTaskSummary[];
  listLimit: number;
  generatedAt: string;
}

export async function getAgentDashboard(scope?: TicketScope): Promise<AgentDashboard> {
  const response = await apiClient.get<AgentDashboard>('/dashboard/agent', {
    params: scope ? { scope } : undefined,
  });

  return response.data;
}
