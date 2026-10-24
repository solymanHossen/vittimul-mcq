import { DifficultyLevel } from '@prisma/client';
import { z } from 'zod';
import { DEFAULT_QUESTIONS_PAGE_SIZE, MAX_QUESTIONS_PAGE_SIZE } from '../questions.constants';

/** Query-string booleans arrive as the literal strings "true"/"false" —
 * `z.coerce.boolean()` would wrongly coerce "false" to `true` (any non-empty
 * string is truthy), so this maps the two accepted literals explicitly. */
const QueryBooleanSchema = z.enum(['true', 'false']).transform((value) => value === 'true');

export const QueryQuestionsSchema = z
  .object({
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce
      .number()
      .int()
      .positive()
      .max(MAX_QUESTIONS_PAGE_SIZE)
      .default(DEFAULT_QUESTIONS_PAGE_SIZE),
    topicId: z.coerce.number().int().positive().optional(),
    subjectId: z.coerce.number().int().positive().optional(),
    categoryId: z.coerce.number().int().positive().optional(),
    difficulty: z.nativeEnum(DifficultyLevel).optional(),
    tagSlug: z.string().trim().min(1).optional(),
    isVerified: QueryBooleanSchema.optional(),
    q: z.string().trim().min(1).optional(),
  })
  .strict();

export type QueryQuestionsDto = z.infer<typeof QueryQuestionsSchema>;
