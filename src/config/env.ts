import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

// ── Schema ────────────────────────────────────────────────────────────────────
const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  CLIENT_ORIGIN: z.string().url().default('http://localhost:3000'),

  MONGODB_URI: z.string().min(1, 'MONGODB_URI is required'),

  GRID_ROWS: z.coerce.number().int().min(5).max(100).default(20),
  GRID_COLS: z.coerce.number().int().min(5).max(100).default(20),

  RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(60_000),
  RATE_LIMIT_MAX: z.coerce.number().int().positive().default(100),

  SOCKET_CLAIM_COOLDOWN_MS: z.coerce.number().int().nonnegative().default(500),

  LOG_LEVEL: z.enum(['error', 'warn', 'info', 'http', 'debug']).default('info'),
  LOG_DIR: z.string().default('logs'),

  REDIS_HOST: z.string().optional(),
  REDIS_PORT: z.coerce.number().int().positive().optional(),
  REDIS_PASSWORD: z.string().optional(),
});

// ── Parse & export ────────────────────────────────────────────────────────────
const _parsed = EnvSchema.safeParse(process.env);

if (!_parsed.success) {
  console.error('❌  Invalid environment variables:\n', _parsed.error.format());
  process.exit(1);
}

export const env = _parsed.data;
export type Env = typeof env;
