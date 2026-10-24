import { z } from 'zod';

export const QueryTopicsSchema = z
  .object({
    subjectId: z.coerce.number().int().positive().optional(),
    // 'root' returns only top-level topics (parentId IS NULL); a numeric
    // value returns the sub-topics of that specific parent topic.
    parentId: z.union([z.literal('root'), z.coerce.number().int().positive()]).optional(),
  })
  .strict();

export type QueryTopicsDto = z.infer<typeof QueryTopicsSchema>;
