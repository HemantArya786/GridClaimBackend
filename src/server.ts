/**
 * server.ts — Application Entry Point
 * ─────────────────────────────────────────────────────────────────────────────
 * Responsibilities:
 *  1. Create the HTTP server from the Express app
 *  2. Connect to MongoDB (with retry logic)
 *  3. Seed the grid (idempotent)
 *  4. Initialise Socket.IO on the same HTTP server
 *  5. Start listening
 *  6. Register SIGTERM/SIGINT handlers for graceful shutdown
 */

import http from 'http';
import { createApp } from './app';
import { connectDatabase, disconnectDatabase } from './config/database';
import { initSocketServer } from './sockets';
import { seedGrid } from './utils/seed';
import { env } from './config/env';
import { logger } from './utils/logger';

// ── Bootstrap ─────────────────────────────────────────────────────────────────

async function bootstrap(): Promise<void> {
  // 1. Express app
  const app = createApp();

  // 2. Raw HTTP server (Socket.IO must attach to this, not to app directly)
  const httpServer = http.createServer(app);

  // 3. Database
  await connectDatabase();

  // 4. Seed grid tiles if needed
  await seedGrid();

  // 5. Socket.IO
  initSocketServer(httpServer);

  // 6. Start listening
  httpServer.listen(env.PORT, () => {
    logger.info(`🚀 Server running`, {
      port: env.PORT,
      env: env.NODE_ENV,
      grid: `${env.GRID_COLS}×${env.GRID_ROWS}`,
    });
  });

  // 7. Graceful shutdown
  registerShutdownHandlers(httpServer);
}

// ── Graceful shutdown ─────────────────────────────────────────────────────────

function registerShutdownHandlers(server: http.Server): void {
  const shutdown = async (signal: string): Promise<void> => {
    logger.info(`${signal} received — starting graceful shutdown`);

    server.close(async (err) => {
      if (err) {
        logger.error('Error closing HTTP server', { err });
        process.exit(1);
      }

      try {
        await disconnectDatabase();
        logger.info('Graceful shutdown complete');
        process.exit(0);
      } catch (dbErr) {
        logger.error('Error during database disconnect', { dbErr });
        process.exit(1);
      }
    });

    // Force exit after 10s if graceful shutdown hangs
    setTimeout(() => {
      logger.error('Graceful shutdown timed out — forcing exit');
      process.exit(1);
    }, 10_000).unref();
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  // Catch unhandled promise rejections (should never happen in production
  // if all async paths are wrapped correctly)
  process.on('unhandledRejection', (reason) => {
    logger.error('Unhandled promise rejection', { reason });
    // Don't exit — log and continue (operational error, not a crash)
  });

  process.on('uncaughtException', (err) => {
    logger.error('Uncaught exception — shutting down', {
      message: err.message,
      stack: err.stack,
    });
    process.exit(1);
  });
}

// ── Run ───────────────────────────────────────────────────────────────────────

bootstrap().catch((err) => {
  logger.error('Bootstrap failed', { err });
  process.exit(1);
});
