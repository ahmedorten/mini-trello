import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { TicketCategory, TicketPriority, TicketStatus } from '@prisma/client';
import { TicketsService } from './tickets.service';
import { PrismaService } from '../prisma/prisma.service';
import type { AuthenticatedUser } from '../auth/types/authenticated-user';
import type { CreateTicketDto } from './dto/create-ticket.dto';
import type { ListTicketsQueryDto } from './dto/list-tickets-query.dto';

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
    permissions: ['tickets:read', 'tickets:write', 'tickets:manage'],
    ...overrides,
  };
}

describe('TicketsService', () => {
  let service: TicketsService;
  let prisma: {
    ticket: {
      findMany: jest.Mock;
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
        findMany: jest.fn(),
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
    return { page: 1, pageSize: 20, ...overrides };
  }

  describe('list', () => {
    it('builds an empty where and passes skip: 0, take: 20 with no filters', async () => {
      prisma.ticket.findMany.mockResolvedValue([]);
      prisma.ticket.count.mockResolvedValue(0);

      await service.list(query());

      expect(prisma.ticket.findMany).toHaveBeenCalledWith(
        containing({ where: {}, skip: 0, take: 20 }),
      );
    });

    it('builds an OR over subject and description when search is present', async () => {
      prisma.ticket.findMany.mockResolvedValue([]);
      prisma.ticket.count.mockResolvedValue(0);

      await service.list(query({ search: 'login' }));

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

      await service.list(query());

      expect(prisma.ticket.findMany).toHaveBeenCalledWith(
        containing({ orderBy: { createdAt: 'desc' } }),
      );
    });
  });

  describe('toResponse (via list)', () => {
    it('maps _count into counts and emits ISO strings for createdAt/updatedAt', async () => {
      prisma.ticket.findMany.mockResolvedValue([baseTicketRow]);
      prisma.ticket.count.mockResolvedValue(1);

      const result = await service.list(query());
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
