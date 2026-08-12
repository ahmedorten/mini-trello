import { Router } from 'express';
import multer from 'multer';
import { AttachmentController } from './attachment.controller';
import { updateAttachmentSchema } from './attachment.schema';
import { validate } from '../../middlewares/validation.middleware';
import { authMiddleware } from '../auth/auth.middleware';

const nestedAttachmentRouter = Router({ mergeParams: true });
const attachmentRouter = Router();

const controller = new AttachmentController();

// Multer memory storage setup
const upload = multer({
  storage: multer.memoryStorage(),
});

nestedAttachmentRouter.use(authMiddleware);
attachmentRouter.use(authMiddleware);

// Nested: /api/v1/cards/:cardId/attachments
nestedAttachmentRouter.post('/', upload.single('file'), controller.create.bind(controller));
nestedAttachmentRouter.get('/', controller.list.bind(controller));

// Direct: /api/v1/attachments/:id
attachmentRouter.get('/:id', controller.getById.bind(controller));
attachmentRouter.get('/:id/download', controller.download.bind(controller));
attachmentRouter.put('/:id', validate(updateAttachmentSchema), controller.update.bind(controller));
attachmentRouter.delete('/:id', controller.delete.bind(controller));

export { nestedAttachmentRouter, attachmentRouter };
