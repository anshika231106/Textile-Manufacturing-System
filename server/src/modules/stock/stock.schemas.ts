import { z } from 'zod';

export const CreateReceiptSchema = z.object({
  yarnTypeId: z.string().uuid({ message: 'Valid yarnTypeId (UUID) is required' }),
  supplierId: z.string().uuid({ message: 'Valid supplierId (UUID) is required' }),
  kg: z.number().positive({ message: 'kg must be greater than 0' }),
  ratePerKg: z.number().positive({ message: 'ratePerKg must be greater than 0' }),
  orderId: z.string().uuid().optional().nullable(),
  reference: z.string().max(60, { message: 'reference maximum length is 60' }).optional().nullable(),
});

export type CreateReceiptInput = z.infer<typeof CreateReceiptSchema>;

export const StockLedgerQuerySchema = z.object({
  yarnTypeId: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

export type StockLedgerQuery = z.infer<typeof StockLedgerQuerySchema>;

export const FinishedStockQuerySchema = z.object({
  orderId: z.string().uuid().optional(),
});

export type FinishedStockQuery = z.infer<typeof FinishedStockQuerySchema>;
