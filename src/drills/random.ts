/**
 * Seeded RNG.
 *
 * Every drill is generated from a seed so a specific question can be reproduced
 * from its URL — useful when a user wants to ask about one, and essential for
 * debugging a generator that produced something odd.
 */

export interface Rng {
  next(): number
  int(maxExclusive: number): number
  pick<T>(items: readonly T[]): T
  shuffle<T>(items: readonly T[]): T[]
  seed: number
}

/** mulberry32 — small, fast, and good enough for question generation. */
export function makeRng(seed: number): Rng {
  let state = seed >>> 0

  const next = () => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }

  const int = (maxExclusive: number) => Math.floor(next() * maxExclusive)

  return {
    seed,
    next,
    int,
    pick: (items) => items[int(items.length)],
    shuffle: (items) => {
      const out = [...items]
      for (let i = out.length - 1; i > 0; i--) {
        const j = int(i + 1)
        ;[out[i], out[j]] = [out[j], out[i]]
      }
      return out
    },
  }
}

export function randomSeed(): number {
  return Math.floor(Math.random() * 0x7fffffff)
}
