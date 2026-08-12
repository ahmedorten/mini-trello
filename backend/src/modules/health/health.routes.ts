import { Router } from 'express';
import { HealthController } from './health.controller';

const router: Router = Router();
const healthController: HealthController = new HealthController();

router.get('/health', healthController.getHealth.bind(healthController));

export default router;
