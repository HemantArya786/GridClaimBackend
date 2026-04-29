import { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodError } from 'zod';

type RequestPart = 'body' | 'query' | 'params';

/**
 * Express middleware factory that validates a request section against a Zod schema.
 * Replaces the raw request data with the parsed (and coerced) output.
 */
export function validate(schema: ZodSchema, part: RequestPart = 'body') {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req[part]);

    if (!result.success) {
      const formatted = formatZodError(result.error);
      res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: formatted,
      });
      return;
    }

    // Mutate with parsed/coerced values (e.g. string → number via z.coerce)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (req as any)[part] = result.data;
    next();
  };
}

function formatZodError(error: ZodError): Record<string, string[]> {
  return error.issues.reduce<Record<string, string[]>>((acc, issue) => {
    const key = issue.path.join('.') || 'root';
    if (!acc[key]) acc[key] = [];
    acc[key].push(issue.message);
    return acc;
  }, {});
}
