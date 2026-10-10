import { z } from 'zod';

export const FeasibilityLineSchema = z.object({
  yarnTypeId: z.string().uuid({ message: 'Valid yarnTypeId (UUID) is required' }),
  kgPerMetre: z.number().positive({ message: 'kgPerMetre must be greater than 0' }),
});

export const FeasibilityYarnReqSchema = z.object({
  yarnTypeId: z.string().uuid({ message: 'Valid yarnTypeId (UUID) is required' }),
  requiredKg: z.number().positive({ message: 'requiredKg must be greater than 0' }),
});

export const FeasibilitySchema = z
  .object({
    metres: z.number().positive().optional(),
    lines: z.array(FeasibilityLineSchema).min(1).max(10).optional(),
    yarnRequirements: z.array(FeasibilityYarnReqSchema).min(1).max(10).optional(),
  })
  .refine(
    (data) => (data.lines && data.metres) || data.yarnRequirements,
    {
      message: 'Either lines with metres, or yarnRequirements, must be supplied',
    }
  );

export type FeasibilityInput = z.infer<typeof FeasibilitySchema>;

export const CreateOrderSchema = z
  .object({
    buyerId: z.string().uuid({ message: 'Valid buyerId (UUID) is required' }),
    fabricType: z.string().min(1, 'fabricType is required').max(120),
    colour: z.string().min(1, 'colour is required').max(60),
    metres: z.number().positive({ message: 'metres must be greater than 0' }),
    ratePerMetre: z.number().positive({ message: 'ratePerMetre must be greater than 0' }),
    deadline: z.string().min(1, 'deadline is required'),
    lines: z.array(FeasibilityLineSchema).min(1).max(10).optional(),
    yarnRequirements: z.array(FeasibilityYarnReqSchema).min(1).max(10).optional(),
  })
  .refine(
    (data) => data.lines || data.yarnRequirements,
    {
      message: 'Either lines or yarnRequirements must be provided',
    }
  );

export type CreateOrderInput = z.infer<typeof CreateOrderSchema>;

export const ListOrdersQuerySchema = z.object({
  status: z.string().optional(),
  buyerId: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

export type ListOrdersQuery = z.infer<typeof ListOrdersQuerySchema>;
