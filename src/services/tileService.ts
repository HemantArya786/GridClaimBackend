import { Types } from 'mongoose';
import { Tile, ITileDocument } from '../models/Tile';
import { User } from '../models/User';
import { ActivityLog } from '../models/ActivityLog';
import { NotFoundError, ConflictError, BadRequestError } from '../middleware/errorHandler';
import { parseTileId } from '../utils/gridHelpers';
import { logger } from '../utils/logger';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ClaimResult {
  tile: ITileDocument;
  isNewClaim: true;
}

// ── Service ───────────────────────────────────────────────────────────────────

export class TileService {

  /**
   * Returns all tiles ordered by x, y — used for initial grid render.
   * Lean projection for performance (plain JS objects, not Mongoose docs).
   */
  async getAllTiles(): Promise<ITileDocument[]> {
    return Tile.find({}).sort({ x: 1, y: 1 }).lean<ITileDocument[]>();
  }

  /**
   * Atomically claims a tile using findOneAndUpdate with { isClaimed: false }
   * guard — prevents race conditions at the database level.
   *
   * Flow:
   *  1. Validate tileId format
   *  2. Validate user existence
   *  3. Atomic findOneAndUpdate (only succeeds if tile is unclaimed)
   *  4. Increment user's totalClaims counter
   *  5. Write activity log (fire-and-forget — does not block response)
   *  6. Return updated tile
   */
  async claimTile(tileId: string, userId: string): Promise<ITileDocument> {
    // ── 1. Validate tileId format ─────────────────────────────────────────
    try {
      parseTileId(tileId);
    } catch {
      throw new BadRequestError(`Invalid tileId format: "${tileId}"`);
    }

    // ── 2. Validate user ──────────────────────────────────────────────────
    const userObjectId = new Types.ObjectId(userId);
    const user = await User.findById(userObjectId).lean();
    if (!user) {
      throw new NotFoundError('User');
    }

    // ── 3. Atomic claim (THE critical operation) ──────────────────────────
    //
    // The filter `{ tileId, isClaimed: false }` ensures that:
    //  - Only one concurrent request can ever win the update
    //  - MongoDB's document-level locking guarantees exactly-once semantics
    //  - No application-level mutex or lock is needed
    //
    const updatedTile = await Tile.findOneAndUpdate(
      { tileId, isClaimed: false },
      {
        $set: {
          isClaimed: true,
          ownerId: userObjectId,
          ownerName: user.username,
          color: user.color,
          claimedAt: new Date(),
        },
      },
      { new: true },
    );

    if (!updatedTile) {
      // The tile either doesn't exist or was already claimed
      const exists = await Tile.exists({ tileId });
      if (!exists) throw new NotFoundError('Tile');
      throw new ConflictError('Tile is already claimed');
    }

    // ── 4. Increment user totalClaims (non-blocking) ──────────────────────
    User.findByIdAndUpdate(userObjectId, { $inc: { totalClaims: 1 } })
      .exec()
      .catch((err: unknown) =>
        logger.error('Failed to increment totalClaims', { userId, err }),
      );

    // ── 5. Activity log (fire-and-forget) ────────────────────────────────
    ActivityLog.create({
      userId: userObjectId,
      tileId,
      action: 'claim',
      meta: { ownerName: user.username, color: user.color },
    }).catch((err: unknown) =>
      logger.error('Failed to write activity log', { userId, tileId, err }),
    );

    logger.info('Tile claimed', {
      tileId,
      userId,
      username: user.username,
    });

    return updatedTile;
  }

  /**
   * Logs a failed claim attempt (e.g. already-claimed tile via socket).
   * Purely informational — does not throw.
   */
  async logFailedClaim(userId: string, tileId: string, reason: string): Promise<void> {
    try {
      const userObjectId = new Types.ObjectId(userId);
      await ActivityLog.create({
        userId: userObjectId,
        tileId,
        action: 'claim_failed',
        meta: { reason },
      });
    } catch (err) {
      logger.warn('Could not log failed claim', { userId, tileId, err });
    }
  }
}

export const tileService = new TileService();
