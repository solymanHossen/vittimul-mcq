/**
 * Pure SM-2 spaced-repetition algorithm — no I/O, so the scheduling math can
 * be tested exhaustively without a database.
 */

export interface Sm2State {
  repetitionNumber: number;
  easeFactor: number;
  intervalDays: number;
}

export interface Sm2Result {
  repetitionNumber: number;
  easeFactor: number;
  intervalDays: number;
  isMastered: boolean;
  /** 1 if this review counts as a lapse (quality < 3), else 0 — callers add
   * this to the persisted `lapsesCount` rather than overwriting it. */
  lapsesIncrement: number;
}

const MIN_EASE_FACTOR = 1.3;
const MASTERY_MIN_REPETITIONS = 5;
const MASTERY_MIN_INTERVAL_DAYS = 21;

function nextEaseFactor(current: number, qualityGrade: number): number {
  const delta = 0.1 - (5 - qualityGrade) * (0.08 + (5 - qualityGrade) * 0.02);
  return Math.max(MIN_EASE_FACTOR, Math.round((current + delta) * 100) / 100);
}

/**
 * @param qualityGrade Self-assessed recall quality, 0 (total blackout) to 5 (perfect recall).
 */
export function applySm2(current: Sm2State, qualityGrade: number): Sm2Result {
  const easeFactor = nextEaseFactor(current.easeFactor, qualityGrade);

  if (qualityGrade < 3) {
    return {
      repetitionNumber: 0,
      easeFactor,
      intervalDays: 1,
      isMastered: false,
      lapsesIncrement: 1,
    };
  }

  const intervalDays =
    current.repetitionNumber === 0
      ? 1
      : current.repetitionNumber === 1
        ? 6
        : Math.round(current.intervalDays * current.easeFactor);
  const repetitionNumber = current.repetitionNumber + 1;
  const isMastered =
    repetitionNumber >= MASTERY_MIN_REPETITIONS && intervalDays >= MASTERY_MIN_INTERVAL_DAYS;

  return { repetitionNumber, easeFactor, intervalDays, isMastered, lapsesIncrement: 0 };
}
