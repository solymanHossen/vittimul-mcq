import { z } from 'zod';

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export const CreatePackageSchema = z
  .object({
    categoryId: z.number().int().positive().optional(),
    title: z.string().trim().min(1).max(150),
    slug: z
      .string()
      .trim()
      .min(1)
      .max(150)
      .regex(SLUG_PATTERN, 'slug must be lowercase alphanumeric segments separated by hyphens'),
    durationDays: z.number().int().positive(),
    basePrice: z.number().positive(),
    sellingPrice: z.number().positive(),
    currency: z.string().trim().length(3).optional(),
    featuresList: z.array(z.string().trim().min(1)).optional(),
    displayOrder: z.number().int().min(0).optional(),
    isPopular: z.boolean().optional(),
  })
  .strict()
  .refine((data) => data.sellingPrice <= data.basePrice, {
    message: 'sellingPrice must not exceed basePrice',
    path: ['sellingPrice'],
  });

export type CreatePackageDto = z.infer<typeof CreatePackageSchema>;
