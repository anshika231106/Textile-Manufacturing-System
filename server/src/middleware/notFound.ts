import type { RequestHandler } from 'express';
import { notFound as notFoundError } from '../lib/httpErrors';

// Reached only when no route matched. Same envelope as every other error.
export const notFound: RequestHandler = (req, _res, next) => {
  next(notFoundError(`Route not found: ${req.method} ${req.path}`));
};
