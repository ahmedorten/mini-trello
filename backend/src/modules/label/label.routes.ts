import { Router } from 'express';
import { LabelController } from './label.controller';
import { createLabelSchema, updateLabelSchema } from './label.schema';
import { validate } from '../../middlewares/validation.middleware';
import { authMiddleware } from '../auth/auth.middleware';

const nestedLabelRouter: Router = Router({ mergeParams: true });
const labelRouter: Router = Router();

const controller: LabelController = new LabelController();

// Apply authentication middleware
nestedLabelRouter.use(authMiddleware);
labelRouter.use(authMiddleware);

// Board-nested endpoints: /api/v1/boards/:boardId/labels
nestedLabelRouter.post('/', validate(createLabelSchema), controller.create.bind(controller));
nestedLabelRouter.get('/', controller.list.bind(controller));

// Direct endpoints: /api/v1/labels/:id
labelRouter.get('/:id', controller.getById.bind(controller));
labelRouter.put('/:id', validate(updateLabelSchema), controller.update.bind(controller));
labelRouter.delete('/:id', controller.delete.bind(controller));

export { nestedLabelRouter, labelRouter };
export default labelRouter;
