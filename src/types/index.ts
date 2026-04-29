import { Types } from 'mongoose';

// ── Domain types ──────────────────────────────────────────────────────────────

export interface IUser {
  _id: Types.ObjectId;
  username: string;
  color: string;
  totalClaims: number;
  createdAt: Date;
}

export interface ITile {
  _id: Types.ObjectId;
  tileId: string;   // format: "x_y"
  x: number;
  y: number;
  ownerId: Types.ObjectId | null;
  ownerName: string | null;
  color: string | null;
  isClaimed: boolean;
  claimedAt: Date | null;
}

export interface IActivityLog {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  tileId: string;
  action: ActivityAction;
  meta?: Record<string, unknown>;
  createdAt: Date;
}

export type ActivityAction = 'claim' | 'claim_failed';

// ── Socket.IO event payloads ──────────────────────────────────────────────────

export interface ClaimTilePayload {
  tileId: string;
  userId: string;
}

export interface TileUpdatedPayload {
  tileId: string;
  x: number;
  y: number;
  ownerName: string;
  color: string;
  claimedAt: string;
}

export interface ClaimFailedPayload {
  tileId: string;
  reason: string;
}

export interface LeaderboardEntry {
  userId: string;
  username: string;
  color: string;
  totalClaims: number;
}

// ── REST API shapes ───────────────────────────────────────────────────────────

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginationQuery {
  limit?: number;
  page?: number;
}
