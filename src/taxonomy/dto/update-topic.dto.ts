import { z } from 'zod';
import { CreateTopicSchema } from './create-topic.dto';

export const UpdateTopicSchema = CreateTopicSchema.partial()
  .extend({
    // Unlike create, update allows explicitly clearing parentId (promoting a
    // sub-topic back to top-level) by sending `null` rather than omitting it.
    parentId: z.number().int().positive().nullable().optional(),
  })
  .strict()
  .refine((data) => Object.keys(data).length > 0, {
    message: 'At least one field must be provided',
  });

export type UpdateTopicDto = z.infer<typeof UpdateTopicSchema>;
