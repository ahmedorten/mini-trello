import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { AttachmentStorageService } from '../common/attachment-storage.service';
import { AttachmentsController } from './attachments.controller';
import { AttachmentsService } from './attachments.service';
import { CustomersController } from './customers.controller';
import { CustomersService } from './customers.service';
import { InteractionsController } from './interactions.controller';
import { InteractionsService } from './interactions.service';
import { NotesController } from './notes.controller';
import { NotesService } from './notes.service';

@Module({
  imports: [AuthModule],
  controllers: [
    CustomersController,
    NotesController,
    AttachmentsController,
    InteractionsController,
  ],
  providers: [
    CustomersService,
    NotesService,
    AttachmentsService,
    InteractionsService,
    AttachmentStorageService,
  ],
  exports: [CustomersService],
})
export class CustomersModule {}
