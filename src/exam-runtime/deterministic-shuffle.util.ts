/**
 * Deterministic, seedable shuffle — the same seed always produces the same
 * permutation. Used to shuffle a resumed attempt's question/option order
 * identically to how it was first presented, seeded from the attempt's own
 * UUID so no separate "shuffle order" needs to be persisted.
 */

/** FNV-1a — a fast, well-distributed non-cryptographic string hash, used
 * only to turn a UUID string into a numeric PRNG seed. */
function hashStringToSeed(input: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

/** mulberry32 — a small, fast PRNG sufficient for non-cryptographic shuffling. */
function mulberry32(seed: number): () => number {
  let state = seed;
  return () => {
    state |= 0;
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Fisher-Yates shuffle using a PRNG seeded from `seedString` — never
 * mutates `items`. */
export function deterministicShuffle<T>(items: readonly T[], seedString: string): T[] {
  const result = [...items];
  const random = mulberry32(hashStringToSeed(seedString));

  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    const temp = result[i] as T;
    result[i] = result[j] as T;
    result[j] = temp;
  }

  return result;
}
