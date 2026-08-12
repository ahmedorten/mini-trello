import { Router } from 'express';
import { DashboardController } from './dashboard.controller';
import { authMiddleware } from '../auth/auth.middleware';

const router = Router();
const controller = new DashboardController();

router.use(authMiddleware);

router.get('/', controller.getDashboard.bind(controller));

export default router;
