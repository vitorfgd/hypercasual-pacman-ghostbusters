/**
 * Carry encumbrance ∈ [0, 1]: `count / maxCapacity` (0 if no capacity).
 * Safe for UI and movement tuning.
 */
export function computeStackWeight(count: number, maxCapacity: number): number {
  if (maxCapacity <= 0) return 0
  return Math.max(0, Math.min(1, count / maxCapacity))
}

/**
 * Max-speed multiplier at full stack (before trap slow, etc.).
 * Kept moderate so the player never feels unusable when full.
 */
export const STACK_WEIGHT_MIN_SPEED_MULT = 0.7

/** At full stack, steering drag scales up by this factor (1 = unchanged). */
export const STACK_WEIGHT_DRAG_MAX_MULT = 1.26

/** weight ∈ [0,1] from `computeStackWeight` */
export function stackWeightSpeedMultiplier(weight: number): number {
  const t = Math.max(0, Math.min(1, weight))
  return 1 + (STACK_WEIGHT_MIN_SPEED_MULT - 1) * t
}

/** weight ∈ [0,1] — higher weight = higher drag (faster convergence to capped speed). */
export function stackWeightDragMultiplier(weight: number): number {
  const t = Math.max(0, Math.min(1, weight))
  return 1 + (STACK_WEIGHT_DRAG_MAX_MULT - 1) * t
}
