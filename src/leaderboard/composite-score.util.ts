/**
 * Packs (obtainedScore, timeTakenSeconds) into a single sortable number for a
 * Redis ZSET member score — higher obtainedScore always ranks higher; among
 * equal scores, lower timeTakenSeconds ranks higher.
 *
 * Layout: the top digits encode `obtainedScore` shifted by +1000 (so a
 * reasonably-negative score from heavy negative marking never goes
 * sub-zero) and scaled by 1e6 for sub-integer precision; the bottom 5 digits
 * encode `99_999 - timeTakenSeconds` as a tiebreaker (clamped to 0 past
 * ~27.7 hours, which no real exam attempt reaches).
 */
const SCORE_OFFSET = 1000;
const SCORE_SCALE = 1_000_000;
const TIME_TIEBREAK_SHIFT = 100_000;
const MAX_TIEBREAK_SECONDS = 99_999;

export function encodeCompositeScore(obtainedScore: number, timeTakenSeconds: number): number {
  const scaledScore = Math.round((obtainedScore + SCORE_OFFSET) * SCORE_SCALE);
  const timeTiebreak = Math.max(0, MAX_TIEBREAK_SECONDS - timeTakenSeconds);
  return scaledScore * TIME_TIEBREAK_SHIFT + timeTiebreak;
}

export interface DecodedCompositeScore {
  obtainedScore: number;
  timeTakenSeconds: number;
}

export function decodeCompositeScore(compositeScore: number): DecodedCompositeScore {
  const scaledScore = Math.floor(compositeScore / TIME_TIEBREAK_SHIFT);
  const timeTiebreak = compositeScore - scaledScore * TIME_TIEBREAK_SHIFT;

  return {
    // Rounded to 2 decimals to clean up floating-point artifacts from the
    // scale/unscale round trip — matches the underlying column's
    // `@db.Decimal(7, 2)` precision.
    obtainedScore: Math.round((scaledScore / SCORE_SCALE - SCORE_OFFSET) * 100) / 100,
    timeTakenSeconds: MAX_TIEBREAK_SECONDS - timeTiebreak,
  };
}
