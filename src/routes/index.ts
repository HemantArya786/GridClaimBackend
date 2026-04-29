import { Router, Request, Response } from 'express';
import mongoose from 'mongoose';
import tileRoutes from './tileRoutes';
import userRoutes from './userRoutes';
import leaderboardRoutes from './leaderboardRoutes';

const router = Router();

// ── Health check ──────────────────────────────────────────────────────────────

router.get('/health', (_req: Request, res: Response) => {
  const dbState = mongoose.connection.readyState;
  const dbStatus = ['disconnected', 'connected', 'connecting', 'disconnecting'][dbState] ?? 'unknown';

  const healthy = dbState === 1;

  res.status(healthy ? 200 : 503).json({
    success: healthy,
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    database: dbStatus,
    version: process.env.npm_package_version ?? '1.0.0',
  });
});

// ── Domain routes ─────────────────────────────────────────────────────────────

router.use('/tiles', tileRoutes);
router.use('/users', userRoutes);
router.use('/leaderboard', leaderboardRoutes);

export default router;
