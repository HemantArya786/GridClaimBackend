import { Request, Response, NextFunction, RequestHandler } from 'express';

type AsyncHandler = (req: Request, res: Response, next: NextFunction) => Promise<unknown>;

/**
 * Wraps an async Express route handler and forwards any thrown errors
 * to Express's error-handling middleware (next(err)).
 *
 * Eliminates repetitive try/catch blocks in every controller.
 */
export function asyncHandler(fn: AsyncHandler): RequestHandler {
  return (req: Request, res: Response, next: NextFunction): void => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}
