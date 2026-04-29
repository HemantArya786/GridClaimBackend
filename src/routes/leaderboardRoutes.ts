import { Router } from 'express';
import { leaderboardController } from '../controllers/leaderboardController';
import { validate } from '../middleware/validate';
import { LeaderboardQuerySchema } from '../validators/schemas';
import { asyncHandler } from '../utils/asyncHandler';

const router = Router();

/**
 * GET /api/leaderboard
 * Returns paginated top users by total tile claims.
 * Query params: ?limit=10&page=1
 */
router.get(
  '/',
  validate(LeaderboardQuerySchema, 'query'),
  asyncHandler(leaderboardController.getLeaderboard.bind(leaderboardController)),
);

export default router;
