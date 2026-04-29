import { userService } from './userService';
import { logger } from '../utils/logger';
import type { IUserDocument } from '../models/User';

// ── Simple in-process cache ────────────────────────────────────────────────────
// In a multi-instance deployment, replace this with Redis.

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

class LeaderboardCache {
  private store = new Map<string, CacheEntry<unknown>>();

  set<T>(key: string, data: T, ttlMs: number): void {
    this.store.set(key, { data, expiresAt: Date.now() + ttlMs });
  }

  get<T>(key: string): T | null {
    const entry = this.store.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return null;
    }
    return entry.data as T;
  }

  invalidate(prefix: string): void {
    for (const key of this.store.keys()) {
      if (key.startsWith(prefix)) this.store.delete(key);
    }
  }
}

const cache = new LeaderboardCache();
const LEADERBOARD_TTL_MS = 5_000; // 5-second cache

type LeaderboardResult = {
  users: IUserDocument[];
  total: number;
  page: number;
  totalPages: number;
};

// ── Service ───────────────────────────────────────────────────────────────────

export class LeaderboardService {

  async getTopUsers(limit = 10, page = 1): Promise<LeaderboardResult> {
    const cacheKey = `leaderboard:${limit}:${page}`;
    const cached = cache.get<LeaderboardResult>(cacheKey);
    if (cached) return cached;

    const result = await userService.getLeaderboard(limit, page);
    cache.set(cacheKey, result, LEADERBOARD_TTL_MS);
    return result;
  }

  /** Called after a successful tile claim to invalidate stale leaderboard. */
  invalidate(): void {
    cache.invalidate('leaderboard:');
    logger.debug('Leaderboard cache invalidated');
  }
}

export const leaderboardService = new LeaderboardService();
