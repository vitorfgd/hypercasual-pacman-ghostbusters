/**
 * Encumbrance approaches 1 as the player carries more items — **not** tied to a hard capacity cap.
 */
export const STACK_ENCUMBRANCE_REFERENCE_ITEMS = 28

export function computeCarryEncumbranceWeight(count: number): number {
  const n = Math.max(0, count)
  return Math.max(
    0,
    Math.min(1, n / Math.max(1, STACK_ENCUMBRANCE_REFERENCE_ITEMS)),
  )
}

/**
 * Max-speed multiplier at full stack (before trap slow, etc.).
 * Kept moderate so the player never feels unusable when full.
 */
const STACK_WEIGHT_MIN_SPEED_MULT = 0.7

/** At full stack, steering drag scales up by this factor (1 = unchanged). */
const STACK_WEIGHT_DRAG_MAX_MULT = 1.26

function stackWeightSpeedMultiplier(weight: number): number {
  const t = Math.max(0, Math.min(1, weight))
  return 1 + (STACK_WEIGHT_MIN_SPEED_MULT - 1) * t
}

/** weight ∈ [0,1] — higher weight = higher drag (faster convergence to capped speed). */
function stackWeightDragMultiplier(weight: number): number {
  const t = Math.max(0, Math.min(1, weight))
  return 1 + (STACK_WEIGHT_DRAG_MAX_MULT - 1) * t
}

/**
 * Treat stack encumbrance as milder: effective weight = raw × (1 − reliefPerStack × stacks), capped.
 */
export function stackWeightSpeedMultiplierRelief(
  weight: number,
  reliefStacks: number,
): number {
  const relief = Math.min(0.42, Math.max(0, reliefStacks) * 0.075)
  const t = Math.max(0, Math.min(1, weight * (1 - relief)))
  return stackWeightSpeedMultiplier(t)
}

export function stackWeightDragMultiplierRelief(
  weight: number,
  reliefStacks: number,
): number {
  const relief = Math.min(0.35, Math.max(0, reliefStacks) * 0.055)
  const t = Math.max(0, Math.min(1, weight * (1 - relief)))
  return stackWeightDragMultiplier(t)
}
