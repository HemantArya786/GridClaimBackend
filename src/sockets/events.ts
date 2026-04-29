/**
 * All Socket.IO event names in one place.
 * Import from here instead of using raw strings to prevent typos
 * and make refactoring trivial.
 */
export const SocketEvents = {
  // ── Client → Server ──────────────────────────────────────────────────────
  GET_GRID: 'get-grid',
  CLAIM_TILE: 'claim-tile',

  // ── Server → Client ──────────────────────────────────────────────────────
  GRID_DATA: 'grid-data',
  TILE_UPDATED: 'tile-updated',
  CLAIM_FAILED: 'claim-failed',
  LEADERBOARD_UPDATED: 'leaderboard-updated',

  // ── Lifecycle ─────────────────────────────────────────────────────────────
  CONNECTION: 'connection',
  DISCONNECT: 'disconnect',
  ERROR: 'error',
} as const;

export type SocketEventKey = keyof typeof SocketEvents;
export type SocketEventValue = (typeof SocketEvents)[SocketEventKey];
