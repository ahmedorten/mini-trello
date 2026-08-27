import {
  BadRequestException,
  Body,
  Controller,
  HttpStatus,
  Param,
  ParseEnumPipe,
  Post,
  Res,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiCreatedResponse,
  ApiHeader,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiServiceUnavailableResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { InteractionChannel } from '@prisma/client';
import type { Response } from 'express';
import { Public } from '../auth/decorators/public.decorator';
import { InteractionResponseDto } from '../customers/dto/interaction.dto';
import { CommunicationService } from './communication.service';
import { InboundMessageDto } from './dto/inbound-message.dto';
import { InboundSecretGuard } from './guards/inbound-secret.guard';

/**
 * A separate controller, not a fourth method on CommunicationController: the
 * class-level @Public() and @UseGuards are the reason. Putting them on one
 * method of an otherwise bearer-authenticated controller invites someone to add
 * a fifth method and inherit the public gate by accident.
 */
@ApiTags('communication-inbound')
@Controller('communication/inbound')
@Public()
@UseGuards(InboundSecretGuard)
export class InboundController {
  constructor(private readonly communication: CommunicationService) {}

  @Post(':channel')
  @ApiOperation({
    summary: 'Ingest a message that arrived on a channel',
    description:
      'Machine-to-machine. Requires the x-communication-secret header matching ' +
      'COMMUNICATION_INBOUND_SECRET; 503 when that variable is unset. ' +
      'Idempotent on (channel, externalId): a repeat delivery returns 200 with ' +
      'the stored interaction instead of 201.',
  })
  @ApiHeader({ name: 'x-communication-secret', required: true })
  @ApiCreatedResponse({ type: InteractionResponseDto, description: 'Stored.' })
  @ApiOkResponse({ type: InteractionResponseDto, description: 'Already stored; nothing written.' })
  @ApiUnauthorizedResponse({ description: 'Invalid or missing inbound secret.' })
  @ApiServiceUnavailableResponse({ description: 'COMMUNICATION_INBOUND_SECRET is not set.' })
  @ApiBadRequestResponse({
    description:
      'Validation failed, the channel does not accept inbound messages, or ' +
      'neither customerId nor a usable address was supplied.',
  })
  @ApiNotFoundResponse({ description: 'No customer matches that address.' })
  async ingest(
    // ParseEnumPipe's default message does not name the valid values; a webhook
    // integrator posting to the wrong path needs them, so the factory lists them.
    @Param(
      'channel',
      new ParseEnumPipe(InteractionChannel, {
        exceptionFactory: () =>
          new BadRequestException(
            `channel must be one of: ${Object.values(InteractionChannel).join(', ')}`,
          ),
      }),
    )
    channel: InteractionChannel,
    @Body() dto: InboundMessageDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<InteractionResponseDto> {
    const { interaction, created } = await this.communication.ingest(channel, dto);

    // 201 for a first delivery, 200 for a retry (Product rule 5). A fixed
    // @HttpCode cannot express both, so set it here. passthrough: true keeps
    // Nest's serialisation; a bare @Res() would break it.
    response.status(created ? HttpStatus.CREATED : HttpStatus.OK);

    return interaction;
  }
}
