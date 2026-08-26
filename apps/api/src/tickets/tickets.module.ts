import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { CustomersModule } from '../customers/customers.module';
import { AttachmentStorageService } from '../common/attachment-storage.service';
import { TicketsController } from './tickets.controller';
import { TicketsService } from './tickets.service';
import { TicketCommentsController } from './ticket-comments.controller';
import { TicketCommentsService } from './ticket-comments.service';
import { TicketAttachmentsController } from './ticket-attachments.controller';
import { TicketAttachmentsService } from './ticket-attachments.service';
import { TicketHistoryController } from './ticket-history.controller';
import { TicketHistoryService } from './ticket-history.service';
import { TicketInteractionsController } from './ticket-interactions.controller';
import { TicketInteractionsService } from './ticket-interactions.service';

@Module({
  imports: [AuthModule, CustomersModule],
  controllers: [
    TicketsController,
    TicketCommentsController,
    TicketAttachmentsController,
    TicketHistoryController,
    TicketInteractionsController,
  ],
  providers: [
    TicketsService,
    TicketCommentsService,
    TicketAttachmentsService,
    TicketHistoryService,
    AttachmentStorageService,
    TicketInteractionsService,
  ],
  exports: [TicketsService],
})
export class TicketsModule {}
