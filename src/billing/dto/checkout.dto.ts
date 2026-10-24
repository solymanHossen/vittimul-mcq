import { PaymentProvider } from '@prisma/client';
import { z } from 'zod';

export const CheckoutSchema = z
  .object({
    packageId: z.number().int().positive(),
    couponCode: z.string().trim().min(1).max(50).optional(),
    provider: z.nativeEnum(PaymentProvider),
    idempotencyKey: z.string().trim().min(1).max(100),
  })
  .strict();

export type CheckoutDto = z.infer<typeof CheckoutSchema>;
