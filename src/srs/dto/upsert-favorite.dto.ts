import { z } from 'zod';

export const UpsertFavoriteSchema = z
  .object({
    questionId: z.string().regex(/^\d+$/, 'questionId must be a numeric string'),
    folderName: z.string().trim().min(1).max(100).optional(),
    personalNote: z.string().trim().min(1).optional(),
  })
  .strict();

export type UpsertFavoriteDto = z.infer<typeof UpsertFavoriteSchema>;
