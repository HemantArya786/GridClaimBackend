import { z } from 'zod';

// ── User ──────────────────────────────────────────────────────────────────────

export const CreateUserSchema = z.object({
  username: z
    .string()
    .min(2, 'Username must be at least 2 characters')
    .max(24, 'Username must be at most 24 characters')
    .regex(/^[a-zA-Z0-9_-]+$/, 'Username may only contain letters, numbers, underscores, and hyphens'),
  color: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/, 'Color must be a valid hex color (e.g. #FF5733)')
    .optional(),
});

export type CreateUserInput = z.infer<typeof CreateUserSchema>;

// ── Tile ──────────────────────────────────────────────────────────────────────

export const ClaimTileSchema = z.object({
  tileId: z
    .string()
    .regex(/^\d+_\d+$/, 'tileId must be in format "x_y" (e.g. "3_7")'),
  userId: z
    .string()
    .length(24, 'userId must be a valid MongoDB ObjectId'),
});

export type ClaimTileInput = z.infer<typeof ClaimTileSchema>;

// ── Leaderboard ───────────────────────────────────────────────────────────────

export const LeaderboardQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(10),
  page: z.coerce.number().int().min(1).default(1),
});

export type LeaderboardQuery = z.infer<typeof LeaderboardQuerySchema>;

// ── Socket payloads ───────────────────────────────────────────────────────────

export const SocketClaimPayloadSchema = z.object({
  tileId: z
    .string()
    .regex(/^\d+_\d+$/, 'tileId must be in format "x_y"'),
  userId: z
    .string()
    .length(24, 'userId must be a valid MongoDB ObjectId'),
});

export type SocketClaimPayload = z.infer<typeof SocketClaimPayloadSchema>;
