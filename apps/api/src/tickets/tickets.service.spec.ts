import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { TicketCategory, TicketPriority, TicketStatus } from '@prisma/client';
import { TicketsService } from './tickets.service';
import { PrismaService } from '../prisma/prisma.service';
import type { AuthenticatedUser } from '../auth/types/authenticated-user';
import type { CreateTicketDto } from './dto/create-ticket.dto';
import { TicketScope, type ListTicketsQueryDto } from './dto/list-tickets-query.dto';

function containing(obj: Record<string, unknown>): unknown {
  return expect.objectContaining(obj);
}

interface TicketUpdateArgs {
  data: Record<string, unknown>;
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
  _count: { comments: 4, attachments: 2, history: 3 },
};

function buildCaller(overrides: Partial<AuthenticatedUser> = {}): AuthenticatedUser {
  return {
    id: 'caller-1',
    email: 'admin@crm.local',
    fullName: 'Admin',
    mustChangePassword: false,
    departmentId: null,
    branchId: null,
    roles: ['system-administrator'],
    // A system-administrator (the seeded role backing this fixture) holds
    // every permission key, tickets:assign included.
    permissions: ['tickets:read', 'tickets:write', 'tickets:manage', 'tickets:assign'],
    ...overrides,
  };
}

describe('TicketsService', () => {
  let service: TicketsService;
  let prisma: {
    ticket: {
      findMany: jest.Mock<Promise<unknown[]>, [Record<string, unknown>]>;
      count: jest.Mock;
      findUnique: jest.Mock;
      create: jest.Mock;
      update: jest.Mock<Promise<unknown>, [TicketUpdateArgs]>;
    };
    ticketHistory: { createMany: jest.Mock };
    customer: { findUnique: jest.Mock };
    user: { findUnique: jest.Mock };
    $transaction: jest.Mock;
  };

  beforeEach(async () => {
    prisma = {
      ticket: {
        findMany: jest.fn<Promise<unknown[]>, [Record<string, unknown>]>(),
        count: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn<Promise<unknown>, [TicketUpdateArgs]>(),
      },
      ticketHistory: { createMany: jest.fn() },
      customer: { findUnique: jest.fn() },
      user: { findUnique: jest.fn() },
      $transaction: jest.fn(),
    };

    prisma.$transaction.mockImplementation((arg: unknown) => {
      if (Array.isArray(arg)) {
        return Promise.all(arg as Promise<unknown>[]);
      }

      return (arg as (tx: typeof prisma) => Promise<unknown>)(prisma);
    });

    prisma.customer.findUnique.mockResolvedValue({ id: 'customer-1' });

    const module: TestingModule = await Test.createTestingModule({
      providers: [TicketsService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = module.get<TicketsService>(TicketsService);
  });

  function query(overrides: Partial<ListTicketsQueryDto> = {}): ListTicketsQueryDto {
    return { page: 1, pageSize: 20, scope: TicketScope.All, ...overrides };
  }

  describe('list', () => {
    it('builds an empty where and passes skip: 0, take: 20 with no filters', async () => {
      prisma.ticket.findMany.mockResolvedValue([]);
      prisma.ticket.count.mockResolvedValue(0);

      await service.list(query(), buildCaller());

      expect(prisma.ticket.findMany).toHaveBeenCalledWith(
        containing({ where: {}, skip: 0, take: 20 }),
      );
    });

    it('builds an OR over subject and description when search is present', async () => {
      prisma.ticket.findMany.mockResolvedValue([]);
      prisma.ticket.count.mockResolvedValue(0);

      await service.list(query({ search: 'login' }), buildCaller());

      expect(prisma.ticket.findMany).toHaveBeenCalledWith(
        containing({
          where: containing({
            OR: [
              { subject: { contains: 'login', mode: 'insensitive' } },
              { description: { contains: 'login', mode: 'insensitive' } },
            ],
          }),
        }),
      );
    });

    it('adds equality clauses for category, priority, status, assignedAgentId, and customerId', async () => {
      prisma.ticket.findMany.mockResolvedValue([]);
      prisma.ticket.count.mockResolvedValue(0);

      await service.list(
        query({
          category: TicketCategory.TECHNICAL,
          priority: TicketPriority.HIGH,
          status: TicketStatus.OPEN,
          assignedAgentId: 'agent-1',
          customerId: 'customer-1',
        }),
        buildCaller(),
      );

      expect(prisma.ticket.findMany).toHaveBeenCalledWith(
        containing({
          where: containing({
            category: TicketCategory.TECHNICAL,
            priority: TicketPriority.HIGH,
            status: TicketStatus.OPEN,
            assignedAgentId: 'agent-1',
            customerId: 'customer-1',
          }),
        }),
      );
    });

    it('orders by createdAt desc', async () => {
      prisma.ticket.findMany.mockResolvedValue([]);
      prisma.ticket.count.mockResolvedValue(0);

      await service.list(query(), buildCaller());

      expect(prisma.ticket.findMany).toHaveBeenCalledWith(
        containing({ orderBy: { createdAt: 'desc' } }),
      );
    });

    describe('scope', () => {
      beforeEach(() => {
        prisma.ticket.findMany.mockResolvedValue([]);
        prisma.ticket.count.mockResolvedValue(0);
      });

      it('scope=mine filters to assignedAgentId === caller.id', async () => {
        const caller = buildCaller({ id: 'caller-9' });

        await service.list(query({ scope: TicketScope.Mine }), caller);

        expect(prisma.ticket.findMany).toHaveBeenCalledWith(
          containing({ where: containing({ assignedAgentId: 'caller-9' }) }),
        );
      });

      it('scope=unassigned filters to assignedAgentId === null', async () => {
        await service.list(query({ scope: TicketScope.Unassigned }), buildCaller());

        expect(prisma.ticket.findMany).toHaveBeenCalledWith(
          containing({ where: containing({ assignedAgentId: null }) }),
        );
      });

      it('scope=workable composes an AND/OR, not a bare where.OR', async () => {
        const caller = buildCaller({ id: 'caller-9' });

        await service.list(query({ scope: TicketScope.Workable }), caller);

        const calledWith = prisma.ticket.findMany.mock.calls[0][0] as {
          where: Record<string, unknown>;
        };
        expect(calledWith.where.AND).toEqual([
          { OR: [{ assignedAgentId: 'caller-9' }, { assignedAgentId: null }] },
        ]);
        expect(calledWith.where.OR).toBeUndefined();
      });

      it('scope=all adds no assignment predicate', async () => {
        await service.list(query({ scope: TicketScope.All }), buildCaller());

        const calledWith = prisma.ticket.findMany.mock.calls[0][0] as {
          where: Record<string, unknown>;
        };
        expect(calledWith.where.assignedAgentId).toBeUndefined();
        expect(calledWith.where.AND).toBeUndefined();
      });

      it('scope=workable together with search keeps both the OR search clause and the AND assignment clause', async () => {
        const caller = buildCaller({ id: 'caller-9' });

        await service.list(query({ scope: TicketScope.Workable, search: 'login' }), caller);

        expect(prisma.ticket.findMany).toHaveBeenCalledWith(
          containing({
            where: containing({
              OR: [
                { subject: { contains: 'login', mode: 'insensitive' } },
                { description: { contains: 'login', mode: 'insensitive' } },
              ],
              AND: [{ OR: [{ assignedAgentId: 'caller-9' }, { assignedAgentId: null }] }],
            }),
          }),
        );
      });
    });
  });

  describe('toResponse (via list)', () => {
    it('maps _count into counts and emits ISO strings for createdAt/updatedAt', async () => {
      prisma.ticket.findMany.mockResolvedValue([baseTicketRow]);
      prisma.ticket.count.mockResolvedValue(1);

      const result = await service.list(query(), buildCaller());
      const item = result.items[0];

      expect(item.counts).toEqual({ comments: 4, attachments: 2, history: 3 });
      expect(item.createdAt).toBe('2026-01-01T00:00:00.000Z');
      expect(item.updatedAt).toBe('2026-01-02T00:00:00.000Z');
    });
  });

  describe('create', () => {
    const dto: CreateTicketDto = {
      customerId: 'customer-1',
      subject: 'Cannot log in',
      description: 'After password reset, login fails.',
    };

    it('rejects an unknown customerId with BadRequestException and never calls prisma.ticket.create', async () => {
      const caller = buildCaller();
      prisma.customer.findUnique.mockResolvedValue(null);

      await expect(service.create(dto, caller)).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.ticket.create).not.toHaveBeenCalled();
    });

    it('rejects an inactive assignedAgentId', async () => {
      const caller = buildCaller();
      prisma.user.findUnique.mockResolvedValue({ id: 'agent-1', isActive: false });

      await expect(
        service.create({ ...dto, assignedAgentId: 'agent-1' }, caller),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.ticket.create).not.toHaveBeenCalled();
    });

    it('sets createdById from the caller', async () => {
      const caller = buildCaller();
      prisma.ticket.create.mockResolvedValue(baseTicketRow);

      await service.create(dto, caller);

      expect(prisma.ticket.create).toHaveBeenCalledWith(
        containing({ data: containing({ createdById: caller.id }) }),
      );
    });

    it('with no assignedAgentId is unaffected by the assignment guard', async () => {
      const caller = buildCaller({ permissions: ['tickets:read', 'tickets:write'] });
      prisma.ticket.create.mockResolvedValue(baseTicketRow);

      await expect(service.create(dto, caller)).resolves.toBeDefined();
      expect(prisma.ticket.create).toHaveBeenCalled();
    });

    it('with a foreign assignedAgentId and no tickets:assign throws ForbiddenException', async () => {
      const caller = buildCaller({
        id: 'caller-1',
        permissions: ['tickets:read', 'tickets:write'],
      });
      prisma.user.findUnique.mockResolvedValue({ id: 'agent-1', isActive: true });

      await expect(
        service.create({ ...dto, assignedAgentId: 'agent-1' }, caller),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(prisma.ticket.create).not.toHaveBeenCalled();
    });

    it('permits self-claim on create without tickets:assign', async () => {
      const caller = buildCaller({
        id: 'caller-1',
        permissions: ['tickets:read', 'tickets:write'],
      });
      prisma.user.findUnique.mockResolvedValue({ id: 'caller-1', isActive: true });
      prisma.ticket.create.mockResolvedValue(baseTicketRow);

      await expect(
        service.create({ ...dto, assignedAgentId: 'caller-1' }, caller),
      ).resolves.toBeDefined();
    });
  });

  describe('update', () => {
    beforeEach(() => {
      prisma.ticket.findUnique.mockResolvedValue({
        id: baseTicketRow.id,
        category: TicketCategory.GENERAL,
        priority: TicketPriority.MEDIUM,
        assignedAgentId: null,
      });
      prisma.ticket.update.mockResolvedValue(baseTicketRow);
    });

    it('writes a TicketHistory row when category actually changes', async () => {
      const caller = buildCaller();

      await service.update(baseTicketRow.id, { category: TicketCategory.BILLING }, caller);

      expect(prisma.ticketHistory.createMany).toHaveBeenCalledWith(
        containing({
          data: [
            containing({
              field: 'category',
              oldValue: TicketCategory.GENERAL,
              newValue: TicketCategory.BILLING,
            }),
          ],
        }),
      );
    });

    it('writes no TicketHistory row when category is resent unchanged', async () => {
      const caller = buildCaller();

      await service.update(baseTicketRow.id, { category: TicketCategory.GENERAL }, caller);

      expect(prisma.ticketHistory.createMany).not.toHaveBeenCalled();
    });

    it('writes a TicketHistory row when priority actually changes', async () => {
      const caller = buildCaller();

      await service.update(baseTicketRow.id, { priority: TicketPriority.URGENT }, caller);

      expect(prisma.ticketHistory.createMany).toHaveBeenCalledWith(
        containing({
          data: [
            containing({
              field: 'priority',
              oldValue: TicketPriority.MEDIUM,
              newValue: TicketPriority.URGENT,
            }),
          ],
        }),
      );
    });

    it('connects assignedAgent and writes history when assignedAgentId is set from null', async () => {
      const caller = buildCaller();
      prisma.user.findUnique.mockResolvedValue({ id: 'agent-1', isActive: true });

      await service.update(baseTicketRow.id, { assignedAgentId: 'agent-1' }, caller);

      expect(prisma.ticket.update).toHaveBeenCalledWith(
        containing({ data: containing({ assignedAgent: { connect: { id: 'agent-1' } } }) }),
      );
      expect(prisma.ticketHistory.createMany).toHaveBeenCalledWith(
        containing({
          data: [containing({ field: 'assignedAgentId', oldValue: null, newValue: 'agent-1' })],
        }),
      );
    });

    it('disconnects assignedAgent when assignedAgentId is explicitly null', async () => {
      const caller = buildCaller();
      prisma.ticket.findUnique.mockResolvedValue({
        id: baseTicketRow.id,
        category: TicketCategory.GENERAL,
        priority: TicketPriority.MEDIUM,
        assignedAgentId: 'agent-1',
      });

      await service.update(baseTicketRow.id, { assignedAgentId: null }, caller);

      expect(prisma.ticket.update).toHaveBeenCalledWith(
        containing({ data: containing({ assignedAgent: { disconnect: true } }) }),
      );
    });

    it('leaves assignedAgentId untouched when the key is absent from the dto', async () => {
      const caller = buildCaller();

      await service.update(baseTicketRow.id, { subject: 'New subject' }, caller);

      const updateArgs = prisma.ticket.update.mock.calls[0][0];
      expect(updateArgs.data.assignedAgent).toBeUndefined();
      expect(prisma.ticketHistory.createMany).not.toHaveBeenCalled();
    });

    it('writes no history for an empty body', async () => {
      const caller = buildCaller();

      await service.update(baseTicketRow.id, {}, caller);

      expect(prisma.ticketHistory.createMany).not.toHaveBeenCalled();
    });

    it('with { assignedAgentId: <other> } and no tickets:assign throws ForbiddenException — the bypass test', async () => {
      const caller = buildCaller({
        id: 'caller-1',
        permissions: ['tickets:read', 'tickets:write'],
      });
      prisma.user.findUnique.mockResolvedValue({ id: 'agent-1', isActive: true });

      await expect(
        service.update(baseTicketRow.id, { assignedAgentId: 'agent-1' }, caller),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(prisma.ticket.update).not.toHaveBeenCalled();
    });

    it('with { priority: HIGH } and no assignedAgentId is unaffected by the assignment guard', async () => {
      const caller = buildCaller({
        id: 'caller-1',
        permissions: ['tickets:read', 'tickets:write'],
      });

      await expect(
        service.update(baseTicketRow.id, { priority: TicketPriority.HIGH }, caller),
      ).resolves.toBeDefined();
      expect(prisma.ticket.update).toHaveBeenCalled();
    });

    it('assertAgentExists runs before the permission guard — an unknown uuid gives 400, not 403', async () => {
      const caller = buildCaller({
        id: 'caller-1',
        permissions: ['tickets:read', 'tickets:write'],
      });
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(
        service.update(baseTicketRow.id, { assignedAgentId: 'unknown-agent' }, caller),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('assign', () => {
    const currentAssignedRow = { id: baseTicketRow.id, assignedAgentId: 'agent-1' };
    const currentUnassignedRow = { id: baseTicketRow.id, assignedAgentId: null as string | null };

    it('happy path writes one TicketHistory row with field assignedAgentId, history-insert first, inside a $transaction', async () => {
      const caller = buildCaller({
        id: 'caller-1',
        permissions: ['tickets:read', 'tickets:write', 'tickets:assign'],
      });
      prisma.ticket.findUnique.mockResolvedValue(currentAssignedRow);
      prisma.user.findUnique.mockResolvedValue({ id: 'agent-2', isActive: true });
      prisma.ticket.update.mockResolvedValue(baseTicketRow);

      await service.assign(baseTicketRow.id, 'agent-2', caller);

      expect(prisma.$transaction).toHaveBeenCalledWith(
        expect.arrayContaining([expect.anything(), expect.anything()]),
      );
      expect(prisma.ticketHistory.createMany).toHaveBeenCalledWith(
        containing({
          data: [
            containing({ field: 'assignedAgentId', oldValue: 'agent-1', newValue: 'agent-2' }),
          ],
        }),
      );
      expect(prisma.ticket.update).toHaveBeenCalledWith(
        containing({ data: containing({ assignedAgent: { connect: { id: 'agent-2' } } }) }),
      );

      const historyOrder = prisma.ticketHistory.createMany.mock.invocationCallOrder[0];
      const updateOrder = prisma.ticket.update.mock.invocationCallOrder[0];
      expect(historyOrder).toBeLessThan(updateOrder);
    });

    it('releasing writes oldValue/newValue correctly and disconnects', async () => {
      const caller = buildCaller({ id: 'agent-1', permissions: [] });
      prisma.ticket.findUnique.mockResolvedValue(currentAssignedRow);
      prisma.ticket.update.mockResolvedValue(baseTicketRow);

      await service.assign(baseTicketRow.id, null, caller);

      expect(prisma.ticketHistory.createMany).toHaveBeenCalledWith(
        containing({
          data: [containing({ field: 'assignedAgentId', oldValue: 'agent-1', newValue: null })],
        }),
      );
      expect(prisma.ticket.update).toHaveBeenCalledWith(
        containing({ data: containing({ assignedAgent: { disconnect: true } }) }),
      );
    });

    it('to the current assignee writes no history row and returns via findOne', async () => {
      const caller = buildCaller({
        id: 'caller-1',
        permissions: ['tickets:read', 'tickets:write', 'tickets:assign'],
      });
      prisma.ticket.findUnique.mockResolvedValueOnce(currentAssignedRow);
      prisma.ticket.findUnique.mockResolvedValueOnce(baseTicketRow);
      prisma.user.findUnique.mockResolvedValue({ id: 'agent-1', isActive: true });

      await service.assign(baseTicketRow.id, 'agent-1', caller);

      expect(prisma.ticketHistory.createMany).not.toHaveBeenCalled();
      expect(prisma.ticket.update).not.toHaveBeenCalled();
      // findOne re-queries via ticket.findUnique with the response projection.
      expect(prisma.ticket.findUnique).toHaveBeenCalledTimes(2);
    });

    it('throws ForbiddenException when the caller lacks tickets:assign and the target is neither the caller nor a self-release', async () => {
      const caller = buildCaller({
        id: 'caller-1',
        permissions: ['tickets:read', 'tickets:write'],
      });
      prisma.ticket.findUnique.mockResolvedValue(currentAssignedRow);
      prisma.user.findUnique.mockResolvedValue({ id: 'agent-2', isActive: true });

      await expect(service.assign(baseTicketRow.id, 'agent-2', caller)).rejects.toBeInstanceOf(
        ForbiddenException,
      );
      expect(prisma.ticket.update).not.toHaveBeenCalled();
    });

    it('permits self-claim without tickets:assign', async () => {
      const caller = buildCaller({
        id: 'caller-1',
        permissions: ['tickets:read', 'tickets:write'],
      });
      prisma.ticket.findUnique.mockResolvedValue(currentUnassignedRow);
      prisma.user.findUnique.mockResolvedValue({ id: 'caller-1', isActive: true });
      prisma.ticket.update.mockResolvedValue(baseTicketRow);

      await expect(service.assign(baseTicketRow.id, 'caller-1', caller)).resolves.toBeDefined();
    });

    it('permits self-release without tickets:assign', async () => {
      const caller = buildCaller({
        id: 'caller-1',
        permissions: ['tickets:read', 'tickets:write'],
      });
      prisma.ticket.findUnique.mockResolvedValue({
        id: baseTicketRow.id,
        assignedAgentId: 'caller-1',
      });
      prisma.ticket.update.mockResolvedValue(baseTicketRow);

      await expect(service.assign(baseTicketRow.id, null, caller)).resolves.toBeDefined();
    });

    it('permits any target when the caller holds tickets:assign', async () => {
      const caller = buildCaller({
        id: 'caller-1',
        permissions: ['tickets:read', 'tickets:write', 'tickets:assign'],
      });
      prisma.ticket.findUnique.mockResolvedValue(currentUnassignedRow);
      prisma.user.findUnique.mockResolvedValue({ id: 'agent-9', isActive: true });
      prisma.ticket.update.mockResolvedValue(baseTicketRow);

      await expect(service.assign(baseTicketRow.id, 'agent-9', caller)).resolves.toBeDefined();
    });

    it('rejects releasing a ticket assigned to someone else, without tickets:assign', async () => {
      const caller = buildCaller({
        id: 'caller-1',
        permissions: ['tickets:read', 'tickets:write'],
      });
      prisma.ticket.findUnique.mockResolvedValue({
        id: baseTicketRow.id,
        assignedAgentId: 'agent-2',
      });

      await expect(service.assign(baseTicketRow.id, null, caller)).rejects.toBeInstanceOf(
        ForbiddenException,
      );
      expect(prisma.ticket.update).not.toHaveBeenCalled();
    });

    it('assertAgentExists runs before assertMayAssign — an unknown uuid gives 400, not 403', async () => {
      const caller = buildCaller({
        id: 'caller-1',
        permissions: ['tickets:read', 'tickets:write'],
      });
      prisma.ticket.findUnique.mockResolvedValue(currentUnassignedRow);
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(
        service.assign(baseTicketRow.id, 'unknown-agent', caller),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.ticket.update).not.toHaveBeenCalled();
    });
  });

  describe('setStatus', () => {
    it('writes exactly one history row on a real transition', async () => {
      const caller = buildCaller();
      prisma.ticket.findUnique.mockResolvedValue({
        id: baseTicketRow.id,
        status: TicketStatus.OPEN,
      });
      prisma.ticket.update.mockResolvedValue({
        ...baseTicketRow,
        status: TicketStatus.IN_PROGRESS,
      });

      await service.setStatus(baseTicketRow.id, TicketStatus.IN_PROGRESS, caller);

      expect(prisma.ticketHistory.createMany).toHaveBeenCalledWith(
        containing({
          data: [
            containing({
              field: 'status',
              oldValue: TicketStatus.OPEN,
              newValue: TicketStatus.IN_PROGRESS,
            }),
          ],
        }),
      );
    });

    it('writes zero history rows on a same-value call', async () => {
      const caller = buildCaller();
      prisma.ticket.findUnique.mockResolvedValue({
        id: baseTicketRow.id,
        status: TicketStatus.OPEN,
      });
      prisma.ticket.update.mockResolvedValue(baseTicketRow);

      await service.setStatus(baseTicketRow.id, TicketStatus.OPEN, caller);

      expect(prisma.ticketHistory.createMany).not.toHaveBeenCalled();
    });
  });
});
