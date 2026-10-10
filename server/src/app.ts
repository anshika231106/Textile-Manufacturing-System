import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { env } from './config/env';
import { router } from './routes';
import { notFound } from './middleware/notFound';
import { errorHandler } from './middleware/errorHandler';
import { requestLogger } from './middleware/requestLogger';

// Factory (not a singleton) so tests can build an app without opening a port.
export function createApp() {
  const app = express();
  app.disable('x-powered-by');
  app.use(requestLogger);
  app.use(helmet());
  app.use(cors({ origin: env.CLIENT_ORIGIN, allowedHeaders: ['Content-Type', 'Authorization'] }));
  app.use(express.json({ limit: '100kb' }));
  app.use('/api/v1', router);
  app.use(notFound);     // after all routes
  app.use(errorHandler); // must be last
  return app;
}
