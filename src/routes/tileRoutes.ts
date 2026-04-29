import { Router } from 'express';
import { tileController } from '../controllers/tileController';
import { validate } from '../middleware/validate';
import { ClaimTileSchema } from '../validators/schemas';
import { asyncHandler } from '../utils/asyncHandler';
import { writeLimiter } from '../middleware/rateLimiter';

const router = Router();

/**
 * GET /api/tiles
 * Fetch all tiles for the full grid state.
 */
router.get('/', asyncHandler(tileController.getAllTiles.bind(tileController)));

/**
 * POST /api/tiles/claim
 * REST fallback for tile claiming (primary path is Socket.IO).
 */
router.post(
  '/claim',
  writeLimiter,
  validate(ClaimTileSchema, 'body'),
  asyncHandler(tileController.claimTile.bind(tileController)),
);

export default router;
