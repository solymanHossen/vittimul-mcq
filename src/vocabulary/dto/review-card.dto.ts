import { z } from 'zod';

export const ReviewCardSchema = z
  .object({
    cardId: z.string().regex(/^\d+$/, 'cardId must be a numeric string'),
    isRemembered: z.boolean(),
  })
  .strict();

export type ReviewCardDto = z.infer<typeof ReviewCardSchema>;
