/**
 * Per-run deterministic RNG: same seed → same stream (for replays / testing).
 * New seeds are picked when a session starts (`Game` ctor).
 */

/** Uniform 32-bit seed (crypto when available). */
export function createRunSeed(): number {
  if (typeof crypto !== 'undefined' && 'getRandomValues' in crypto) {
    const u = new Uint32Array(2)
    crypto.getRandomValues(u)
    return (u[0]! ^ (u[1]! << 13)) >>> 0
  }
  return (
    (Math.floor(Math.random() * 0xffffffff) ^ (Date.now() & 0xffffffff)) >>> 0
  )
}

/**
 * Mulberry32 — fast, good enough for gameplay variance.
 * Returns values in [0, 1).
 */
export function mulberry32(initialSeed: number): () => number {
  let seed = initialSeed >>> 0
  return () => {
    let t = (seed += 0x6d2b79f5)
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function createRunRandom(): { seed: number; random: () => number } {
  const seed = createRunSeed()
  return { seed, random: mulberry32(seed) }
}
