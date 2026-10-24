/** Redis ZSET holding every official attempt's composite score for one exam. */
export function leaderboardKey(examId: bigint): string {
  return `leaderboard:exam:${examId}`;
}

export const DEFAULT_LEADERBOARD_PAGE_SIZE = 20;
export const MAX_LEADERBOARD_PAGE_SIZE = 100;
