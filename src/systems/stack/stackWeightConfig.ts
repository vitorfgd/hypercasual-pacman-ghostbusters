/** Max-speed multiplier at full stack (before trap slow, etc.). */
export const STACK_WEIGHT_MIN_SPEED_MULT = 0.65

/** fillRatio = stackCount / maxCapacity ∈ [0,1] */
export function stackWeightSpeedMultiplier(fillRatio: number): number {
  const t = Math.max(0, Math.min(1, fillRatio))
  return 1 + (STACK_WEIGHT_MIN_SPEED_MULT - 1) * t
}
