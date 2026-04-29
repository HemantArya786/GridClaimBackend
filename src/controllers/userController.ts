import { Request, Response } from 'express';
import { userService } from '../services/userService';
import type { CreateUserInput } from '../validators/schemas';

export class UserController {

  /**
   * POST /api/users
   * Registers a new temporary player.
   */
  async createUser(req: Request, res: Response): Promise<void> {
    const { username, color } = req.body as CreateUserInput;
    const user = await userService.createUser(username, color);
    res.status(201).json({
      success: true,
      message: 'User created successfully',
      data: { user },
    });
  }

  /**
   * GET /api/users/:userId
   */
  async getUser(req: Request, res: Response): Promise<void> {
    const { userId } = req.params;
    const user = await userService.getUserById(userId);
    if (!user) {
      res.status(404).json({ success: false, error: 'User not found' });
      return;
    }
    res.status(200).json({ success: true, data: { user } });
  }
}

export const userController = new UserController();
