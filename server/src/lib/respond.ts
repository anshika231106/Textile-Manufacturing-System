import type { Response } from 'express';

export interface PageMeta {
  total: number;
  limit: number;
  offset: number;
}

// Success envelope: { data, meta? }. meta appears only on paginated lists.
export function ok<T>(res: Response, data: T, meta?: PageMeta) {
  return res.status(200).json(meta ? { data, meta } : { data });
}

export function created<T>(res: Response, data: T) {
  return res.status(201).json({ data });
}
