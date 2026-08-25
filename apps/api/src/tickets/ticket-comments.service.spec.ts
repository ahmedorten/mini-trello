import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { TicketCommentsService } from './ticket-comments.service';
import { TicketsService } from './tickets.service';
import { PrismaService } from '../prisma/prisma.service';
import type { AuthenticatedUser } from '../auth/types/authenticated-user';

function containing(obj: Record<string, unknown>): unknown {
  return expect.objectContaining(obj);
}

const baseCommentRow = {
  id: 'comment-1',
  ticketId: 'ticket-1',
  authorId: 'author-1',
  body: 'Called the customer back.',
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-01-02T00:00:00.000Z'),
  author: { id: 'author-1', fullName: 'Nour Hassan', email: 'nour@crm.local' },
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
    permissions: ['tickets:read', 'ticket-comments:write'],
    ...overrides,
  };
}

describe('TicketCommentsService', () => {
  let service: TicketCommentsService;
  let prisma: {
    ticketComment: {
      findMany: jest.Mock;
      findFirst: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
      delete: jest.Mock;
    };
  };
  let ticketsService: { assertExists: jest.Mock };

  beforeEach(async () => {
    prisma = {
      ticketComment: {
        findMany: jest.fn(),
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
    };
    ticketsService = {
      assertExists: jest.fn().mockResolvedValue({ id: 'ticket-1' }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TicketCommentsService,
        { provide: PrismaService, useValue: prisma },
        { provide: TicketsService, useValue: ticketsService },
      ],
    }).compile();

    service = module.get<TicketCommentsService>(TicketCommentsService);
  });

  describe('list', () => {
    it('asserts the ticket exists, then orders by createdAt descending scoped by ticketId', async () => {
      prisma.ticketComment.findMany.mockResolvedValue([]);

      await service.list('ticket-1');

      expect(ticketsService.assertExists).toHaveBeenCalledWith('ticket-1');
      expect(prisma.ticketComment.findMany).toHaveBeenCalledWith(
        containing({ where: { ticketId: 'ticket-1' }, orderBy: { createdAt: 'desc' } }),
      );
    });
  });

  describe('create', () => {
    it('trims the body and sets authorId from the caller', async () => {
      const caller = buildCaller();
      prisma.ticketComment.create.mockResolvedValue(baseCommentRow);

      await service.create('ticket-1', { body: '  hello there  ' }, caller);

      expect(prisma.ticketComment.create).toHaveBeenCalledWith(
        containing({ data: containing({ body: 'hello there', authorId: caller.id }) }),
      );
    });
  });

  describe('update', () => {
    it('throws ForbiddenException for a non-author and never calls update', async () => {
      const caller = buildCaller({ id: 'someone-else' });
      prisma.ticketComment.findFirst.mockResolvedValue(baseCommentRow);

      await expect(
        service.update('ticket-1', 'comment-1', { body: 'edited' }, caller),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(prisma.ticketComment.update).not.toHaveBeenCalled();
    });

    it("a tickets:manage holder still cannot edit someone else's comment", async () => {
      const caller = buildCaller({ id: 'manager', permissions: ['tickets:manage'] });
      prisma.ticketComment.findFirst.mockResolvedValue(baseCommentRow);

      await expect(
        service.update('ticket-1', 'comment-1', { body: 'edited' }, caller),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('throws NotFoundException for a comment from another ticket, scoping findFirst by both ids', async () => {
      const caller = buildCaller();
      prisma.ticketComment.findFirst.mockResolvedValue(null);

      await expect(
        service.update('ticket-1', 'comment-1', { body: 'edited' }, caller),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma.ticketComment.findFirst).toHaveBeenCalledWith(
        containing({ where: { id: 'comment-1', ticketId: 'ticket-1' } }),
      );
    });

    it('succeeds for the author', async () => {
      const caller = buildCaller();
      prisma.ticketComment.findFirst.mockResolvedValue(baseCommentRow);
      prisma.ticketComment.update.mockResolvedValue(baseCommentRow);

      await expect(
        service.update('ticket-1', 'comment-1', { body: 'edited' }, caller),
      ).resolves.toBeDefined();
    });
  });

  describe('remove', () => {
    it('succeeds for the author', async () => {
      const caller = buildCaller();
      prisma.ticketComment.findFirst.mockResolvedValue(baseCommentRow);

      await expect(service.remove('ticket-1', 'comment-1', caller)).resolves.toBeUndefined();
    });

    it('throws for a stranger without tickets:manage', async () => {
      const caller = buildCaller({ id: 'stranger', permissions: ['tickets:read'] });
      prisma.ticketComment.findFirst.mockResolvedValue(baseCommentRow);

      await expect(service.remove('ticket-1', 'comment-1', caller)).rejects.toBeInstanceOf(
        ForbiddenException,
      );
    });

    it('succeeds for a stranger with tickets:manage', async () => {
      const caller = buildCaller({ id: 'stranger', permissions: ['tickets:manage'] });
      prisma.ticketComment.findFirst.mockResolvedValue(baseCommentRow);

      await expect(service.remove('ticket-1', 'comment-1', caller)).resolves.toBeUndefined();
    });
  });
});
