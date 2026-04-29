import { Server as SocketIOServer, Socket } from 'socket.io';
import { SocketEvents } from './events';
import { socketClaimGuard } from './claimGuard';
import { tileService } from '../services/tileService';
import { leaderboardService } from '../services/leaderboardService';
import { SocketClaimPayloadSchema } from '../validators/schemas';
import { logger } from '../utils/logger';
import type { IUserDocument } from '../models/User';
import type {
  TileUpdatedPayload,
  ClaimFailedPayload,
  LeaderboardEntry,
} from '../types';

// ── Handler factory ───────────────────────────────────────────────────────────

/**
 * Registers all Socket.IO event handlers for a single connected socket.
 *
 * Design decisions:
 *  - Each socket connection gets its own handler scope (closure over `socket`)
 *  - The `io` reference is used for broadcasting to ALL connected clients
 *  - Validation happens before any DB operation
 *  - The claim guard prevents per-socket abuse without touching the database
 *  - All errors are caught locally — uncaught errors must not crash the process
 */
export function registerSocketHandlers(io: SocketIOServer, socket: Socket): void {
  const socketId = socket.id;
  const remoteAddress = socket.handshake.address;

  logger.info('Socket connected', { socketId, remoteAddress });

  // ── get-grid ──────────────────────────────────────────────────────────────
  //
  // Client emits this on initial load to hydrate the full grid state.
  // We send only to the requesting socket (not broadcast).
  //
  socket.on(SocketEvents.GET_GRID, async () => {
    try {
      logger.debug('get-grid requested', { socketId });
      const tiles = await tileService.getAllTiles();
      socket.emit(SocketEvents.GRID_DATA, { tiles });
    } catch (err) {
      logger.error('get-grid handler error', { socketId, err });
      socket.emit(SocketEvents.ERROR, { message: 'Failed to load grid' });
    }
  });

  // ── claim-tile ────────────────────────────────────────────────────────────
  //
  // The most critical event. Flow:
  //  1. Validate payload shape (Zod)
  //  2. Enforce per-socket cooldown (in-memory guard)
  //  3. Attempt atomic DB claim (TileService)
  //  4a. On success → broadcast tile-updated + leaderboard-updated to ALL
  //  4b. On conflict/error → emit claim-failed to THIS socket only
  //
  socket.on(SocketEvents.CLAIM_TILE, async (payload: unknown) => {
    // ── Step 1: Validate payload ─────────────────────────────────────────
    const parsed = SocketClaimPayloadSchema.safeParse(payload);
    if (!parsed.success) {
      const failPayload: ClaimFailedPayload = {
        tileId: (payload as Record<string, string>)?.tileId ?? 'unknown',
        reason: 'Invalid payload: ' + parsed.error.issues.map(i => i.message).join(', '),
      };
      socket.emit(SocketEvents.CLAIM_FAILED, failPayload);
      logger.warn('claim-tile invalid payload', { socketId, payload });
      return;
    }

    const { tileId, userId } = parsed.data;

    // ── Step 2: Per-socket cooldown guard ────────────────────────────────
    if (!socketClaimGuard.allow(socketId)) {
      const failPayload: ClaimFailedPayload = {
        tileId,
        reason: 'Claiming too fast — please wait before trying again',
      };
      socket.emit(SocketEvents.CLAIM_FAILED, failPayload);
      logger.warn('claim-tile rate limited', { socketId, tileId, userId });
      return;
    }

    // ── Step 3: Atomic DB claim ──────────────────────────────────────────
    try {
      const tile = await tileService.claimTile(tileId, userId);

      // ── Step 4a: Broadcast success to ALL connected clients ──────────
      const tilePayload: TileUpdatedPayload = {
        tileId: tile.tileId,
        x: tile.x,
        y: tile.y,
        ownerId: tile.ownerId!.toString(),
        ownerName: tile.ownerName!,
        color: tile.color!,
        claimedAt: tile.claimedAt!.toISOString(),
      };

      io.emit(SocketEvents.TILE_UPDATED, tilePayload);
      logger.info('tile-updated broadcast', { tileId, userId });

      // ── Leaderboard refresh ──────────────────────────────────────────
      // Invalidate cache and push updated leaderboard to all clients.
      // This runs async — we don't await it to keep the claim fast.
      broadcastLeaderboard(io).catch((err: unknown) =>
        logger.error('Failed to broadcast leaderboard', { err }),
      );

    } catch (err: unknown) {
      // ── Step 4b: Emit failure only to the claiming socket ────────────
      const message = err instanceof Error ? err.message : 'Claim failed';
      const failPayload: ClaimFailedPayload = { tileId, reason: message };
      socket.emit(SocketEvents.CLAIM_FAILED, failPayload);

      // Log failed claim for analytics
      tileService
        .logFailedClaim(userId, tileId, message)
        .catch((logErr: unknown) => logger.error('logFailedClaim error', { logErr }));

      logger.warn('claim-tile failed', { socketId, tileId, userId, reason: message });
    }
  });

  // ── disconnect ────────────────────────────────────────────────────────────

  socket.on(SocketEvents.DISCONNECT, (reason: string) => {
    socketClaimGuard.cleanup(socketId);
    logger.info('Socket disconnected', { socketId, reason });
  });

  // ── Catch any unhandled socket-level errors ───────────────────────────────

  socket.on(SocketEvents.ERROR, (err: Error) => {
    logger.error('Socket error', { socketId, message: err.message });
  });
}

// ── Helpers ───────────────────────────────────────────────────────────────────

async function broadcastLeaderboard(io: SocketIOServer): Promise<void> {
  leaderboardService.invalidate();
  const result = await leaderboardService.getTopUsers(10, 1);

  const leaderboard: LeaderboardEntry[] = result.users.map((u: IUserDocument) => ({
    userId: u._id.toString(),
    username: u.username,
    color: u.color,
    totalClaims: u.totalClaims,
  }));

  io.emit(SocketEvents.LEADERBOARD_UPDATED, { leaderboard });
}
