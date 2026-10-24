import { type z } from 'zod';
import { CreateCategorySchema } from './create-category.dto';

export const UpdateCategorySchema = CreateCategorySchema.partial().refine(
  (data) => Object.keys(data).length > 0,
  { message: 'At least one field must be provided' },
);

export type UpdateCategoryDto = z.infer<typeof UpdateCategorySchema>;
