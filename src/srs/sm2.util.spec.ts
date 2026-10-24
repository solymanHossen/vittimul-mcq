import { applySm2, type Sm2State } from './sm2.util';

const FRESH: Sm2State = { repetitionNumber: 0, easeFactor: 2.5, intervalDays: 1 };

describe('applySm2()', () => {
  it('resets repetitionNumber, sets a 1-day interval, and counts a lapse for quality < 3', () => {
    const result = applySm2({ repetitionNumber: 4, easeFactor: 2.3, intervalDays: 20 }, 2);

    expect(result.repetitionNumber).toBe(0);
    expect(result.intervalDays).toBe(1);
    expect(result.isMastered).toBe(false);
    expect(result.lapsesIncrement).toBe(1);
  });

  it('uses a 1-day interval for the first successful repetition (repetitionNumber 0 -> 1)', () => {
    const result = applySm2(FRESH, 4);

    expect(result.repetitionNumber).toBe(1);
    expect(result.intervalDays).toBe(1);
    expect(result.lapsesIncrement).toBe(0);
  });

  it('uses a 6-day interval for the second successful repetition (repetitionNumber 1 -> 2)', () => {
    const result = applySm2({ repetitionNumber: 1, easeFactor: 2.5, intervalDays: 1 }, 4);

    expect(result.repetitionNumber).toBe(2);
    expect(result.intervalDays).toBe(6);
  });

  it('multiplies the prior interval by the ease factor from the third repetition onward', () => {
    const result = applySm2({ repetitionNumber: 2, easeFactor: 2.5, intervalDays: 6 }, 4);

    expect(result.repetitionNumber).toBe(3);
    expect(result.intervalDays).toBe(15); // round(6 * 2.5)
  });

  it('computes the new ease factor using the documented formula', () => {
    // quality 5: delta = 0.1 - 0*(0.08+0*0.02) = 0.1
    expect(applySm2({ ...FRESH, easeFactor: 2.5 }, 5).easeFactor).toBe(2.6);
    // quality 4: delta = 0.1 - 1*(0.08+1*0.02) = 0.1 - 0.10 = 0
    expect(applySm2({ ...FRESH, easeFactor: 2.5 }, 4).easeFactor).toBe(2.5);
    // quality 3: delta = 0.1 - 2*(0.08+2*0.02) = 0.1 - 0.24 = -0.14
    expect(applySm2({ ...FRESH, easeFactor: 2.5 }, 3).easeFactor).toBe(2.36);
  });

  it('never lets the ease factor drop below 1.3', () => {
    const result = applySm2({ ...FRESH, easeFactor: 1.3 }, 0);

    expect(result.easeFactor).toBe(1.3);
  });

  it('updates the ease factor on a failing grade too, not just on success', () => {
    const result = applySm2({ repetitionNumber: 3, easeFactor: 2.5, intervalDays: 15 }, 0);

    // quality 0: delta = 0.1 - 5*(0.08+5*0.02) = 0.1 - 0.9 = -0.8 -> floored at 1.3
    expect(result.easeFactor).toBe(1.7);
    expect(result.repetitionNumber).toBe(0);
  });

  it('marks mastered once repetitionNumber >= 5 and intervalDays >= 21', () => {
    // repetitionNumber 4 -> 5; interval uses the PRE-update ease factor (2.5),
    // per classic SM-2 — round(9 * 2.5) = round(22.5) = 23
    const result = applySm2({ repetitionNumber: 4, easeFactor: 2.5, intervalDays: 9 }, 5);

    expect(result.repetitionNumber).toBe(5);
    expect(result.intervalDays).toBe(23);
    expect(result.isMastered).toBe(true);
  });

  it('does not mark mastered when repetitionNumber reaches 5 but the interval is still short', () => {
    const result = applySm2({ repetitionNumber: 4, easeFactor: 1.3, intervalDays: 10 }, 3);

    expect(result.repetitionNumber).toBe(5);
    expect(result.intervalDays).toBe(13); // round(10 * 1.3)
    expect(result.isMastered).toBe(false);
  });

  it('does not mark mastered when the interval is long but repetitionNumber is still below 5', () => {
    const result = applySm2({ repetitionNumber: 2, easeFactor: 3, intervalDays: 10 }, 5);

    expect(result.repetitionNumber).toBe(3);
    expect(result.intervalDays).toBe(30); // round(10 * 3), the pre-update ease factor
    expect(result.isMastered).toBe(false);
  });
});
