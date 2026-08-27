import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { AuthenticatedUser } from '../auth/types/authenticated-user';
import { INTERACTION_SELECT, InteractionsService } from '../customers/interactions.service';
import { ListConversationsQueryDto, ListTimelineQueryDto } from './dto/list-timeline-query.dto';
import { ConversationDto, ConversationListDto, PaginatedTimelineDto } from './dto/timeline.dto';

@Injectable()
export class TimelineService {
  private readonly logger = new Logger(TimelineService.name);

  constructor(private readonly prisma: PrismaService) {}

  async list(
    query: ListTimelineQueryDto,
    caller: AuthenticatedUser,
  ): Promise<PaginatedTimelineDto> {
    const where: Prisma.CustomerInteractionWhereInput = {};

    if (query.channel) where.channel = query.channel;
    if (query.direction) where.direction = query.direction;
    if (query.deliveryStatus) where.deliveryStatus = query.deliveryStatus;
    if (query.customerId) where.customerId = query.customerId;
    // ticketLinkedOnly first, then ticketId: a specific ticket is narrower than
    // "any ticket", so the second assignment deliberately wins.
    if (query.ticketLinkedOnly) where.ticketId = { not: null };
    if (query.ticketId) where.ticketId = query.ticketId;

    // An explicit assignedAgentId wins over `mine` — same precedence as
    // AgentTasksService.list().
    const agentId = query.assignedAgentId ?? (query.mine ? caller.id : undefined);

    if (agentId) where.customer = { assignedAgentId: agentId };

    if (query.occurredFrom || query.occurredTo) {
      where.occurredAt = {
        ...(query.occurredFrom ? { gte: new Date(query.occurredFrom) } : {}),
        ...(query.occurredTo ? { lte: new Date(query.occurredTo) } : {}),
      };
    }

    if (query.search) {
      where.OR = [
        { subject: { contains: query.search, mode: 'insensitive' } },
        { body: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    const [items, total] = await this.prisma.$transaction([
      this.prisma.customerInteraction.findMany({
        where,
        select: INTERACTION_SELECT,
        // The same two keys as the per-customer timeline: occurredAt is
        // agent-supplied and can tie, so createdAt is the tiebreak that makes
        // pagination stable across pages.
        orderBy: [{ occurredAt: 'desc' }, { createdAt: 'desc' }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.customerInteraction.count({ where }),
    ]);

    return {
      items: InteractionsService.toResponseList(items),
      meta: {
        page: query.page,
        pageSize: query.pageSize,
        total,
        totalPages: Math.max(1, Math.ceil(total / query.pageSize)),
      },
    };
  }

  async conversations(
    query: ListConversationsQueryDto,
    caller: AuthenticatedUser,
  ): Promise<ConversationListDto> {
    const where: Prisma.CustomerInteractionWhereInput = {};

    if (query.customerId) where.customerId = query.customerId;
    if (query.channel) where.channel = query.channel;

    const agentId = query.assignedAgentId ?? (query.mine ? caller.id : undefined);

    if (agentId) where.customer = { assignedAgentId: agentId };

    // The total group count needs its own read, computed BEFORE the early
    // return: a page past the last group returns [] but the total is not zero.
    // This reads one row per conversation, which is bounded by the number of
    // distinct threads, not by message volume.
    const allGroups = await this.prisma.customerInteraction.groupBy({
      by: ['customerId', 'channel', 'threadKey'],
      where,
    });
    const total = allGroups.length;

    const meta = {
      page: query.page,
      pageSize: query.pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / query.pageSize)),
    };

    const groups = await this.prisma.customerInteraction.groupBy({
      by: ['customerId', 'channel', 'threadKey'],
      where,
      _count: { _all: true },
      _max: { occurredAt: true },
      orderBy: { _max: { occurredAt: 'desc' } },
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
    });

    if (groups.length === 0) {
      return { items: [], meta };
    }

    // One follow-up read for the representative rows. Prisma cannot return the
    // newest row per group from groupBy, and a raw window function would be the
    // only raw SQL in this API — not worth it for a preview line.
    //
    // An explicit `threadKey: null` in the OR is emitted by Prisma as IS NULL,
    // which is exactly the Product-rule-11 "earlier history" bucket.
    const rows = await this.prisma.customerInteraction.findMany({
      where: {
        OR: groups.map((group) => ({
          customerId: group.customerId,
          channel: group.channel,
          threadKey: group.threadKey,
          occurredAt: group._max.occurredAt as Date,
        })),
      },
      select: INTERACTION_SELECT,
      orderBy: [{ occurredAt: 'desc' }, { createdAt: 'desc' }],
    });

    const items: ConversationDto[] = [];

    for (const group of groups) {
      // Product rule 12: the tie is real but degenerate — two messages in one
      // conversation at the identical millisecond. The first in the ordered
      // result wins, deterministically per query.
      const row = rows.find(
        (candidate) =>
          candidate.customerId === group.customerId &&
          candidate.channel === group.channel &&
          candidate.threadKey === group.threadKey,
      );

      if (!row) {
        // Only possible if a row was deleted between the two queries. Skip it:
        // ConversationDto says lastMessage is non-null and must stay honest.
        this.logger.warn(
          { customerId: group.customerId, channel: group.channel, threadKey: group.threadKey },
          'Conversation group has no representative row; skipping',
        );
        continue;
      }

      items.push({
        customer: row.customer,
        channel: group.channel,
        threadKey: group.threadKey,
        messageCount: group._count._all,
        lastOccurredAt: (group._max.occurredAt as Date).toISOString(),
        lastMessage: InteractionsService.toResponse(row),
      });
    }

    return { items, meta };
  }
}
