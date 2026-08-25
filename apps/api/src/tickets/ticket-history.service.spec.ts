import { Test, TestingModule } from '@nestjs/testing';
import { TicketHistoryService } from './ticket-history.service';
import { TicketsService } from './tickets.service';
import { PrismaService } from '../prisma/prisma.service';

function containing(obj: Record<string, unknown>): unknown {
  return expect.objectContaining(obj);
}

const baseHistoryRow = {
  id: 'history-1',
  ticketId: 'ticket-1',
  field: 'status',
  oldValue: 'OPEN',
  newValue: 'IN_PROGRESS',
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  changedBy: { id: 'agent-1', fullName: 'Nour Hassan', email: 'nour@crm.local' },
};

describe('TicketHistoryService', () => {
  let service: TicketHistoryService;
  let prisma: { ticketHistory: { findMany: jest.Mock } };
  let ticketsService: { assertExists: jest.Mock };

  beforeEach(async () => {
    prisma = { ticketHistory: { findMany: jest.fn() } };
    ticketsService = { assertExists: jest.fn().mockResolvedValue({ id: 'ticket-1' }) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TicketHistoryService,
        { provide: PrismaService, useValue: prisma },
        { provide: TicketsService, useValue: ticketsService },
      ],
    }).compile();

    service = module.get<TicketHistoryService>(TicketHistoryService);
  });

  describe('list', () => {
    it('asserts the ticket exists before querying', async () => {
      prisma.ticketHistory.findMany.mockResolvedValue([]);

      await service.list('ticket-1');

      expect(ticketsService.assertExists).toHaveBeenCalledWith('ticket-1');
    });

    it('orders by createdAt descending scoped by ticketId', async () => {
      prisma.ticketHistory.findMany.mockResolvedValue([]);

      await service.list('ticket-1');

      expect(prisma.ticketHistory.findMany).toHaveBeenCalledWith(
        containing({ where: { ticketId: 'ticket-1' }, orderBy: { createdAt: 'desc' } }),
      );
    });

    it('maps rows via toResponse, emitting an ISO createdAt', async () => {
      prisma.ticketHistory.findMany.mockResolvedValue([baseHistoryRow]);

      const result = await service.list('ticket-1');

      expect(result[0]).toEqual({
        id: 'history-1',
        ticketId: 'ticket-1',
        field: 'status',
        oldValue: 'OPEN',
        newValue: 'IN_PROGRESS',
        changedBy: baseHistoryRow.changedBy,
        createdAt: '2026-01-01T00:00:00.000Z',
      });
    });
  });

  it('has no create/update/remove method — history is read-only', () => {
    const record = service as unknown as Record<string, unknown>;
    expect(record.create).toBeUndefined();
    expect(record.update).toBeUndefined();
    expect(record.remove).toBeUndefined();
  });
});
