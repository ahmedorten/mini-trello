import express, { Express } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import loggerMiddleware from './middlewares/logger.middleware';
import notFoundMiddleware from './middlewares/not-found.middleware';
import errorMiddleware from './middlewares/error.middleware';
import healthRouter from './modules/health';
import authRouter from './modules/auth';
import boardRouter from './modules/board';
import dashboardRouter from './modules/dashboard';
import columnRouter from './modules/column';
import cardRouter from './modules/card';
import labelRouter from './modules/label';
import commentRouter from './modules/comment';
import { checklistRouter, checklistItemRouter } from './modules/checklist';
import { attachmentRouter } from './modules/attachment';

const app: Express = express();

// Set security HTTP headers
app.use(helmet());

// Enable Cross-Origin Resource Sharing
app.use(cors());

// Compress responses
app.use(compression());

// Parse JSON request bodies
app.use(express.json());

// Log HTTP requests
app.use(loggerMiddleware);

// Routes
app.use(healthRouter);
app.use('/api/v1/auth', authRouter);
app.use('/api/v1/boards', boardRouter);
app.use('/api/v1/dashboard', dashboardRouter);
app.use('/api/v1/columns', columnRouter);
app.use('/api/v1/cards', cardRouter);
app.use('/api/v1/labels', labelRouter);
app.use('/api/v1/comments', commentRouter);
app.use('/api/v1/checklists', checklistRouter);
app.use('/api/v1/checklist-items', checklistItemRouter);
app.use('/api/v1/attachments', attachmentRouter);

// Not Found Handler
app.use(notFoundMiddleware);

// Global Error Handler (must be registered last)
app.use(errorMiddleware);

export default app;
