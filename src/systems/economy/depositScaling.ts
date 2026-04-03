/**
 * Batch risk/reward: larger deposits multiply the batch total superlinearly so
 * holding a bigger stack before banking spikes feedback harder (and is riskier if hit).
 */

/** Linear term on (n−1) — each extra pellet adds this much relative lift */
export const DEPOSIT_BATCH_LINEAR = 0.062

/** Quadratic term on (n−1)² — makes “full stack” moments spike harder */
export const DEPOSIT_BATCH_QUAD = 0.0135

/**
 * Multiplier for n pellets: 1 @ n≤1; grows as 1 + a·(n−1) + b·(n−1)² for n>1.
 */
export function depositBatchMultiplier(itemCount: number): number {
  if (itemCount <= 1) return 1
  const x = itemCount - 1
  return 1 + DEPOSIT_BATCH_LINEAR * x + DEPOSIT_BATCH_QUAD * x * x
}

export function applyDepositBatchScaling(
  baseSum: number,
  itemCount: number,
): { batchTotal: number; batchMultiplier: number } {
  const m = depositBatchMultiplier(itemCount)
  return {
    batchTotal: Math.max(0, Math.floor(baseSum * m)),
    batchMultiplier: m,
  }
}
