import { z } from 'zod';

export const QuerySubjectsSchema = z
  .object({
    categoryId: z.coerce.number().int().positive().optional(),
  })
  .strict();

export type QuerySubjectsDto = z.infer<typeof QuerySubjectsSchema>;
