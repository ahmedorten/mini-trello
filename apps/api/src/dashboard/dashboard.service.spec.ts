import { Test, TestingModule } from '@nestjs/testing';
import { TicketCategory, TicketPriority, TicketStatus } from '@prisma/client';
import { DashboardService } from './dashboard.service';
import { PrismaService } from '../prisma/prisma.service';
import { TicketScope } from '../tickets/dto/list-tickets-query.dto';
import { DASHBOARD_LIST_LIMIT } from '../tickets/ticket-insights';
import type { AuthenticatedUser } from '../auth/types/authenticated-user';
import type { AgentDashboardQueryDto } from './dto/agent-dashboard-query.dto';

function containing(obj: Record<string, unknown>): unknown {
  return expect.objectContaining(obj);
}

const baseTicketRow = {
  id: 'ticket-1',
  subject: 'Cannot log in',
  description: 'After password reset, login fails.',
  category: TicketCategory.GENERAL,
  priority: TicketPriority.MEDIUM,
  status: TicketStatus.OPEN,
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-01-02T00:00:00.000Z'),
  customer: { id: 'customer-1', name: 'Orten Trading', email: 'contact@orten.example' },
  assignedAgent: null as { id: string; fullName: string; email: string } | null,
  createdBy: null as { id: string; fullName: string; email: string } | null,
  _count: { comments: 0, attachments: 0, history: 0 },
};

function buildCaller(overrides: Partial<AuthenticatedUser> = {}): AuthenticatedUser {
  return {
    id: 'caller-1',
    email: 'agent@crm.local',
    fullName: 'Agent',
    mustChangePassword: false,
    departmentId: null,
    branchId: null,
    roles: ['support-agent'],
    permissions: ['dashboard:read', 'tickets:read', 'tasks:read'],
    ...overrides,
  };
}

function query(overrides: Partial<AgentDashboardQueryDto> = {}): AgentDashboardQueryDto {
  return { scope: TicketScope.Mine, ...overrides };
}

describe('DashboardService', () => {
  let service: DashboardService;
  let prisma: {
    ticket: {
      count: jest.Mock<Promise<number>, [Record<string, unknown>]>;
      groupBy: jest.Mock<Promise<unknown[]>, [Record<string, unknown>]>;
      findMany: jest.Mock<Promise<unknown[]>, [Record<string, unknown>]>;
    };
    agentTask: { findMany: jest.Mock<Promise<unknown[]>, [Record<string, unknown>]> };
    $transaction: jest.Mock<Promise<unknown[]>, [unknown[]]>;
  };

  beforeEach(async () => {
    prisma = {
      ticket: {
        count: jest.fn<Promise<number>, [Record<string, unknown>]>().mockResolvedValue(0),
        groupBy: jest.fn<Promise<unknown[]>, [Record<string, unknown>]>().mockResolvedValue([]),
        findMany: jest.fn<Promise<unknown[]>, [Record<string, unknown>]>().mockResolvedValue([]),
      },
      agentTask: {
        findMany: jest.fn<Promise<unknown[]>, [Record<string, unknown>]>().mockResolvedValue([]),
      },
      $transaction: jest.fn<Promise<unknown[]>, [unknown[]]>(),
    };

    prisma.$transaction.mockImplementation((operations) => Promise.all(operations));

    const module: TestingModule = await Test.createTestingModule({
      providers: [DashboardService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = module.get<DashboardService>(DashboardService);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('issues the $transaction with exactly 12 operations, in the documented order', async () => {
    await service.agentDashboard(query(), buildCaller());

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    const txArg = prisma.$transaction.mock.calls[0][0];
    expect(txArg).toHaveLength(12);

    expect(prisma.ticket.count).toHaveBeenCalledTimes(6);
    expect(prisma.ticket.groupBy).toHaveBeenCalledTimes(3);
    expect(prisma.ticket.findMany).toHaveBeenCalledTimes(3);

    // 1: assigned
    expect(prisma.ticket.count.mock.calls[0][0]).toEqual(
      containing({ where: { assignedAgentId: 'caller-1' } }),
    );
    // 2: open
    expect(prisma.ticket.count.mock.calls[1][0]).toEqual(
      containing({ where: containing({ assignedAgentId: 'caller-1', status: TicketStatus.OPEN }) }),
    );
    // 3: pending
    expect(prisma.ticket.count.mock.calls[2][0]).toEqual(
      containing({
        where: containing({ assignedAgentId: 'caller-1', status: TicketStatus.ON_HOLD }),
      }),
    );
    // 4: overdue
    expect(prisma.ticket.count.mock.calls[3][0]).toEqual(
      containing({ where: containing({ status: { in: ['OPEN', 'IN_PROGRESS', 'ON_HOLD'] } }) }),
    );
    // 5: unassigned
    expect(prisma.ticket.count.mock.calls[4][0]).toEqual(
      containing({ where: { assignedAgentId: null } }),
    );
    // 6: resolvedLast7Days
    expect(prisma.ticket.count.mock.calls[5][0]).toEqual(
      containing({
        where: containing({
          assignedAgentId: 'caller-1',
          status: { in: ['RESOLVED', 'CLOSED'] },
        }),
      }),
    );

    // 7-9: groupBy status/priority/category
    expect(prisma.ticket.groupBy.mock.calls[0][0]).toEqual(containing({ by: ['status'] }));
    expect(prisma.ticket.groupBy.mock.calls[1][0]).toEqual(containing({ by: ['priority'] }));
    expect(prisma.ticket.groupBy.mock.calls[2][0]).toEqual(containing({ by: ['category'] }));

    // 10: focusTickets
    expect(prisma.ticket.findMany.mock.calls[0][0]).toEqual(
      containing({
        orderBy: [{ priority: 'desc' }, { updatedAt: 'asc' }],
        take: DASHBOARD_LIST_LIMIT,
      }),
    );
    // 11: overdueTickets
    expect(prisma.ticket.findMany.mock.calls[1][0]).toEqual(
      containing({ orderBy: { updatedAt: 'asc' }, take: DASHBOARD_LIST_LIMIT }),
    );
    // 12: unassignedTickets
    expect(prisma.ticket.findMany.mock.calls[2][0]).toEqual(
      containing({
        where: containing({ assignedAgentId: null }),
        orderBy: [{ priority: 'desc' }, { createdAt: 'asc' }],
        take: DASHBOARD_LIST_LIMIT,
      }),
    );
  });

  describe('scopeWhere (via groupBy where)', () => {
    it('mine -> assignedAgentId === caller.id', async () => {
      await service.agentDashboard(query({ scope: TicketScope.Mine }), buildCaller({ id: 'a1' }));

      expect(prisma.ticket.groupBy.mock.calls[0][0]).toEqual(
        containing({ where: { assignedAgentId: 'a1' } }),
      );
    });

    it('unassigned -> assignedAgentId === null', async () => {
      await service.agentDashboard(query({ scope: TicketScope.Unassigned }), buildCaller());

      expect(prisma.ticket.groupBy.mock.calls[0][0]).toEqual(
        containing({ where: { assignedAgentId: null } }),
      );
    });

    it('all -> no assignment predicate', async () => {
      await service.agentDashboard(query({ scope: TicketScope.All }), buildCaller());

      const where = (prisma.ticket.groupBy.mock.calls[0][0] as { where: Record<string, unknown> })
        .where;
      expect(where.assignedAgentId).toBeUndefined();
      expect(where.AND).toBeUndefined();
    });

    it('workable -> AND/OR composition, never a bare where.OR', async () => {
      await service.agentDashboard(
        query({ scope: TicketScope.Workable }),
        buildCaller({ id: 'a1' }),
      );

      const where = (prisma.ticket.groupBy.mock.calls[0][0] as { where: Record<string, unknown> })
        .where;
      expect(where.AND).toEqual([{ OR: [{ assignedAgentId: 'a1' }, { assignedAgentId: null }] }]);
      expect(where.OR).toBeUndefined();
    });
  });

  describe('overdueWhere', () => {
    it('includes status: { in: ACTIVE_TICKET_STATUSES } and one OR term per priority with the correct cutoff', async () => {
      const fixedNow = new Date('2026-01-10T12:00:00.000Z');
      jest.useFakeTimers().setSystemTime(fixedNow);

      await service.agentDashboard(query({ scope: TicketScope.All }), buildCaller());

      // Overdue count is transaction index 3 (0-based).
      const overdueArg = prisma.ticket.count.mock.calls[3][0] as {
        where: { status: { in: string[] }; OR: { priority: string; updatedAt: { lt: Date } }[] };
      };

      expect(overdueArg.where.status).toEqual({ in: ['OPEN', 'IN_PROGRESS', 'ON_HOLD'] });
      expect(overdueArg.where.OR).toHaveLength(4);

      const byPriority = new Map(
        overdueArg.where.OR.map((term) => [term.priority, term.updatedAt.lt]),
      );
      expect(byPriority.get(TicketPriority.URGENT)).toEqual(new Date('2026-01-10T08:00:00.000Z'));
      expect(byPriority.get(TicketPriority.HIGH)).toEqual(new Date('2026-01-10T04:00:00.000Z'));
      expect(byPriority.get(TicketPriority.MEDIUM)).toEqual(new Date('2026-01-09T12:00:00.000Z'));
      expect(byPriority.get(TicketPriority.LOW)).toEqual(new Date('2026-01-07T12:00:00.000Z'));
    });

    it('does not clobber the scope AND/OR composition (workable + overdue)', async () => {
      await service.agentDashboard(
        query({ scope: TicketScope.Workable }),
        buildCaller({ id: 'a1' }),
      );

      const overdueArg = prisma.ticket.count.mock.calls[3][0] as {
        where: { AND: unknown; OR: unknown[] };
      };
      expect(overdueArg.where.AND).toEqual([
        { OR: [{ assignedAgentId: 'a1' }, { assignedAgentId: null }] },
      ]);
      // The `OR` present here is the overdue priority disjunction, not the
      // scope's — 4 entries, one per priority.
      expect(overdueArg.where.OR).toHaveLength(4);
    });
  });

  describe('bucket breakdowns', () => {
    it('byStatus/byPriority/byCategory contain every enum value, with count: 0, even when groupBy returns []', async () => {
      const result = await service.agentDashboard(query(), buildCaller());

      expect(result.byStatus).toHaveLength(Object.values(TicketStatus).length);
      expect(result.byStatus.every((b) => b.count === 0)).toBe(true);
      expect(result.byStatus.map((b) => b.key)).toEqual(Object.values(TicketStatus));

      expect(result.byPriority).toHaveLength(Object.values(TicketPriority).length);
      expect(result.byPriority.every((b) => b.count === 0)).toBe(true);

      expect(result.byCategory).toHaveLength(Object.values(TicketCategory).length);
      expect(result.byCategory.every((b) => b.count === 0)).toBe(true);
    });

    it('fills counts from a non-empty groupBy result and still includes zero buckets', async () => {
      prisma.ticket.groupBy.mockImplementation((args) => {
        const by = args.by as string[];
        if (by[0] === 'status') {
          return Promise.resolve([
            { status: TicketStatus.OPEN, _count: { _all: 3 } },
            { status: TicketStatus.RESOLVED, _count: { _all: 7 } },
          ]);
        }
        return Promise.resolve([]);
      });

      const result = await service.agentDashboard(query(), buildCaller());

      const open = result.byStatus.find((b) => b.key === TicketStatus.OPEN);
      const resolved = result.byStatus.find((b) => b.key === TicketStatus.RESOLVED);
      const closed = result.byStatus.find((b) => b.key === TicketStatus.CLOSED);

      expect(open?.count).toBe(3);
      expect(resolved?.count).toBe(7);
      expect(closed?.count).toBe(0);
    });
  });

  describe('focusTickets ordering', () => {
    it('orders priority desc then updatedAt asc, and takes DASHBOARD_LIST_LIMIT', async () => {
      await service.agentDashboard(query(), buildCaller());

      expect(prisma.ticket.findMany.mock.calls[0][0]).toEqual(
        containing({
          orderBy: [{ priority: 'desc' }, { updatedAt: 'asc' }],
          take: DASHBOARD_LIST_LIMIT,
        }),
      );
    });
  });

  describe('tasksDueSoon', () => {
    it('is [] when caller.permissions lacks tasks:read, and agentTask.findMany is not called', async () => {
      const caller = buildCaller({ permissions: ['dashboard:read', 'tickets:read'] });

      const result = await service.agentDashboard(query(), caller);

      expect(result.tasksDueSoon).toEqual([]);
      expect(prisma.agentTask.findMany).not.toHaveBeenCalled();
    });

    it('is populated when the caller holds tasks:read', async () => {
      const caller = buildCaller({ permissions: ['dashboard:read', 'tickets:read', 'tasks:read'] });
      prisma.agentTask.findMany.mockResolvedValue([
        {
          id: 'task-1',
          title: 'Call back about the invoice',
          status: 'OPEN',
          dueAt: new Date('2026-01-11T00:00:00.000Z'),
          remindAt: null,
          ticketId: null,
          customerId: null,
        },
      ]);

      const result = await service.agentDashboard(query(), caller);

      expect(result.tasksDueSoon).toHaveLength(1);
      expect(result.tasksDueSoon[0]).toEqual(
        containing({ id: 'task-1', title: 'Call back about the invoice' }),
      );
      expect(prisma.agentTask.findMany).toHaveBeenCalledWith(
        containing({
          where: containing({ assigneeId: caller.id, status: { in: ['OPEN', 'IN_PROGRESS'] } }),
          orderBy: [{ dueAt: 'asc' }, { createdAt: 'asc' }],
          take: DASHBOARD_LIST_LIMIT,
        }),
      );
    });

    it('isOverdue is true for a past dueAt with status OPEN', async () => {
      const fixedNow = new Date('2026-01-10T12:00:00.000Z');
      jest.useFakeTimers().setSystemTime(fixedNow);
      const caller = buildCaller({ permissions: ['dashboard:read', 'tickets:read', 'tasks:read'] });
      prisma.agentTask.findMany.mockResolvedValue([
        {
          id: 'task-1',
          title: 'Overdue task',
          status: 'OPEN',
          dueAt: new Date('2026-01-01T00:00:00.000Z'),
          remindAt: null,
          ticketId: null,
          customerId: null,
        },
      ]);

      const result = await service.agentDashboard(query(), caller);

      expect(result.tasksDueSoon[0].isOverdue).toBe(true);
    });

    it('isOverdue is false for a past dueAt with status DONE', async () => {
      const caller = buildCaller({ permissions: ['dashboard:read', 'tickets:read', 'tasks:read'] });
      prisma.agentTask.findMany.mockResolvedValue([
        {
          id: 'task-1',
          title: 'Done task',
          status: 'DONE',
          dueAt: new Date('2020-01-01T00:00:00.000Z'),
          remindAt: null,
          ticketId: null,
          customerId: null,
        },
      ]);

      const result = await service.agentDashboard(query(), caller);

      expect(result.tasksDueSoon[0].isOverdue).toBe(false);
    });

    it('isOverdue is false for dueAt: null', async () => {
      const caller = buildCaller({ permissions: ['dashboard:read', 'tickets:read', 'tasks:read'] });
      prisma.agentTask.findMany.mockResolvedValue([
        {
          id: 'task-1',
          title: 'No due date',
          status: 'OPEN',
          dueAt: null,
          remindAt: null,
          ticketId: null,
          customerId: null,
        },
      ]);

      const result = await service.agentDashboard(query(), caller);

      expect(result.tasksDueSoon[0].isOverdue).toBe(false);
      expect(result.tasksDueSoon[0].dueAt).toBeNull();
    });
  });

  it('generatedAt equals the single now used for every cutoff', async () => {
    const fixedNow = new Date('2026-01-10T12:00:00.000Z');
    jest.useFakeTimers().setSystemTime(fixedNow);

    const result = await service.agentDashboard(query(), buildCaller());

    expect(result.generatedAt).toBe(fixedNow.toISOString());
  });

  it('every embedded ticket list is mapped through TicketsService.toResponse (ISO date strings, counts object)', async () => {
    prisma.ticket.findMany.mockResolvedValueOnce([baseTicketRow]);

    const result = await service.agentDashboard(query(), buildCaller());

    expect(result.focusTickets[0].createdAt).toBe('2026-01-01T00:00:00.000Z');
    expect(result.focusTickets[0].counts).toEqual({ comments: 0, attachments: 0, history: 0 });
  });
});
