// Deterministic randomness: mulberry32 with helpers. The same seed builds the same city,
// the same traffic and the same shot every time.

export function createRandom(seed) {
  let a = (seed | 0) >>> 0;
  const next = () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  /** Uniform float in [lo, hi). */
  const range = (lo, hi) => lo + next() * (hi - lo);
  /** Integer in [lo, hi] inclusive. */
  const int = (lo, hi) => lo + Math.floor(next() * (hi - lo + 1));
  /** A uniformly chosen element of an array. */
  const pick = (list) => list[Math.floor(next() * list.length) % list.length];
  /** True once per `chance` calls' worth, e.g. chance(3) is true about a third of the time. */
  const chance = (chance_) => next() * chance_ < 1;
  return { next, range, int, pick, chance };
}
