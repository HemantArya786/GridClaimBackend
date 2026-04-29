import { Router } from 'express';
import { userController } from '../controllers/userController';
import { validate } from '../middleware/validate';
import { CreateUserSchema } from '../validators/schemas';
import { asyncHandler } from '../utils/asyncHandler';
import { writeLimiter } from '../middleware/rateLimiter';

const router = Router();

/**
 * POST /api/users
 * Register a new temporary player.
 */
router.post(
  '/',
  writeLimiter,
  validate(CreateUserSchema, 'body'),
  asyncHandler(userController.createUser.bind(userController)),
);

/**
 * GET /api/users/:userId
 * Fetch a specific user by MongoDB ObjectId.
 */
router.get('/:userId', asyncHandler(userController.getUser.bind(userController)));

export default router;
