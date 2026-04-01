/**
 * OVERLOAD DROP — viral moment tuning.
 */

/** Minimum items in one deposit to trigger overload (large stack path) */
export const OVERLOAD_STACK_THRESHOLD = 7

/** Extra credits: floor(depositCredits * (OVERLOAD_BONUS_MULT - 1)) */
export const OVERLOAD_BONUS_MULT = 1.35

/** Applied to overload bonus portion when Perfect */
export const PERFECT_OVERLOAD_BONUS_MULT = 1.55

/** Flight duration multiplier during overload (longer than normal deposit flight) */
export const OVERLOAD_FLIGHT_DURATION_MULT = 1.2

export const OVERLOAD_SPIRAL_AMPLITUDE = 0.55
export const OVERLOAD_SPIRAL_AMPLITUDE_PERFECT = 0.82
export const OVERLOAD_SPIRAL_TURNS = 1.25

export const OVERLOAD_ARC_HEIGHT_MULT = 1.35
export const OVERLOAD_ARC_HEIGHT_MULT_PERFECT = 1.65
