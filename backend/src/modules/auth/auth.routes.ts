import { Router } from 'express';
import { AuthController } from './auth.controller';
import { registerSchema, loginSchema } from './auth.schema';
import { validate } from '../../middlewares/validation.middleware';
import { authMiddleware } from './auth.middleware';

const router: Router = Router();
const controller: AuthController = new AuthController();

router.post('/register', validate(registerSchema), controller.register.bind(controller));
router.post('/login', validate(loginSchema), controller.login.bind(controller));
router.get('/me', authMiddleware, controller.getMe.bind(controller));

export default router;
