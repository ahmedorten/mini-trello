import { Test, TestingModule } from '@nestjs/testing';
import { InteractionChannel, InteractionDirection } from '@prisma/client';
import { TicketInteractionsService } from './ticket-interactions.service';
import { TicketsService } from './tickets.service';
import { InteractionsService } from '../customers/interactions.service';
import { PrismaService } from '../prisma/prisma.service';
import type { AuthenticatedUser } from '../auth/types/authenticated-user';

function containing(obj: Record<string, unknown>): unknown {
  return expect.objectContaining(obj);
}

function buildCaller(overrides: Partial<AuthenticatedUser> = {}): AuthenticatedUser {
  return {
    id: 'caller-1',
    email: 'admin@crm.local',
    fullName: 'Admin',
    mustChangePassword: false,
    departmentId: null,
    branchId: null,
    roles: ['system-administrator'],
    permissions: ['tickets:read', 'interactions:write'],
    ...overrides,
  };
}

describe('TicketInteractionsService', () => {
  let service: TicketInteractionsService;
  let prisma: { ticket: { findUniqueOrThrow: jest.Mock } };
  let ticketsService: { assertExists: jest.Mock };
  let interactionsService: { list: jest.Mock; create: jest.Mock };

  beforeEach(async () => {
    prisma = { ticket: { findUniqueOrThrow: jest.fn() } };
    ticketsService = { assertExists: jest.fn().mockResolvedValue({ id: 'ticket-1' }) };
    interactionsService = { list: jest.fn(), create: jest.fn() };

    prisma.ticket.findUniqueOrThrow.mockResolvedValue({ id: 'ticket-1', customerId: 'customer-1' });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TicketInteractionsService,
        { provide: PrismaService, useValue: prisma },
        { provide: TicketsService, useValue: ticketsService },
        { provide: InteractionsService, useValue: interactionsService },
      ],
    }).compile();

    service = module.get<TicketInteractionsService>(TicketInteractionsService);
  });

  describe('list', () => {
    it('calls assertExists before any query', async () => {
      interactionsService.list.mockResolvedValue([]);

      await service.list('ticket-1', {});

      expect(ticketsService.assertExists).toHaveBeenCalledWith('ticket-1');
      const assertOrder = ticketsService.assertExists.mock.invocationCallOrder[0];
      const findOrder = prisma.ticket.findUniqueOrThrow.mock.invocationCallOrder[0];
      expect(assertOrder).toBeLessThan(findOrder);
    });

    it('passes ticketId as a filter by default', async () => {
      interactionsService.list.mockResolvedValue([]);

      await service.list('ticket-1', {});

      expect(interactionsService.list).toHaveBeenCalledWith(
        'customer-1',
        containing({ ticketId: 'ticket-1' }),
      );
    });

    it('passes ticketId: undefined when includeCustomerHistory is true', async () => {
      interactionsService.list.mockResolvedValue([]);

      await service.list('ticket-1', { includeCustomerHistory: true });

      expect(interactionsService.list).toHaveBeenCalledWith(
        'customer-1',
        containing({ ticketId: undefined }),
      );
    });

    it('forwards channel and direction', async () => {
      interactionsService.list.mockResolvedValue([]);

      await service.list('ticket-1', {
        channel: InteractionChannel.EMAIL,
        direction: InteractionDirection.OUTBOUND,
      });

      expect(interactionsService.list).toHaveBeenCalledWith(
        'customer-1',
        containing({ channel: InteractionChannel.EMAIL, direction: InteractionDirection.OUTBOUND }),
      );
    });
  });

  describe('create', () => {
    it('derives customerId from the ticket and injects ticketId, delegating to InteractionsService.create', async () => {
      const caller = buildCaller();
      const dto = {
        channel: InteractionChannel.PHONE,
        direction: InteractionDirection.OUTBOUND,
        subject: 'Follow-up call',
        occurredAt: new Date().toISOString(),
      };
      interactionsService.create.mockResolvedValue({ id: 'interaction-1' });

      await service.create('ticket-1', dto, caller);

      expect(interactionsService.create).toHaveBeenCalledWith(
        'customer-1',
        { ...dto, ticketId: 'ticket-1' },
        caller,
      );
    });

    it('calls assertExists (404 contract) before delegating', async () => {
      const caller = buildCaller();
      const dto = {
        channel: InteractionChannel.PHONE,
        direction: InteractionDirection.OUTBOUND,
        subject: 'Follow-up call',
        occurredAt: new Date().toISOString(),
      };
      interactionsService.create.mockResolvedValue({ id: 'interaction-1' });

      await service.create('ticket-1', dto, caller);

      expect(ticketsService.assertExists).toHaveBeenCalledWith('ticket-1');
    });
  });
});
