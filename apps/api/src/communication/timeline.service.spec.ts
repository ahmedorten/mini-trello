import {
  InteractionChannel,
  InteractionDeliveryStatus,
  InteractionDirection,
} from '@prisma/client';
import { TimelineService } from './timeline.service';
import { PrismaService } from '../prisma/prisma.service';
import type { AuthenticatedUser } from '../auth/types/authenticated-user';
import { ListConversationsQueryDto, ListTimelineQueryDto } from './dto/list-timeline-query.dto';

function containing(obj: Record<string, unknown>): unknown {
  return expect.objectContaining(obj);
}

function buildCaller(overrides: Partial<AuthenticatedUser> = {}): AuthenticatedUser {
  return {
    id: 'caller-1',
    email: 'nour@crm.local',
    fullName: 'Nour Hassan',
    mustChangePassword: false,
    departmentId: null,
    branchId: null,
    roles: ['support-agent'],
    permissions: ['customers:read'],
    ...overrides,
  };
}

function query(overrides: Partial<ListTimelineQueryDto> = {}): ListTimelineQueryDto {
  return { page: 1, pageSize: 20, ...overrides } as ListTimelineQueryDto;
}

function conversationQuery(
  overrides: Partial<ListConversationsQueryDto> = {},
): ListConversationsQueryDto {
  return { page: 1, pageSize: 20, ...overrides } as ListConversationsQueryDto;
}

const baseRow = {
  id: 'interaction-1',
  customerId: 'customer-1',
  channel: InteractionChannel.EMAIL,
  direction: InteractionDirection.INBOUND,
  subject: 'Quote request',
  body: 'Please call me.',
  occurredAt: new Date('2026-06-15T11:00:00.000Z'),
  createdAt: new Date('2026-06-15T11:05:00.000Z'),
  createdById: null,
  createdBy: null,
  ticketId: null,
  ticket: null,
  customer: { id: 'customer-1', name: 'Layla Ibrahim', email: 'layla@crm.local' },
  deliveryStatus: InteractionDeliveryStatus.RECEIVED,
  channelAddress: 'layla@crm.local',
  externalId: null,
  failureReason: null,
  threadKey: 'EMAIL:layla@crm.local',
};

describe('TimelineService', () => {
  let service: TimelineService;
  let prisma: {
    customerInteraction: { findMany: jest.Mock; count: jest.Mock; groupBy: jest.Mock };
    $transaction: jest.Mock;
  };

  beforeEach(() => {
    prisma = {
      customerInteraction: {
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
        groupBy: jest.fn().mockResolvedValue([]),
      },
      // The real $transaction takes an array of prepared promises; the mocks
      // above already resolve, so awaiting them reproduces its shape.
      $transaction: jest.fn((operations: Promise<unknown>[]) => Promise.all(operations)),
    };

    service = new TimelineService(prisma as unknown as PrismaService);
  });

  /** The `where` the service handed to findMany. */
  function capturedWhere(): Record<string, unknown> {
    return prisma.customerInteraction.findMany.mock.calls[0][0].where as Record<string, unknown>;
  }

  describe('list — filters', () => {
    it('an empty query produces an empty where', async () => {
      await service.list(query(), buildCaller());

      expect(capturedWhere()).toEqual({});
    });

    it.each([
      ['channel', { channel: InteractionChannel.SMS }, { channel: InteractionChannel.SMS }],
      [
        'direction',
        { direction: InteractionDirection.OUTBOUND },
        { direction: InteractionDirection.OUTBOUND },
      ],
      [
        'deliveryStatus',
        { deliveryStatus: InteractionDeliveryStatus.FAILED },
        { deliveryStatus: InteractionDeliveryStatus.FAILED },
      ],
      ['customerId', { customerId: 'customer-9' }, { customerId: 'customer-9' }],
      ['ticketId', { ticketId: 'ticket-9' }, { ticketId: 'ticket-9' }],
    ])('%s lands in where as specified', async (_name, input, expected) => {
      await service.list(query(input), buildCaller());

      expect(capturedWhere()).toEqual(expected);
    });

    it('ticketLinkedOnly produces { not: null }', async () => {
      await service.list(query({ ticketLinkedOnly: true }), buildCaller());

      expect(capturedWhere()).toEqual({ ticketId: { not: null } });
    });

    it('an explicit ticketId is narrower and wins over ticketLinkedOnly', async () => {
      await service.list(query({ ticketLinkedOnly: true, ticketId: 'ticket-9' }), buildCaller());

      expect(capturedWhere()).toEqual({ ticketId: 'ticket-9' });
    });

    it('mine resolves to the caller', async () => {
      await service.list(query({ mine: true }), buildCaller());

      expect(capturedWhere()).toEqual({ customer: { assignedAgentId: 'caller-1' } });
    });

    it('an explicit assignedAgentId wins over mine', async () => {
      await service.list(query({ mine: true, assignedAgentId: 'agent-9' }), buildCaller());

      expect(capturedWhere()).toEqual({ customer: { assignedAgentId: 'agent-9' } });
    });

    it('occurredFrom and occurredTo produce gte/lte on ONE occurredAt object', async () => {
      await service.list(
        query({
          occurredFrom: '2026-06-01T00:00:00.000Z',
          occurredTo: '2026-06-30T00:00:00.000Z',
        }),
        buildCaller(),
      );

      expect(capturedWhere()).toEqual({
        occurredAt: {
          gte: new Date('2026-06-01T00:00:00.000Z'),
          lte: new Date('2026-06-30T00:00:00.000Z'),
        },
      });
    });

    it('occurredFrom alone produces only gte', async () => {
      await service.list(query({ occurredFrom: '2026-06-01T00:00:00.000Z' }), buildCaller());

      expect(capturedWhere()).toEqual({
        occurredAt: { gte: new Date('2026-06-01T00:00:00.000Z') },
      });
    });

    it('search produces the two-branch case-insensitive OR', async () => {
      await service.list(query({ search: 'quote' }), buildCaller());

      expect(capturedWhere()).toEqual({
        OR: [
          { subject: { contains: 'quote', mode: 'insensitive' } },
          { body: { contains: 'quote', mode: 'insensitive' } },
        ],
      });
    });

    it('reaches Prisma with LIKE metacharacters as a literal string, not a wildcard', async () => {
      await service.list(query({ search: 'a%b' }), buildCaller());

      expect(capturedWhere()).toEqual({
        OR: [
          { subject: { contains: 'a%b', mode: 'insensitive' } },
          { body: { contains: 'a%b', mode: 'insensitive' } },
        ],
      });
    });
  });

  describe('list — ordering, paging, and meta', () => {
    it('orders by occurredAt then createdAt, both descending', async () => {
      await service.list(query(), buildCaller());

      expect(prisma.customerInteraction.findMany).toHaveBeenCalledWith(
        containing({ orderBy: [{ occurredAt: 'desc' }, { createdAt: 'desc' }] }),
      );
    });

    it('derives skip and take from page and pageSize', async () => {
      await service.list(query({ page: 3, pageSize: 15 }), buildCaller());

      expect(prisma.customerInteraction.findMany).toHaveBeenCalledWith(
        containing({ skip: 30, take: 15 }),
      );
    });

    it('totalPages is 1 when total is 0', async () => {
      const result = await service.list(query(), buildCaller());

      expect(result.meta).toEqual({ page: 1, pageSize: 20, total: 0, totalPages: 1 });
      expect(result.items).toEqual([]);
    });

    it('an over-range page returns [] with truthful meta, not a 404', async () => {
      prisma.customerInteraction.count.mockResolvedValue(42);

      const result = await service.list(query({ page: 9999 }), buildCaller());

      expect(result.items).toEqual([]);
      expect(result.meta).toEqual({ page: 9999, pageSize: 20, total: 42, totalPages: 3 });
    });

    it('maps rows through the shared InteractionsService projection', async () => {
      prisma.customerInteraction.findMany.mockResolvedValue([baseRow]);
      prisma.customerInteraction.count.mockResolvedValue(1);

      const result = await service.list(query(), buildCaller());

      expect(result.items[0]).toEqual(
        containing({
          id: 'interaction-1',
          occurredAt: '2026-06-15T11:00:00.000Z',
          deliveryStatus: InteractionDeliveryStatus.RECEIVED,
          threadKey: 'EMAIL:layla@crm.local',
          createdBy: null,
        }),
      );
      expect(result.items[0]).not.toHaveProperty('metadata');
    });
  });

  describe('conversations', () => {
    const group = {
      customerId: 'customer-1',
      channel: InteractionChannel.EMAIL,
      threadKey: 'EMAIL:layla@crm.local',
      _count: { _all: 3 },
      _max: { occurredAt: new Date('2026-06-15T11:00:00.000Z') },
    };

    it('groups on customerId, channel, and threadKey, newest last-message first', async () => {
      prisma.customerInteraction.groupBy
        .mockResolvedValueOnce([group])
        .mockResolvedValueOnce([group]);
      prisma.customerInteraction.findMany.mockResolvedValue([baseRow]);

      const result = await service.conversations(conversationQuery(), buildCaller());

      expect(prisma.customerInteraction.groupBy).toHaveBeenLastCalledWith(
        containing({
          by: ['customerId', 'channel', 'threadKey'],
          orderBy: { _max: { occurredAt: 'desc' } },
        }),
      );
      expect(result.items).toHaveLength(1);
      expect(result.items[0]).toEqual(
        containing({
          channel: InteractionChannel.EMAIL,
          threadKey: 'EMAIL:layla@crm.local',
          messageCount: 3,
          lastOccurredAt: '2026-06-15T11:00:00.000Z',
        }),
      );
      expect(result.items[0].lastMessage.id).toBe('interaction-1');
      expect(result.items[0].customer).toEqual({
        id: 'customer-1',
        name: 'Layla Ibrahim',
        email: 'layla@crm.local',
      });
    });

    it('computes total from the unpaginated group count even when the page is empty', async () => {
      // Three conversations exist; the requested page is past the end.
      prisma.customerInteraction.groupBy
        .mockResolvedValueOnce([group, group, group])
        .mockResolvedValueOnce([]);

      const result = await service.conversations(conversationQuery({ page: 9999 }), buildCaller());

      expect(result.items).toEqual([]);
      expect(result.meta).toEqual({ page: 9999, pageSize: 20, total: 3, totalPages: 1 });
    });

    it('queries a threadKey: null group with an explicit null (Prisma emits IS NULL)', async () => {
      const nullGroup = { ...group, threadKey: null };
      prisma.customerInteraction.groupBy
        .mockResolvedValueOnce([nullGroup])
        .mockResolvedValueOnce([nullGroup]);
      prisma.customerInteraction.findMany.mockResolvedValue([{ ...baseRow, threadKey: null }]);

      const result = await service.conversations(conversationQuery(), buildCaller());

      expect(prisma.customerInteraction.findMany).toHaveBeenCalledWith(
        containing({
          where: {
            OR: [
              containing({ threadKey: null, customerId: 'customer-1' }),
            ],
          },
        }),
      );
      expect(result.items[0].threadKey).toBeNull();
    });

    it('skips a group whose representative row is missing rather than nulling lastMessage', async () => {
      prisma.customerInteraction.groupBy
        .mockResolvedValueOnce([group])
        .mockResolvedValueOnce([group]);
      prisma.customerInteraction.findMany.mockResolvedValue([]);

      const result = await service.conversations(conversationQuery(), buildCaller());

      expect(result.items).toEqual([]);
      // The group still counts towards the total: it exists, it just could not
      // be previewed.
      expect(result.meta.total).toBe(1);
    });

    it('mine and assignedAgentId narrow the group query the same way', async () => {
      prisma.customerInteraction.groupBy.mockResolvedValue([]);

      await service.conversations(
        conversationQuery({ mine: true, assignedAgentId: 'agent-9' }),
        buildCaller(),
      );

      expect(prisma.customerInteraction.groupBy).toHaveBeenCalledWith(
        containing({ where: { customer: { assignedAgentId: 'agent-9' } } }),
      );
    });
  });

  it('ListConversationsQueryDto accepts no search and no direction (Product rule: a group filter must match every message in the group)', () => {
    const instance = new ListConversationsQueryDto();

    expect('search' in instance).toBe(false);
    expect('direction' in instance).toBe(false);
  });
});
