import { Router } from 'express';
import { CardController } from './card.controller';
import { createCardSchema, updateCardSchema, moveCardSchema } from './card.schema';
import { cardSearchSchema } from './card-search.schema';
import { validate, validateQuery } from '../../middlewares/validation.middleware';
import { authMiddleware } from '../auth/auth.middleware';
import { nestedCommentRouter } from '../comment';
import { nestedActivityRouter } from '../activity';
import { nestedChecklistRouter } from '../checklist';
import { nestedAttachmentRouter } from '../attachment';

const nestedCardRouter: Router = Router({ mergeParams: true });
const cardRouter: Router = Router();

const controller: CardController = new CardController();

// Apply auth middleware to both routers
nestedCardRouter.use(authMiddleware);
cardRouter.use(authMiddleware);

// Mount nested comment router
cardRouter.use('/:cardId/comments', nestedCommentRouter);

// Mount nested activity router
cardRouter.use('/:cardId/activities', nestedActivityRouter);

// Mount nested checklist router
cardRouter.use('/:cardId/checklists', nestedChecklistRouter);

// Mount nested attachment router
cardRouter.use('/:cardId/attachments', nestedAttachmentRouter);

// Column-nested endpoints: /api/v1/columns/:columnId/cards
nestedCardRouter.post('/', validate(createCardSchema), controller.create.bind(controller));
nestedCardRouter.get('/', controller.list.bind(controller));

// Direct endpoints: /api/v1/cards/:id
cardRouter.get('/search', validateQuery(cardSearchSchema), controller.search.bind(controller));
cardRouter.get('/:id', controller.getById.bind(controller));
cardRouter.put('/:id', validate(updateCardSchema), controller.update.bind(controller));
cardRouter.delete('/:id', controller.delete.bind(controller));
cardRouter.post('/:id/move', validate(moveCardSchema), controller.move.bind(controller));

// Label associations: /api/v1/cards/:cardId/labels/:labelId
cardRouter.post('/:cardId/labels/:labelId', controller.attachLabel.bind(controller));
cardRouter.delete('/:cardId/labels/:labelId', controller.detachLabel.bind(controller));

export { nestedCardRouter, cardRouter };
export default cardRouter;
