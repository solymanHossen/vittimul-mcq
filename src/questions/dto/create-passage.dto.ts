import { z } from 'zod';

export const CreatePassageSchema = z
  .object({
    title: z.string().trim().min(1).max(200).optional(),
    passageText: z.string().trim().min(1),
    imageUrl: z.string().url().max(2048).optional(),
  })
  .strict();

export type CreatePassageDto = z.infer<typeof CreatePassageSchema>;
