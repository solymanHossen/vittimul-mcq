import { DifficultyLevel } from '@prisma/client';
import { z } from 'zod';
import { DEFAULT_VOCABULARY_PAGE_SIZE, MAX_VOCABULARY_PAGE_SIZE } from '../vocabulary.constants';

export const QueryVocabularyCardsSchema = z
  .object({
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce
      .number()
      .int()
      .positive()
      .max(MAX_VOCABULARY_PAGE_SIZE)
      .default(DEFAULT_VOCABULARY_PAGE_SIZE),
    topicId: z.coerce.number().int().positive().optional(),
    difficulty: z.nativeEnum(DifficultyLevel).optional(),
  })
  .strict();

export type QueryVocabularyCardsDto = z.infer<typeof QueryVocabularyCardsSchema>;
