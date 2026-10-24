import { z } from 'zod';
import { DEFAULT_LEADERBOARD_PAGE_SIZE, MAX_LEADERBOARD_PAGE_SIZE } from '../leaderboard.constants';

export const QueryLeaderboardSchema = z
  .object({
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce
      .number()
      .int()
      .positive()
      .max(MAX_LEADERBOARD_PAGE_SIZE)
      .default(DEFAULT_LEADERBOARD_PAGE_SIZE),
  })
  .strict();

export type QueryLeaderboardDto = z.infer<typeof QueryLeaderboardSchema>;
