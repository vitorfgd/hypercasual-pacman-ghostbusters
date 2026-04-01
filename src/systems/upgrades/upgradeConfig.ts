import { DEFAULT_PLAYER_MOVE_SPEED } from '../player/PlayerController.ts'
import {
  BASE_GHOST_PULSE_DURATION_SEC,
  BASE_GHOST_PULSE_INTERVAL_SEC,
  GHOST_PULSE_DURATION_MAX_SEC,
  GHOST_PULSE_DURATION_STEP_SEC,
  GHOST_PULSE_INTERVAL_MIN_SEC,
  GHOST_PULSE_INTERVAL_STEP_SEC,
} from '../ghostPulse/ghostPulseConfig.ts'

/** Starting stack slots before any capacity pad purchase */
export const INITIAL_STACK_CAPACITY = 10

/**
 * Hub upgrade pad offset from origin on XZ (meters). Must match `SceneSetup` pad placement.
 */
export const UPGRADE_PAD_HUB_OFFSET = 3.05

export const MAX_CAPACITY_UPGRADE_LEVELS = 12
export const MAX_SPEED_UPGRADE_LEVELS = 12

/** Shorter time between pulse starts (cooldown reduction). */
export const MAX_PULSE_FREQ_UPGRADE_LEVELS = 10

/** Longer vulnerable window each cycle. */
export const MAX_PULSE_DURATION_UPGRADE_LEVELS = 10

/** Slots = INITIAL_STACK_CAPACITY + purchased levels */
export function capacityUpgradeCost(currentUpgradeLevel: number): number {
  return 45 + currentUpgradeLevel * 35
}

export function speedUpgradeCost(currentUpgradeLevel: number): number {
  return 35 + currentUpgradeLevel * 28
}

export function pulseFreqUpgradeCost(currentLevel: number): number {
  return 42 + currentLevel * 32
}

export function pulseDurationUpgradeCost(currentLevel: number): number {
  return 42 + currentLevel * 32
}

export function speedForLevel(upgradeLevels: number): number {
  return DEFAULT_PLAYER_MOVE_SPEED + upgradeLevels * 0.68
}

/** Effective interval between pulse starts (seconds). */
export function ghostPulseIntervalForFreqLevel(freqLevel: number): number {
  const raw =
    BASE_GHOST_PULSE_INTERVAL_SEC - freqLevel * GHOST_PULSE_INTERVAL_STEP_SEC
  return Math.max(GHOST_PULSE_INTERVAL_MIN_SEC, raw)
}

/**
 * Effective pulse duration (seconds), capped below interval so cycles stay valid.
 */
export function ghostPulseDurationForLevels(
  durationLevel: number,
  intervalSec: number,
): number {
  const raw =
    BASE_GHOST_PULSE_DURATION_SEC + durationLevel * GHOST_PULSE_DURATION_STEP_SEC
  const capped = Math.min(GHOST_PULSE_DURATION_MAX_SEC, raw)
  return Math.min(capped, intervalSec * 0.92)
}
