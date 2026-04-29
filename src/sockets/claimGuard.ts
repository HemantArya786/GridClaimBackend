import { env } from '../config/env';

/**
 * Tracks per-socket last-claim timestamps to enforce a server-side cooldown.
 *
 * This is a secondary guard — the primary race-condition protection is the
 * MongoDB atomic findOneAndUpdate. This guard prevents abuse (e.g. a client
 * spamming hundreds of claim events per second) before it even hits the DB.
 *
 * In a multi-instance deployment, migrate this to Redis with a TTL key.
 */
export class SocketClaimGuard {
  private readonly lastClaimAt = new Map<string, number>();
  private readonly cooldownMs: number;

  constructor(cooldownMs = env.SOCKET_CLAIM_COOLDOWN_MS) {
    this.cooldownMs = cooldownMs;
  }

  /**
   * Returns true if the socket is allowed to claim right now.
   * Side effect: updates the timestamp on success.
   */
  allow(socketId: string): boolean {
    const last = this.lastClaimAt.get(socketId) ?? 0;
    const now = Date.now();

    if (now - last < this.cooldownMs) return false;

    this.lastClaimAt.set(socketId, now);
    return true;
  }

  /** Must be called on socket disconnect to prevent memory leaks. */
  cleanup(socketId: string): void {
    this.lastClaimAt.delete(socketId);
  }

  get size(): number {
    return this.lastClaimAt.size;
  }
}

// Singleton — shared across all socket handler instances
export const socketClaimGuard = new SocketClaimGuard();
