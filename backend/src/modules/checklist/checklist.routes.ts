import { Router } from 'express';
import { ChecklistController } from './checklist.controller';
import {
  createChecklistSchema,
  updateChecklistSchema,
  createChecklistItemSchema,
  updateChecklistItemSchema,
} from './checklist.schema';
import { validate } from '../../middlewares/validation.middleware';
import { authMiddleware } from '../auth/auth.middleware';

const nestedChecklistRouter: Router = Router({ mergeParams: true });
const checklistRouter: Router = Router();
const nestedChecklistItemRouter: Router = Router({ mergeParams: true });
const checklistItemRouter: Router = Router();

const controller = new ChecklistController();

nestedChecklistRouter.use(authMiddleware);
checklistRouter.use(authMiddleware);
nestedChecklistItemRouter.use(authMiddleware);
checklistItemRouter.use(authMiddleware);

// Nested checklists: /api/v1/cards/:cardId/checklists
nestedChecklistRouter.post(
  '/',
  validate(createChecklistSchema),
  controller.create.bind(controller)
);
nestedChecklistRouter.get('/', controller.list.bind(controller));

// Direct checklists: /api/v1/checklists/:id
checklistRouter.get('/:id', controller.getById.bind(controller));
checklistRouter.put('/:id', validate(updateChecklistSchema), controller.update.bind(controller));
checklistRouter.delete('/:id', controller.delete.bind(controller));

// Mount nested checklist item router
checklistRouter.use('/:checklistId/items', nestedChecklistItemRouter);

// Nested checklist items: /api/v1/checklists/:checklistId/items
nestedChecklistItemRouter.post(
  '/',
  validate(createChecklistItemSchema),
  controller.createItem.bind(controller)
);

// Direct checklist items: /api/v1/checklist-items/:id
checklistItemRouter.put(
  '/:id',
  validate(updateChecklistItemSchema),
  controller.updateItem.bind(controller)
);
checklistItemRouter.delete('/:id', controller.deleteItem.bind(controller));

export { nestedChecklistRouter, checklistRouter, nestedChecklistItemRouter, checklistItemRouter };
