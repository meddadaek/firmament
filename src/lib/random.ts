/** Small seeded PRNG so the island is identical on every load (and later on the backend). */
export function mulberry32(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export type Rng = ReturnType<typeof mulberry32>

export const range = (rng: Rng, min: number, max: number) => min + rng() * (max - min)

export const pick = <T,>(rng: Rng, items: readonly T[]) => items[Math.floor(rng() * items.length)]
