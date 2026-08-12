import { Router } from 'express';
import { CommentController } from './comment.controller';
import { createCommentSchema, updateCommentSchema } from './comment.schema';
import { validate } from '../../middlewares/validation.middleware';
import { authMiddleware } from '../auth/auth.middleware';

const nestedCommentRouter: Router = Router({ mergeParams: true });
const commentRouter: Router = Router();

const controller: CommentController = new CommentController();

nestedCommentRouter.use(authMiddleware);
commentRouter.use(authMiddleware);

// Nested routes: /api/v1/cards/:cardId/comments
nestedCommentRouter.post('/', validate(createCommentSchema), controller.create.bind(controller));
nestedCommentRouter.get('/', controller.list.bind(controller));

// Direct routes: /api/v1/comments/:id
commentRouter.get('/:id', controller.getById.bind(controller));
commentRouter.put('/:id', validate(updateCommentSchema), controller.update.bind(controller));
commentRouter.delete('/:id', controller.delete.bind(controller));

export { nestedCommentRouter, commentRouter };
export default commentRouter;
