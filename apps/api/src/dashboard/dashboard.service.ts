import { Injectable } from '@nestjs/common';
import {
  AgentTaskStatus,
  Prisma,
  TicketCategory,
  TicketPriority,
  TicketStatus,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { AuthenticatedUser } from '../auth/types/authenticated-user';
import { TicketScope } from '../tickets/dto/list-tickets-query.dto';
import { TICKET_SELECT, TicketsService } from '../tickets/tickets.service';
import {
  ACTIVE_TICKET_STATUSES,
  DASHBOARD_LIST_LIMIT,
  PENDING_TICKET_STATUS,
  overdueCutoffs,
} from '../tickets/ticket-insights';
import { AgentDashboardQueryDto } from './dto/agent-dashboard-query.dto';
import {
  AgentDashboardDto,
  AgentTaskSummaryDto,
  DashboardBucketDto,
} from './dto/agent-dashboard.dto';

/** The ONLY projection used for the dashboard's task summaries. */
const AGENT_TASK_SUMMARY_SELECT = {
  id: true,
  title: true,
  status: true,
  dueAt: true,
  remindAt: true,
  ticketId: true,
  customerId: true,
} satisfies Prisma.AgentTaskSelect;

type SelectedAgentTask = Prisma.AgentTaskGetPayload<{ select: typeof AGENT_TASK_SUMMARY_SELECT }>;

const RESOLVED_STATUSES: TicketStatus[] = [TicketStatus.RESOLVED, TicketStatus.CLOSED];
const OPEN_TASK_STATUSES: AgentTaskStatus[] = [AgentTaskStatus.OPEN, AgentTaskStatus.IN_PROGRESS];

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async agentDashboard(
    query: AgentDashboardQueryDto,
    caller: AuthenticatedUser,
  ): Promise<AgentDashboardDto> {
    // Single `now` for every cutoff, every isOverdue, and generatedAt — so two
    // counters computed a millisecond apart can never disagree.
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const mine = this.scopeWhere(TicketScope.Mine, caller);
    const scoped = this.scopeWhere(query.scope, caller);
    const overdue = this.overdueWhere(now, query.scope, caller);

    const [
      assigned,
      open,
      pending,
      overdueCount,
      unassigned,
      resolvedLast7Days,
      byStatusRows,
      byPriorityRows,
      byCategoryRows,
      focusTicketRows,
      overdueTicketRows,
      unassignedTicketRows,
    ] = await this.prisma.$transaction([
      this.prisma.ticket.count({ where: mine }),
      this.prisma.ticket.count({ where: { ...mine, status: TicketStatus.OPEN } }),
      this.prisma.ticket.count({ where: { ...mine, status: PENDING_TICKET_STATUS } }),
      this.prisma.ticket.count({ where: overdue }),
      this.prisma.ticket.count({ where: { assignedAgentId: null } }),
      this.prisma.ticket.count({
        where: { ...mine, status: { in: RESOLVED_STATUSES }, updatedAt: { gte: sevenDaysAgo } },
      }),
      this.prisma.ticket.groupBy({
        by: ['status'],
        where: scoped,
        orderBy: { status: 'asc' },
        _count: { _all: true },
      }),
      this.prisma.ticket.groupBy({
        by: ['priority'],
        where: scoped,
        orderBy: { priority: 'asc' },
        _count: { _all: true },
      }),
      this.prisma.ticket.groupBy({
        by: ['category'],
        where: scoped,
        orderBy: { category: 'asc' },
        _count: { _all: true },
      }),
      this.prisma.ticket.findMany({
        where: { ...scoped, status: { in: ACTIVE_TICKET_STATUSES } },
        select: TICKET_SELECT,
        orderBy: [{ priority: 'desc' }, { updatedAt: 'asc' }],
        take: DASHBOARD_LIST_LIMIT,
      }),
      this.prisma.ticket.findMany({
        where: overdue,
        select: TICKET_SELECT,
        orderBy: { updatedAt: 'asc' },
        take: DASHBOARD_LIST_LIMIT,
      }),
      this.prisma.ticket.findMany({
        where: { assignedAgentId: null, status: { in: ACTIVE_TICKET_STATUSES } },
        select: TICKET_SELECT,
        orderBy: [{ priority: 'desc' }, { createdAt: 'asc' }],
        take: DASHBOARD_LIST_LIMIT,
      }),
    ]);

    let tasksDueSoon: AgentTaskSummaryDto[] = [];

    // Product rule 8: degrade, do not 403. reporting-user holds dashboard:read
    // and nothing else.
    if (caller.permissions.includes('tasks:read')) {
      const tasks = await this.prisma.agentTask.findMany({
        where: { assigneeId: caller.id, status: { in: OPEN_TASK_STATUSES } },
        select: AGENT_TASK_SUMMARY_SELECT,
        orderBy: [{ dueAt: 'asc' }, { createdAt: 'asc' }],
        take: DASHBOARD_LIST_LIMIT,
      });
      tasksDueSoon = tasks.map((task) => DashboardService.toTaskSummary(task, now));
    }

    return {
      counts: {
        assigned,
        open,
        pending,
        overdue: overdueCount,
        unassigned,
        resolvedLast7Days,
      },
      byStatus: DashboardService.toBuckets(Object.values(TicketStatus), byStatusRows, 'status'),
      byPriority: DashboardService.toBuckets(
        Object.values(TicketPriority),
        byPriorityRows,
        'priority',
      ),
      byCategory: DashboardService.toBuckets(
        Object.values(TicketCategory),
        byCategoryRows,
        'category',
      ),
      focusTickets: focusTicketRows.map((ticket) => TicketsService.toResponse(ticket)),
      overdueTickets: overdueTicketRows.map((ticket) => TicketsService.toResponse(ticket)),
      unassignedTickets: unassignedTicketRows.map((ticket) => TicketsService.toResponse(ticket)),
      tasksDueSoon,
      listLimit: DASHBOARD_LIST_LIMIT,
      generatedAt: now.toISOString(),
    };
  }

  /** Product rule 3, composed with `AND` exactly as TicketsService.list() does. */
  private scopeWhere(scope: TicketScope, caller: AuthenticatedUser): Prisma.TicketWhereInput {
    if (scope === TicketScope.Mine) {
      return { assignedAgentId: caller.id };
    }

    if (scope === TicketScope.Unassigned) {
      return { assignedAgentId: null };
    }

    if (scope === TicketScope.Workable) {
      return { AND: [{ OR: [{ assignedAgentId: caller.id }, { assignedAgentId: null }] }] };
    }

    return {};
  }

  /** Product rule 10: overdue-ness is computed in SQL. `scopeWhere` never
   *  writes a bare `where.OR` (it uses `assignedAgentId`/`AND`), so this
   *  spread cannot clobber it. */
  private overdueWhere(
    now: Date,
    scope: TicketScope,
    caller: AuthenticatedUser,
  ): Prisma.TicketWhereInput {
    return {
      ...this.scopeWhere(scope, caller),
      status: { in: ACTIVE_TICKET_STATUSES },
      OR: overdueCutoffs(now).map(({ priority, before }) => ({
        priority,
        updatedAt: { lt: before },
      })),
    };
  }

  private static toTaskSummary(task: SelectedAgentTask, now: Date): AgentTaskSummaryDto {
    return {
      id: task.id,
      title: task.title,
      status: task.status,
      dueAt: task.dueAt ? task.dueAt.toISOString() : null,
      remindAt: task.remindAt ? task.remindAt.toISOString() : null,
      ticketId: task.ticketId,
      customerId: task.customerId,
      isOverdue:
        task.dueAt !== null &&
        task.dueAt < now &&
        task.status !== AgentTaskStatus.DONE &&
        task.status !== AgentTaskStatus.CANCELLED,
    };
  }

  /** Starts from the full enum value list so a zero-count bucket is present —
   *  an empty `groupBy` result would otherwise silently drop it. */
  private static toBuckets<T extends string>(
    all: readonly T[],
    rows: readonly Record<string, unknown>[],
    key: string,
  ): DashboardBucketDto[] {
    const counts = new Map<string, number>();

    for (const row of rows) {
      const countByAll = row._count as { _all: number };
      counts.set(String(row[key]), countByAll._all);
    }

    return all.map((value) => ({ key: value, count: counts.get(value) ?? 0 }));
  }
}
