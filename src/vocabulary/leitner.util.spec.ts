import { applyLeitnerReview } from './leitner.util';

describe('applyLeitnerReview()', () => {
  it('promotes the card to the next box and increments the correct streak', () => {
    const result = applyLeitnerReview({ leitnerBox: 2, correctStreak: 1 }, true);

    expect(result).toMatchObject({
      leitnerBox: 3,
      correctStreak: 2,
      intervalDays: 7,
      isMastered: false,
    });
  });

  it('caps the box at 5 and marks mastered once a top-box card is answered correctly again', () => {
    const result = applyLeitnerReview({ leitnerBox: 5, correctStreak: 10 }, true);

    expect(result).toMatchObject({
      leitnerBox: 5,
      correctStreak: 11,
      intervalDays: 30,
      isMastered: true,
    });
  });

  it('does not mark mastered when promoted into box 5 for the first time', () => {
    const result = applyLeitnerReview({ leitnerBox: 4, correctStreak: 3 }, true);

    expect(result).toMatchObject({ leitnerBox: 5, isMastered: false });
  });

  it('resets to box 1, zeroes the streak, and counts a wrong answer on a failed review', () => {
    const result = applyLeitnerReview({ leitnerBox: 4, correctStreak: 3 }, false);

    expect(result).toMatchObject({
      leitnerBox: 1,
      correctStreak: 0,
      intervalDays: 1,
      isMastered: false,
      wrongIncrement: 1,
    });
  });

  it('maps every box to its documented interval', () => {
    expect(applyLeitnerReview({ leitnerBox: 0, correctStreak: 0 }, true).intervalDays).toBe(1);
    expect(applyLeitnerReview({ leitnerBox: 1, correctStreak: 0 }, true).intervalDays).toBe(3);
    expect(applyLeitnerReview({ leitnerBox: 2, correctStreak: 0 }, true).intervalDays).toBe(7);
    expect(applyLeitnerReview({ leitnerBox: 3, correctStreak: 0 }, true).intervalDays).toBe(14);
    expect(applyLeitnerReview({ leitnerBox: 4, correctStreak: 0 }, true).intervalDays).toBe(30);
  });
});
