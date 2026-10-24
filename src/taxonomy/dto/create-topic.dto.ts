import { z } from 'zod';

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export const CreateTopicSchema = z
  .object({
    subjectId: z.number().int().positive(),
    // A sub-topic's parent — must belong to the same subject and must itself
    // be a top-level topic (parentId: null). Enforced in TaxonomyService
    // since Prisma/Postgres can't express either rule declaratively, and both
    // keep the hierarchy exactly two levels deep, matching what
    // `GET /taxonomy/tree` actually renders.
    parentId: z.number().int().positive().optional(),
    name: z.string().trim().min(1).max(150),
    slug: z
      .string()
      .trim()
      .min(1)
      .max(150)
      .regex(SLUG_PATTERN, 'slug must be lowercase alphanumeric segments separated by hyphens'),
    displayOrder: z.number().int().min(0).optional(),
    isActive: z.boolean().optional(),
  })
  .strict();

export type CreateTopicDto = z.infer<typeof CreateTopicSchema>;
