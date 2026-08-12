import { Router } from 'express';
import { ActivityController } from './activity.controller';
import { authMiddleware } from '../auth/auth.middleware';

const nestedActivityRouter: Router = Router({ mergeParams: true });
const controller = new ActivityController();

nestedActivityRouter.use(authMiddleware);

nestedActivityRouter.get('/', controller.list.bind(controller));

export { nestedActivityRouter };
export default nestedActivityRouter;
