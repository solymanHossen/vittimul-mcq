import { z } from 'zod';
import { DEFAULT_TOURNAMENTS_PAGE_SIZE, MAX_TOURNAMENTS_PAGE_SIZE } from '../tournaments.constants';

export const PaginationSchema = z
  .object({
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce
      .number()
      .int()
      .positive()
      .max(MAX_TOURNAMENTS_PAGE_SIZE)
      .default(DEFAULT_TOURNAMENTS_PAGE_SIZE),
  })
  .strict();

export type PaginationDto = z.infer<typeof PaginationSchema>;
