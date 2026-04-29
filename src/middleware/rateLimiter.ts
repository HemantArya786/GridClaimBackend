import rateLimit from 'express-rate-limit';
import { env } from '../config/env';
import { logger } from '../utils/logger';

/**
 * General API rate limiter — applied globally to all REST routes.
 */
export const apiRateLimiter = rateLimit({
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  max: env.RATE_LIMIT_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: 'Too many requests — please slow down.',
  },
  handler: (req, res, _next, options) => {
    logger.warn('Rate limit exceeded', {
      ip: req.ip,
      path: req.path,
    });
    res.status(options.statusCode).json(options.message);
  },
});

/**
 * Stricter limiter for write endpoints (claim tile, create user).
 */
export const writeLimiter = rateLimit({
  windowMs: 10_000,      // 10-second window
  max: 20,               // max 20 write requests per 10s per IP
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: 'Too many write requests — please slow down.',
  },
});
