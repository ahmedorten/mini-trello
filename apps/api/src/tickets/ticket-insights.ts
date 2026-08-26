import { TicketPriority, TicketStatus } from '@prisma/client';

/** Statuses a ticket can be overdue in. RESOLVED and CLOSED never are. */
export const ACTIVE_TICKET_STATUSES: TicketStatus[] = [
  TicketStatus.OPEN,
  TicketStatus.IN_PROGRESS,
  TicketStatus.ON_HOLD,
];

/** "Pending" in the dashboard's headline indicators. */
export const PENDING_TICKET_STATUS = TicketStatus.ON_HOLD;

/**
 * How long a ticket of each priority may sit untouched before the dashboard
 * calls it overdue, measured from `updatedAt` (Product rule 1). Derived, not
 * stored: work item 4 deliberately shipped no SLA field, and this table is the
 * whole of the "overdue" definition. Change it here and every counter, badge,
 * and list in Stories 18 and 21 moves together.
 */
export const OVERDUE_AFTER_HOURS: Record<TicketPriority, number> = {
  [TicketPriority.URGENT]: 4,
  [TicketPriority.HIGH]: 8,
  [TicketPriority.MEDIUM]: 24,
  [TicketPriority.LOW]: 72,
};

/** Max rows in any embedded dashboard list (Product rule 9). */
export const DASHBOARD_LIST_LIMIT = 5;

/** The cutoff instant for each priority, given "now". */
export function overdueCutoffs(now: Date): { priority: TicketPriority; before: Date }[] {
  return (Object.keys(OVERDUE_AFTER_HOURS) as TicketPriority[]).map((priority) => ({
    priority,
    before: new Date(now.getTime() - OVERDUE_AFTER_HOURS[priority] * 60 * 60 * 1000),
  }));
}
