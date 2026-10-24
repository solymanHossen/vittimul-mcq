import { deterministicShuffle } from './deterministic-shuffle.util';

describe('deterministicShuffle()', () => {
  it('produces the same order every time for the same seed', () => {
    const items = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

    const first = deterministicShuffle(items, 'attempt-123');
    const second = deterministicShuffle(items, 'attempt-123');

    expect(first).toEqual(second);
  });

  it('produces a different order for a different seed', () => {
    const items = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

    const a = deterministicShuffle(items, 'attempt-123');
    const b = deterministicShuffle(items, 'attempt-456');

    expect(a).not.toEqual(b);
  });

  it('never mutates the input array', () => {
    const items = [1, 2, 3];
    const copy = [...items];

    deterministicShuffle(items, 'seed');

    expect(items).toEqual(copy);
  });

  it('preserves every element exactly once (a true permutation)', () => {
    const items = Array.from({ length: 50 }, (_, i) => i);

    const shuffled = deterministicShuffle(items, 'seed');

    expect(shuffled).toHaveLength(items.length);
    expect(new Set(shuffled)).toEqual(new Set(items));
  });

  it('handles empty and single-element arrays without throwing', () => {
    expect(deterministicShuffle([], 'seed')).toEqual([]);
    expect(deterministicShuffle(['only'], 'seed')).toEqual(['only']);
  });
});
