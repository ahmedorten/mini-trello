import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { AuthenticatedUser } from '../auth/types/authenticated-user';
import { ARCHIVE_PERMISSION, CustomersService, USER_REF_SELECT } from './customers.service';
import { CreateInteractionDto, InteractionResponseDto } from './dto/interaction.dto';

const FIVE_MINUTES_MS = 5 * 60 * 1000;

const INTERACTION_SELECT = {
  id: true,
  customerId: true,
  channel: true,
  direction: true,
  subject: true,
  body: true,
  occurredAt: true,
  createdAt: true,
  createdById: true,
  createdBy: { select: USER_REF_SELECT },
} satisfies Prisma.CustomerInteractionSelect;

type SelectedInteraction = Prisma.CustomerInteractionGetPayload<{
  select: typeof INTERACTION_SELECT;
}>;

@Injectable()
export class InteractionsService {
  private readonly logger = new Logger(InteractionsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly customersService: CustomersService,
  ) {}

  async list(customerId: string): Promise<InteractionResponseDto[]> {
    await this.customersService.assertExists(customerId);

    const interactions = await this.prisma.customerInteraction.findMany({
      where: { customerId },
      select: INTERACTION_SELECT,
      orderBy: [{ occurredAt: 'desc' }, { createdAt: 'desc' }],
    });

    return interactions.map((interaction) => InteractionsService.toResponse(interaction));
  }

  async create(
    customerId: string,
    dto: CreateInteractionDto,
    caller: AuthenticatedUser,
  ): Promise<InteractionResponseDto> {
    await this.customersService.assertExists(customerId);

    const occurredAt = new Date(dto.occurredAt);

    if (occurredAt.getTime() > Date.now() + FIVE_MINUTES_MS) {
      throw new BadRequestException('occurredAt cannot be in the future.');
    }

    const created = await this.prisma.customerInteraction.create({
      data: {
        customerId,
        createdById: caller.id,
        channel: dto.channel,
        direction: dto.direction,
        subject: dto.subject.trim(),
        body: dto.body?.trim(),
        occurredAt,
      },
      select: INTERACTION_SELECT,
    });

    this.logger.log(
      { actorId: caller.id, customerId, interactionId: created.id },
      'Interaction logged',
    );

    return InteractionsService.toResponse(created);
  }

  async remove(customerId: string, id: string, caller: AuthenticatedUser): Promise<void> {
    const interaction = await this.prisma.customerInteraction.findFirst({
      where: { id, customerId },
      select: { id: true, createdById: true },
    });

    if (!interaction) {
      throw new NotFoundException('Interaction not found.');
    }

    if (interaction.createdById !== caller.id && !caller.permissions.includes(ARCHIVE_PERMISSION)) {
      throw new ForbiddenException(
        'Only the author or a customer administrator can delete an interaction.',
      );
    }

    await this.prisma.customerInteraction.delete({ where: { id } });

    this.logger.log({ actorId: caller.id, customerId, interactionId: id }, 'Interaction deleted');
  }

  private static toResponse(interaction: SelectedInteraction): InteractionResponseDto {
    return {
      id: interaction.id,
      customerId: interaction.customerId,
      channel: interaction.channel,
      direction: interaction.direction,
      subject: interaction.subject,
      body: interaction.body,
      occurredAt: interaction.occurredAt.toISOString(),
      createdBy: interaction.createdBy,
      createdAt: interaction.createdAt.toISOString(),
    };
  }
}
