import { Router } from 'express';
import { ColumnController } from './column.controller';
import { createColumnSchema, updateColumnSchema } from './column.schema';
import { validate } from '../../middlewares/validation.middleware';
import { authMiddleware } from '../auth/auth.middleware';
import { nestedCardRouter } from '../card/card.routes';

const nestedColumnRouter: Router = Router({ mergeParams: true });
const columnRouter: Router = Router();

const controller: ColumnController = new ColumnController();

// Apply auth middleware to both routers
nestedColumnRouter.use(authMiddleware);
columnRouter.use(authMiddleware);

// Mount nested card router
columnRouter.use('/:columnId/cards', nestedCardRouter);
nestedColumnRouter.post('/', validate(createColumnSchema), controller.create.bind(controller));
nestedColumnRouter.get('/', controller.list.bind(controller));

// Direct endpoints: /api/v1/columns/:id
columnRouter.get('/:id', controller.getById.bind(controller));
columnRouter.put('/:id', validate(updateColumnSchema), controller.update.bind(controller));
columnRouter.delete('/:id', controller.delete.bind(controller));

export { nestedColumnRouter, columnRouter };
export default columnRouter;
