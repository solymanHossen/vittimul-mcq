import { z } from 'zod';

export const ValidateCouponSchema = z
  .object({
    code: z.string().trim().min(1).max(50),
    packageId: z.number().int().positive(),
  })
  .strict();

export type ValidateCouponDto = z.infer<typeof ValidateCouponSchema>;
