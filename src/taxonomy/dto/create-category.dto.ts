import { z } from 'zod';

/** Lowercase alphanumeric segments joined by single hyphens — no leading/trailing/double hyphens. */
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export const CreateCategorySchema = z
  .object({
    name: z.string().trim().min(1).max(100),
    slug: z
      .string()
      .trim()
      .min(1)
      .max(100)
      .regex(SLUG_PATTERN, 'slug must be lowercase alphanumeric segments separated by hyphens'),
    description: z.string().trim().min(1).optional(),
    iconUrl: z.string().url().max(2048).optional(),
    displayOrder: z.number().int().min(0).optional(),
    isActive: z.boolean().optional(),
  })
  .strict();

export type CreateCategoryDto = z.infer<typeof CreateCategorySchema>;
