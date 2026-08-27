import { Module } from '@nestjs/common';
import { InteractionChannel } from '@prisma/client';
import { AuthModule } from '../auth/auth.module';
import { CustomersModule } from '../customers/customers.module';
import { TicketsModule } from '../tickets/tickets.module';
import { ChannelRegistryService } from './channel-registry.service';
import { ChannelsController } from './channels.controller';
import { CommunicationController } from './communication.controller';
import { CommunicationService } from './communication.service';
import { CHANNEL_ADAPTERS, ChannelAdapter } from './channels/channel-adapter';
import { EmailChannel } from './channels/email.channel';
import { LiveChatChannel } from './channels/live-chat.channel';
import { LoggedOnlyChannel } from './channels/logged-only.channel';
import { SmsChannel } from './channels/sms.channel';
import { WebFormChannel } from './channels/web-form.channel';
import { WhatsAppChannel } from './channels/whatsapp.channel';
import { InboundSecretGuard } from './guards/inbound-secret.guard';
import { InboundController } from './inbound.controller';
import { TimelineService } from './timeline.service';

/** PHONE, MEETING, and OTHER carry the exact canRespond/isRealtime values the
 *  deleted CHANNEL_REGISTRY carried for them. */
const LOGGED_ONLY_ADAPTERS: ChannelAdapter[] = [
  new LoggedOnlyChannel(InteractionChannel.PHONE, false, true),
  new LoggedOnlyChannel(InteractionChannel.MEETING, false, false),
  new LoggedOnlyChannel(InteractionChannel.OTHER, true, false),
];

/**
 * CustomersModule and TicketsModule are imported here — not later — because
 * that is where this module's dependency edges belong, and both already export
 * what the dispatch and timeline services need. There is no cycle: TicketsModule
 * imports CustomersModule, and neither imports CommunicationModule.
 */
@Module({
  imports: [AuthModule, CustomersModule, TicketsModule],
  controllers: [ChannelsController, CommunicationController, InboundController],
  providers: [
    EmailChannel,
    WhatsAppChannel,
    LiveChatChannel,
    SmsChannel,
    WebFormChannel,
    ChannelRegistryService,
    CommunicationService,
    TimelineService,
    // ConfigModule is global (app.module.ts), so ConfigService needs no import.
    InboundSecretGuard,
    {
      provide: CHANNEL_ADAPTERS,
      inject: [EmailChannel, WhatsAppChannel, LiveChatChannel, SmsChannel, WebFormChannel],
      useFactory: (...injected: ChannelAdapter[]): ChannelAdapter[] => [
        ...injected,
        ...LOGGED_ONLY_ADAPTERS,
      ],
    },
  ],
  exports: [ChannelRegistryService],
})
export class CommunicationModule {}
