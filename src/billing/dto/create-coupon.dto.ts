import { DiscountType } from '@prisma/client';
import { z } from 'zod';

export const CreateCouponSchema = z
  .object({
    code: z.string().trim().min(1).max(50).toUpperCase(),
    description: z.string().trim().min(1).max(255).optional(),
    discountType: z.nativeEnum(DiscountType),
    discountValue: z.number().positive(),
    maxDiscountAmount: z.number().positive().optional(),
    minPurchaseAmount: z.number().min(0).optional(),
    maxUsesTotal: z.number().int().positive().optional(),
    maxUsesPerUser: z.number().int().positive().optional(),
    startsAt: z.coerce.date(),
    expiresAt: z.coerce.date(),
    isActive: z.boolean().optional(),
  })
  .strict()
  .refine((data) => data.expiresAt > data.startsAt, {
    message: 'expiresAt must be after startsAt',
    path: ['expiresAt'],
  })
  .refine((data) => data.discountType !== DiscountType.PERCENTAGE || data.discountValue <= 100, {
    message: 'discountValue must not exceed 100 for a PERCENTAGE coupon',
    path: ['discountValue'],
  });

export type CreateCouponDto = z.infer<typeof CreateCouponSchema>;
