import { Router } from 'express';
import { BoardController } from './board.controller';
import { createBoardSchema, updateBoardSchema } from './board.schema';
import { boardSearchSchema } from './board-search.schema';
import { validate, validateQuery } from '../../middlewares/validation.middleware';
import { authMiddleware } from '../auth/auth.middleware';
import { nestedColumnRouter } from '../column/column.routes';
import { nestedLabelRouter } from '../label/label.routes';

const router: Router = Router();
const controller: BoardController = new BoardController();

router.use(authMiddleware);

router.use('/:boardId/columns', nestedColumnRouter);
router.use('/:boardId/labels', nestedLabelRouter);

router.post('/', validate(createBoardSchema), controller.create.bind(controller));
router.get('/', validateQuery(boardSearchSchema), controller.search.bind(controller));
router.get('/:id', controller.getById.bind(controller));
router.put('/:id', validate(updateBoardSchema), controller.update.bind(controller));
router.delete('/:id', controller.delete.bind(controller));

export default router;
