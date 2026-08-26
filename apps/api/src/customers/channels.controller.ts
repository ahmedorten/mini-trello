import { Controller, Get } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import { CHANNEL_ORDER, CHANNEL_REGISTRY } from './channel.registry';
import { ChannelListDto } from './dto/channel.dto';

@ApiTags('communication')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ description: 'Missing or invalid access token.' })
@ApiForbiddenResponse({ description: 'The caller lacks the required permission.' })
@Controller('communication/channels')
export class ChannelsController {
  @Get()
  @RequirePermissions('customers:read')
  @ApiOperation({
    summary: 'The communication channels this deployment knows about',
    description:
      'Static metadata. providerConfigured is false for every channel — no ' +
      'external sender is implemented; responding logs an OUTBOUND interaction.',
  })
  @ApiOkResponse({ type: ChannelListDto })
  list(): ChannelListDto {
    return { items: CHANNEL_ORDER.map((key) => CHANNEL_REGISTRY[key]) };
  }
}
