import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { CustomerStatus, InteractionChannel, InteractionDirection } from '@prisma/client';
import { InteractionsService } from './interactions.service';
import { CustomersService } from './customers.service';
import { PrismaService } from '../prisma/prisma.service';
import type { AuthenticatedUser } from '../auth/types/authenticated-user';

function containing(obj: Record<string, unknown>): unknown {
  return expect.objectContaining(obj);
}

const baseInteractionRow = {
  id: 'interaction-1',
  customerId: 'customer-1',
  createdById: 'author-1',
  channel: InteractionChannel.PHONE,
  direction: InteractionDirection.OUTBOUND,
  subject: 'Follow-up call',
  body: null as string | null,
  occurredAt: new Date('2026-01-01T00:00:00.000Z'),
  createdAt: new Date('2026-01-01T00:05:00.000Z'),
  createdBy: { id: 'author-1', fullName: 'Nour Hassan', email: 'nour@crm.local' },
  ticketId: null as string | null,
  ticket: null as { id: string; subject: string } | null,
};

function buildCaller(overrides: Partial<AuthenticatedUser> = {}): AuthenticatedUser {
  return {
    id: 'author-1',
    email: 'nour@crm.local',
    fullName: 'Nour Hassan',
    mustChangePassword: false,
    departmentId: null,
    branchId: null,
    roles: ['support-agent'],
    permissions: ['customers:read', 'interactions:write'],
    ...overrides,
  };
}

describe('InteractionsService', () => {
  let service: InteractionsService;
  let prisma: {
    customerInteraction: {
      findMany: jest.Mock;
      findFirst: jest.Mock;
      create: jest.Mock;
      delete: jest.Mock;
    };
    ticket: { findUnique: jest.Mock };
  };
  let customersService: { assertExists: jest.Mock };

  beforeEach(async () => {
    prisma = {
      customerInteraction: {
        findMany: jest.fn(),
        findFirst: jest.fn(),
        create: jest.fn(),
        delete: jest.fn(),
      },
      ticket: { findUnique: jest.fn() },
    };
    customersService = {
      assertExists: jest
        .fn()
        .mockResolvedValue({ id: 'customer-1', status: CustomerStatus.ACTIVE }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InteractionsService,
        { provide: PrismaService, useValue: prisma },
        { provide: CustomersService, useValue: customersService },
      ],
    }).compile();

    service = module.get<InteractionsService>(InteractionsService);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  const dto = {
    channel: InteractionChannel.PHONE,
    direction: InteractionDirection.OUTBOUND,
    subject: 'Follow-up call',
  };

  describe('create', () => {
    beforeEach(() => {
      jest.useFakeTimers().setSystemTime(new Date('2026-06-15T12:00:00.000Z'));
      prisma.customerInteraction.create.mockResolvedValue(baseInteractionRow);
    });

    it('succeeds with occurredAt one hour in the past', async () => {
      const caller = buildCaller();
      const occurredAt = new Date('2026-06-15T11:00:00.000Z').toISOString();

      await expect(
        service.create('customer-1', { ...dto, occurredAt }, caller),
      ).resolves.toBeDefined();
    });

    it('succeeds with occurredAt two minutes ahead (skew tolerance)', async () => {
      const caller = buildCaller();
      const occurredAt = new Date('2026-06-15T12:02:00.000Z').toISOString();

      await expect(
        service.create('customer-1', { ...dto, occurredAt }, caller),
      ).resolves.toBeDefined();
    });

    it('throws BadRequestException with occurredAt one hour ahead', async () => {
      const caller = buildCaller();
      const occurredAt = new Date('2026-06-15T13:00:00.000Z').toISOString();

      await expect(
        service.create('customer-1', { ...dto, occurredAt }, caller),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    describe('ticketId', () => {
      const occurredAt = new Date('2026-06-15T11:00:00.000Z').toISOString();

      it('succeeds and passes ticketId into data when the ticket belongs to the same customer', async () => {
        const caller = buildCaller();
        prisma.ticket.findUnique.mockResolvedValue({ id: 'ticket-1', customerId: 'customer-1' });

        await service.create('customer-1', { ...dto, occurredAt, ticketId: 'ticket-1' }, caller);

        expect(prisma.ticket.findUnique).toHaveBeenCalledWith(
          containing({ where: { id: 'ticket-1' } }),
        );
        expect(prisma.customerInteraction.create).toHaveBeenCalledWith(
          containing({ data: containing({ ticketId: 'ticket-1' }) }),
        );
      });

      it('throws BadRequestException when the ticket belongs to a different customer', async () => {
        const caller = buildCaller();
        prisma.ticket.findUnique.mockResolvedValue({ id: 'ticket-1', customerId: 'customer-2' });

        await expect(
          service.create('customer-1', { ...dto, occurredAt, ticketId: 'ticket-1' }, caller),
        ).rejects.toBeInstanceOf(BadRequestException);
        expect(prisma.customerInteraction.create).not.toHaveBeenCalled();
      });

      it('throws BadRequestException when the ticket is unknown', async () => {
        const caller = buildCaller();
        prisma.ticket.findUnique.mockResolvedValue(null);

        await expect(
          service.create('customer-1', { ...dto, occurredAt, ticketId: 'unknown-ticket' }, caller),
        ).rejects.toBeInstanceOf(BadRequestException);
        expect(prisma.customerInteraction.create).not.toHaveBeenCalled();
      });

      it('does not query prisma.ticket when ticketId is absent', async () => {
        const caller = buildCaller();

        await service.create('customer-1', { ...dto, occurredAt }, caller);

        expect(prisma.ticket.findUnique).not.toHaveBeenCalled();
      });
    });
  });

  describe('list', () => {
    it('keeps the original where ({ customerId } only) when called with no query — backward compatibility', async () => {
      prisma.customerInteraction.findMany.mockResolvedValue([]);

      await service.list('customer-1');

      expect(prisma.customerInteraction.findMany).toHaveBeenCalledWith(
        containing({ where: { customerId: 'customer-1' } }),
      );
    });

    it('orders by occurredAt then createdAt, both descending', async () => {
      prisma.customerInteraction.findMany.mockResolvedValue([]);

      await service.list('customer-1');

      expect(prisma.customerInteraction.findMany).toHaveBeenCalledWith(
        containing({ orderBy: [{ occurredAt: 'desc' }, { createdAt: 'desc' }] }),
      );
    });

    it('channel adds exactly its own predicate', async () => {
      prisma.customerInteraction.findMany.mockResolvedValue([]);

      await service.list('customer-1', { channel: InteractionChannel.EMAIL });

      expect(prisma.customerInteraction.findMany).toHaveBeenCalledWith(
        containing({ where: { customerId: 'customer-1', channel: InteractionChannel.EMAIL } }),
      );
    });

    it('direction adds exactly its own predicate', async () => {
      prisma.customerInteraction.findMany.mockResolvedValue([]);

      await service.list('customer-1', { direction: InteractionDirection.INBOUND });

      expect(prisma.customerInteraction.findMany).toHaveBeenCalledWith(
        containing({
          where: { customerId: 'customer-1', direction: InteractionDirection.INBOUND },
        }),
      );
    });

    it('ticketId adds exactly its own predicate', async () => {
      prisma.customerInteraction.findMany.mockResolvedValue([]);

      await service.list('customer-1', { ticketId: 'ticket-1' });

      expect(prisma.customerInteraction.findMany).toHaveBeenCalledWith(
        containing({ where: { customerId: 'customer-1', ticketId: 'ticket-1' } }),
      );
    });
  });

  describe('toResponse (via list)', () => {
    it('maps ticketId and the ticket ref when present', async () => {
      prisma.customerInteraction.findMany.mockResolvedValue([
        {
          ...baseInteractionRow,
          ticketId: 'ticket-1',
          ticket: { id: 'ticket-1', subject: 'Login issue' },
        },
      ]);

      const [result] = await service.list('customer-1');

      expect(result.ticketId).toBe('ticket-1');
      expect(result.ticket).toEqual({ id: 'ticket-1', subject: 'Login issue' });
    });

    it('maps ticketId and ticket to null when absent', async () => {
      prisma.customerInteraction.findMany.mockResolvedValue([baseInteractionRow]);

      const [result] = await service.list('customer-1');

      expect(result.ticketId).toBeNull();
      expect(result.ticket).toBeNull();
    });
  });

  it('has no update method — a later addition should trip this test', () => {
    expect((service as unknown as Record<string, unknown>).update).toBeUndefined();
  });
});
