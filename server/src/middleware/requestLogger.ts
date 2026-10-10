import type { RequestHandler } from 'express';

// Logs method, path, status and duration only.
// Never logs bodies, headers (Authorization) or query strings, so no secrets can leak.
export const requestLogger: RequestHandler = (req, res, next) => {
  const start = Date.now();
  const path = req.originalUrl.split('?')[0];
  res.on('finish', () => {
    console.log(`${req.method} ${path} ${res.statusCode} ${Date.now() - start}ms`);
  });
  next();
};
