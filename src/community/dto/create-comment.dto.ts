import { z } from 'zod';

export const CreateCommentSchema = z
  .object({
    commentText: z.string().trim().min(1),
    imageUrl: z.string().url().max(2048).optional(),
    parentCommentId: z
      .string()
      .regex(/^\d+$/, 'parentCommentId must be a numeric string')
      .optional(),
  })
  .strict();

export type CreateCommentDto = z.infer<typeof CreateCommentSchema>;
