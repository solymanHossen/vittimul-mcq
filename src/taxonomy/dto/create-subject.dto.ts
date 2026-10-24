import { z } from 'zod';

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export const CreateSubjectSchema = z
  .object({
    categoryId: z.number().int().positive(),
    name: z.string().trim().min(1).max(100),
    slug: z
      .string()
      .trim()
      .min(1)
      .max(100)
      .regex(SLUG_PATTERN, 'slug must be lowercase alphanumeric segments separated by hyphens'),
    code: z.string().trim().min(1).max(30).optional(),
    iconUrl: z.string().url().max(2048).optional(),
    displayOrder: z.number().int().min(0).optional(),
    isActive: z.boolean().optional(),
  })
  .strict();

export type CreateSubjectDto = z.infer<typeof CreateSubjectSchema>;
