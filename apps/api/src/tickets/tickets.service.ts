import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Prisma, TicketStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { USER_REF_SELECT } from '../customers/customers.service';
import type { AuthenticatedUser } from '../auth/types/authenticated-user';
import { CreateTicketDto } from './dto/create-ticket.dto';
import { UpdateTicketDto } from './dto/update-ticket.dto';
import { ListTicketsQueryDto } from './dto/list-tickets-query.dto';
import { PaginatedTicketsDto, TicketResponseDto } from './dto/ticket-response.dto';

export const TICKET_MANAGE_PERMISSION = 'tickets:manage';

const CUSTOMER_REF_SELECT = {
  id: true,
  name: true,
  email: true,
} satisfies Prisma.CustomerSelect;

/** The ONLY projection used for ticket responses. */
const TICKET_SELECT = {
  id: true,
  subject: true,
  description: true,
  category: true,
  priority: true,
  status: true,
  createdAt: true,
  updatedAt: true,
  customer: { select: CUSTOMER_REF_SELECT },
  assignedAgent: { select: USER_REF_SELECT },
  createdBy: { select: USER_REF_SELECT },
  _count: { select: { comments: true, attachments: true, history: true } },
} satisfies Prisma.TicketSelect;

type SelectedTicket = Prisma.TicketGetPayload<{ select: typeof TICKET_SELECT }>;

@Injectable()
export class TicketsService {
  private readonly logger = new Logger(TicketsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async list(query: ListTicketsQueryDto): Promise<PaginatedTicketsDto> {
    const where: Prisma.TicketWhereInput = {};

    if (query.search) {
      where.OR = [
        { subject: { contains: query.search, mode: 'insensitive' } },
        { description: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    if (query.category) where.category = query.category;
    if (query.priority) where.priority = query.priority;
    if (query.status) where.status = query.status;
    if (query.assignedAgentId) where.assignedAgentId = query.assignedAgentId;
    if (query.customerId) where.customerId = query.customerId;

    const [items, total] = await this.prisma.$transaction([
      this.prisma.ticket.findMany({
        where,
        select: TICKET_SELECT,
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.ticket.count({ where }),
    ]);

    return {
      items: items.map((item) => TicketsService.toResponse(item)),
      meta: {
        page: query.page,
        pageSize: query.pageSize,
        total,
        totalPages: Math.max(1, Math.ceil(total / query.pageSize)),
      },
    };
  }

  async findOne(id: string): Promise<TicketResponseDto> {
    const ticket = await this.prisma.ticket.findUnique({ where: { id }, select: TICKET_SELECT });

    if (!ticket) {
      throw new NotFoundException('Ticket not found.');
    }

    return TicketsService.toResponse(ticket);
  }

  async create(dto: CreateTicketDto, caller: AuthenticatedUser): Promise<TicketResponseDto> {
    await this.assertCustomerExists(dto.customerId);
    await this.assertAgentExists(dto.assignedAgentId);

    const created = await this.prisma.ticket.create({
      data: {
        customerId: dto.customerId,
        subject: dto.subject.trim(),
        description: dto.description.trim(),
        category: dto.category,
        priority: dto.priority,
        assignedAgentId: dto.assignedAgentId,
        createdById: caller.id,
      },
      select: TICKET_SELECT,
    });

    this.logger.log({ actorId: caller.id, ticketId: created.id }, 'Ticket created');

    return TicketsService.toResponse(created);
  }

  async update(
    id: string,
    dto: UpdateTicketDto,
    caller: AuthenticatedUser,
  ): Promise<TicketResponseDto> {
    const current = await this.prisma.ticket.findUnique({
      where: { id },
      select: { id: true, category: true, priority: true, assignedAgentId: true },
    });

    if (!current) {
      throw new NotFoundException('Ticket not found.');
    }

    // `dto.assignedAgentId !== undefined`, not `'assignedAgentId' in dto`: under
    // this project's TS target, class-transformer's instance always carries an
    // own `assignedAgentId` property (from the class field declaration) even
    // when the client never sent the key, so an `in` check is always true.
    // class-transformer only overwrites the field with the client's value —
    // `undefined` reliably means "omitted", `null` means "explicit clear".
    if (dto.assignedAgentId !== undefined) {
      await this.assertAgentExists(dto.assignedAgentId ?? undefined);
    }

    const data: Prisma.TicketUpdateInput = {};
    const historyRows: Prisma.TicketHistoryCreateManyInput[] = [];

    if (dto.subject !== undefined) data.subject = dto.subject.trim();
    if (dto.description !== undefined) data.description = dto.description.trim();

    if (dto.category !== undefined && dto.category !== current.category) {
      data.category = dto.category;
      historyRows.push({
        ticketId: id,
        changedById: caller.id,
        field: 'category',
        oldValue: current.category,
        newValue: dto.category,
      });
    }

    if (dto.priority !== undefined && dto.priority !== current.priority) {
      data.priority = dto.priority;
      historyRows.push({
        ticketId: id,
        changedById: caller.id,
        field: 'priority',
        oldValue: current.priority,
        newValue: dto.priority,
      });
    }

    if (dto.assignedAgentId !== undefined && dto.assignedAgentId !== current.assignedAgentId) {
      data.assignedAgent = dto.assignedAgentId
        ? { connect: { id: dto.assignedAgentId } }
        : { disconnect: true };
      historyRows.push({
        ticketId: id,
        changedById: caller.id,
        field: 'assignedAgentId',
        oldValue: current.assignedAgentId,
        newValue: dto.assignedAgentId ?? null,
      });
    }

    // The history insert runs BEFORE the update-with-select: `_count.history`
    // is computed as part of that select, so it must see the just-inserted
    // row rather than the pre-transaction count.
    const results = await this.prisma.$transaction([
      ...(historyRows.length > 0
        ? [this.prisma.ticketHistory.createMany({ data: historyRows })]
        : []),
      this.prisma.ticket.update({ where: { id }, data, select: TICKET_SELECT }),
    ]);
    const updated = results[results.length - 1];

    this.logger.log({ actorId: caller.id, ticketId: id }, 'Ticket updated');

    return TicketsService.toResponse(updated as SelectedTicket);
  }

  async setStatus(
    id: string,
    status: TicketStatus,
    caller: AuthenticatedUser,
  ): Promise<TicketResponseDto> {
    const current = await this.prisma.ticket.findUnique({
      where: { id },
      select: { id: true, status: true },
    });

    if (!current) {
      throw new NotFoundException('Ticket not found.');
    }

    // Same ordering reasoning as update(): the history insert must run before
    // the select that reports `_count.history`.
    const results = await this.prisma.$transaction([
      ...(status !== current.status
        ? [
            this.prisma.ticketHistory.createMany({
              data: [
                {
                  ticketId: id,
                  changedById: caller.id,
                  field: 'status',
                  oldValue: current.status,
                  newValue: status,
                },
              ],
            }),
          ]
        : []),
      this.prisma.ticket.update({ where: { id }, data: { status }, select: TICKET_SELECT }),
    ]);
    const updated = results[results.length - 1];

    this.logger.log(
      { actorId: caller.id, ticketId: id, from: current.status, to: status },
      'Ticket status changed',
    );

    return TicketsService.toResponse(updated as SelectedTicket);
  }

  /** Public: reused by the comments/attachments/history services so every
   *  nested route 404s on an unknown ticket before touching a child table. */
  async assertExists(id: string): Promise<{ id: string }> {
    const exists = await this.prisma.ticket.findUnique({ where: { id }, select: { id: true } });

    if (!exists) {
      throw new NotFoundException('Ticket not found.');
    }

    return exists;
  }

  private async assertCustomerExists(customerId: string): Promise<void> {
    const exists = await this.prisma.customer.findUnique({
      where: { id: customerId },
      select: { id: true },
    });

    if (!exists) {
      throw new BadRequestException('Unknown customerId.');
    }
  }

  private async assertAgentExists(assignedAgentId?: string): Promise<void> {
    if (!assignedAgentId) {
      return;
    }

    const agent = await this.prisma.user.findUnique({
      where: { id: assignedAgentId },
      select: { id: true, isActive: true },
    });

    if (!agent) {
      throw new BadRequestException('Unknown assignedAgentId.');
    }

    if (!agent.isActive) {
      throw new BadRequestException('Cannot assign an inactive user.');
    }
  }

  private static toResponse(ticket: SelectedTicket): TicketResponseDto {
    return {
      id: ticket.id,
      customer: ticket.customer,
      subject: ticket.subject,
      description: ticket.description,
      category: ticket.category,
      priority: ticket.priority,
      status: ticket.status,
      assignedAgent: ticket.assignedAgent,
      createdBy: ticket.createdBy,
      counts: {
        comments: ticket._count.comments,
        attachments: ticket._count.attachments,
        history: ticket._count.history,
      },
      createdAt: ticket.createdAt.toISOString(),
      updatedAt: ticket.updatedAt.toISOString(),
    };
  }
}
