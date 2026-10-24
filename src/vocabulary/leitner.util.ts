/** Pure Leitner 5-box scheduling — no I/O, exhaustively unit-testable. */

export const BOX_INTERVAL_DAYS: Readonly<Record<number, number>> = {
  1: 1,
  2: 3,
  3: 7,
  4: 14,
  5: 30,
};

const MAX_BOX = 5;

export interface LeitnerState {
  leitnerBox: number;
  correctStreak: number;
}

export interface LeitnerResult {
  leitnerBox: number;
  correctStreak: number;
  isMastered: boolean;
  intervalDays: number;
  wrongIncrement: number;
}

export function applyLeitnerReview(current: LeitnerState, isRemembered: boolean): LeitnerResult {
  if (isRemembered) {
    const wasAlreadyTopBox = current.leitnerBox === MAX_BOX;
    const leitnerBox = Math.min(MAX_BOX, current.leitnerBox + 1);
    return {
      leitnerBox,
      correctStreak: current.correctStreak + 1,
      // Mastered once a card answered correctly *from* the top box — it has
      // nowhere further to graduate to.
      isMastered: wasAlreadyTopBox,
      intervalDays: BOX_INTERVAL_DAYS[leitnerBox] ?? 1,
      wrongIncrement: 0,
    };
  }

  return {
    leitnerBox: 1,
    correctStreak: 0,
    isMastered: false,
    intervalDays: 1,
    wrongIncrement: 1,
  };
}
