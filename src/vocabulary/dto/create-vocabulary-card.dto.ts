import { DifficultyLevel } from '@prisma/client';
import { z } from 'zod';

export const CreateVocabularyCardSchema = z
  .object({
    topicId: z.number().int().positive().optional(),
    word: z.string().trim().min(1).max(100),
    pronunciationIpa: z.string().trim().min(1).max(100).optional(),
    partOfSpeech: z.string().trim().min(1).max(30).optional(),
    englishDefinition: z.string().trim().min(1).optional(),
    bengaliMeaning: z.string().trim().min(1),
    synonyms: z.array(z.string().trim().min(1)).optional(),
    antonyms: z.array(z.string().trim().min(1)).optional(),
    mnemonicTrick: z.string().trim().min(1).optional(),
    exampleSentence: z.string().trim().min(1).optional(),
    audioPronounceUrl: z.string().url().max(2048).optional(),
    difficulty: z.nativeEnum(DifficultyLevel).optional(),
  })
  .strict();

export type CreateVocabularyCardDto = z.infer<typeof CreateVocabularyCardSchema>;
