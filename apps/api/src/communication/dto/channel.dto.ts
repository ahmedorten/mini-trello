import { ApiProperty } from '@nestjs/swagger';
import { InteractionChannel } from '@prisma/client';
import { ChannelAddressKind } from '../channels/channel-adapter';

export class ChannelDescriptorDto {
  @ApiProperty({ enum: InteractionChannel })
  key!: InteractionChannel;

  // --- the four fields Story 19 shipped; text unchanged -------------------
  @ApiProperty({ description: 'The workspace offers a Respond composer for this channel.' })
  canRespond!: boolean;

  @ApiProperty({ description: 'The channel is conversational rather than logged-after-the-fact.' })
  isRealtime!: boolean;

  @ApiProperty({
    description:
      'Whether an external sender is wired up for this channel. False for every ' +
      'channel today — no provider integration exists in this project yet.',
  })
  providerConfigured!: boolean;

  // --- new in Story 22; additive only ------------------------------------
  @ApiProperty({ description: 'The channel can receive through the inbound ingestion route.' })
  acceptsInbound!: boolean;

  @ApiProperty({ enum: ['email', 'phone', 'session', 'none'] })
  addressKind!: ChannelAddressKind;

  @ApiProperty({ description: 'Dispatch fails with 400 when no address can be resolved.' })
  requiresAddress!: boolean;

  @ApiProperty({ required: false, nullable: true, example: 1600 })
  maxBodyLength!: number | null;

  @ApiProperty({ description: 'False when the adapter synthesises the subject from the body.' })
  supportsSubject!: boolean;
}

/** An object wrapper, not a bare array, so a `defaultChannel` hint can be added
 *  later without a breaking change. */
export class ChannelListDto {
  @ApiProperty({ type: () => [ChannelDescriptorDto] })
  items!: ChannelDescriptorDto[];
}
