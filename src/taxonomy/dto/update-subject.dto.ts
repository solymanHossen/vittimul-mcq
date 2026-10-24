import { type z } from 'zod';
import { CreateSubjectSchema } from './create-subject.dto';

export const UpdateSubjectSchema = CreateSubjectSchema.partial().refine(
  (data) => Object.keys(data).length > 0,
  { message: 'At least one field must be provided' },
);

export type UpdateSubjectDto = z.infer<typeof UpdateSubjectSchema>;
