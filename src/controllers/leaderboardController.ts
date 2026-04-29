import { Request, Response } from 'express';
import { leaderboardService } from '../services/leaderboardService';
import type { LeaderboardQuery } from '../validators/schemas';

export class LeaderboardController {

  /**
   * GET /api/leaderboard
   * Returns paginated top users by total tile claims.
   */
  async getLeaderboard(req: Request, res: Response): Promise<void> {
    const { limit, page } = req.query as unknown as LeaderboardQuery;
    const result = await leaderboardService.getTopUsers(limit, page);
    res.status(200).json({
      success: true,
      data: result,
    });
  }
}

export const leaderboardController = new LeaderboardController();
