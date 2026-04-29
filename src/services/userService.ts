import { User, IUserDocument } from '../models/User';
import { generateColorFromSeed } from '../utils/gridHelpers';
import { ConflictError } from '../middleware/errorHandler';
import { logger } from '../utils/logger';

export class UserService {

  /**
   * Creates a new user. If a color is not supplied, one is deterministically
   * derived from the username for consistent brand identity.
   */
  async createUser(username: string, color?: string): Promise<IUserDocument> {
    const resolvedColor = color ?? generateColorFromSeed(username);

    const existing = await User.findOne({ username }).lean();
    if (existing) {
      throw new ConflictError(`Username "${username}" is already taken`);
    }

    const user = await User.create({ username, color: resolvedColor });

    logger.info('User created', { userId: user._id.toString(), username });

    return user;
  }

  /**
   * Returns leaderboard — top users by totalClaims descending.
   */
  async getLeaderboard(limit = 10, page = 1): Promise<{
    users: IUserDocument[];
    total: number;
    page: number;
    totalPages: number;
  }> {
    const skip = (page - 1) * limit;

    const [users, total] = await Promise.all([
      User.find({ totalClaims: { $gt: 0 } })
        .sort({ totalClaims: -1 })
        .skip(skip)
        .limit(limit)
        .lean<IUserDocument[]>(),
      User.countDocuments({ totalClaims: { $gt: 0 } }),
    ]);

    return {
      users,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    };
  }

  async getUserById(userId: string): Promise<IUserDocument | null> {
    return User.findById(userId).lean<IUserDocument>();
  }
}

export const userService = new UserService();
