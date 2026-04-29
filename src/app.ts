import express, { Application } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import compression from 'compression';

import { env } from './config/env';
import { morganStream } from './utils/logger';
import { apiRateLimiter } from './middleware/rateLimiter';
import { globalErrorHandler, notFoundHandler } from './middleware/errorHandler';
import apiRouter from './routes';

/**
 * Creates and configures the Express application.
 *
 * Deliberately separated from the HTTP server bootstrap (server.ts) so that:
 *  - Tests can import the app without starting a server
 *  - The socket server can be attached to the raw http.Server
 */
export function createApp(): Application {
  const app = express();

  // ── Trust proxy (required behind Nginx / load balancers) ─────────────────
  if (env.NODE_ENV === 'production') {
    app.set('trust proxy', 1);
  }

  // ── Security headers ──────────────────────────────────────────────────────
  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: 'cross-origin' },
      contentSecurityPolicy: env.NODE_ENV === 'production',
    }),
  );

  // ── CORS ──────────────────────────────────────────────────────────────────
  app.use(
    cors({
      origin: env.CLIENT_ORIGIN,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization'],
      credentials: true,
      maxAge: 86_400, // 24h preflight cache
    }),
  );

  // ── Response compression ──────────────────────────────────────────────────
  app.use(
    compression({
      level: 6,
      threshold: 1024,
      filter: (req, res) => {
        if (req.headers['x-no-compression']) return false;
        return compression.filter(req, res);
      },
    }),
  );

  // ── Request parsing ───────────────────────────────────────────────────────
  app.use(express.json({ limit: '100kb' }));
  app.use(express.urlencoded({ extended: true, limit: '100kb' }));

  // ── HTTP request logging ──────────────────────────────────────────────────
  const morganFormat = env.NODE_ENV === 'production' ? 'combined' : 'dev';
  app.use(morgan(morganFormat, { stream: morganStream }));

  // ── Global rate limiter ───────────────────────────────────────────────────
  app.use('/api', apiRateLimiter);

  // ── API routes ────────────────────────────────────────────────────────────
  app.use('/api', apiRouter);

  // ── 404 & error handling (must be last) ──────────────────────────────────
  app.use(notFoundHandler);
  app.use(globalErrorHandler);

  return app;
}
