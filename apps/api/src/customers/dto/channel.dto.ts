import { ApiProperty } from '@nestjs/swagger';
import { InteractionChannel } from '@prisma/client';

export class ChannelDescriptorDto {
  @ApiProperty({ enum: InteractionChannel })
  key!: InteractionChannel;

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
}

/** An object wrapper, not a bare array, so a `defaultChannel` hint can be added
 *  later without a breaking change. */
export class ChannelListDto {
  @ApiProperty({ type: () => [ChannelDescriptorDto] })
  items!: ChannelDescriptorDto[];
}
