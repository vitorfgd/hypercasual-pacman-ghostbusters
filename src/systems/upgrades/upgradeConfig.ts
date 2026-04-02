import { DEFAULT_PLAYER_MOVE_SPEED } from '../player/PlayerController.ts'

/** Starting stack slots before any capacity pad purchase */
export const INITIAL_STACK_CAPACITY = 10

/**
 * Hub upgrade pad offset from origin on XZ (meters). Must match `SceneSetup` pad placement.
 */
export const UPGRADE_PAD_HUB_OFFSET = 4.95

/**
 * Rectangular upgrade pad half-extents (XZ), same idea as door pay zones.
 */
export const UPGRADE_PAD_HALF_WIDTH = 1.38
export const UPGRADE_PAD_HALF_DEPTH = 1.06

export const MAX_CAPACITY_UPGRADE_LEVELS = 12
export const MAX_SPEED_UPGRADE_LEVELS = 12

/** Levels for “charge fill speed” (ghost pulse bar fills faster outside the safe room). */
export const MAX_PULSE_FILL_UPGRADE_LEVELS = 10

/** Levels for “charge drain speed” (bar empties faster while holding the pulse button). */
export const MAX_PULSE_DRAIN_UPGRADE_LEVELS = 10

/** Gold per tick toward the next upgrade (same as door deposits). */
export const UPGRADE_PAY_CHUNK = 45

/** Slots = INITIAL_STACK_CAPACITY + purchased levels */
export function capacityUpgradeCost(currentUpgradeLevel: number): number {
  return 45 + currentUpgradeLevel * 35
}

export function speedUpgradeCost(currentUpgradeLevel: number): number {
  return 35 + currentUpgradeLevel * 28
}

export function pulseFillUpgradeCost(currentLevel: number): number {
  return 42 + currentLevel * 32
}

export function pulseDrainUpgradeCost(currentLevel: number): number {
  return 42 + currentLevel * 32
}

export function speedForLevel(upgradeLevels: number): number {
  return DEFAULT_PLAYER_MOVE_SPEED + upgradeLevels * 0.68
}

/** Charge per second gained while outside the safe room (level 0). */
export const BASE_PULSE_CHARGE_FILL_PER_SEC = 0.036
export const PULSE_CHARGE_FILL_STEP_PER_LEVEL = 0.017

/** Charge per second lost while holding pulse (level 0) — must stay well above max fill. */
export const BASE_PULSE_CHARGE_DRAIN_PER_SEC = 0.34
export const PULSE_CHARGE_DRAIN_STEP_PER_LEVEL = 0.042

export function pulseChargeFillPerSec(fillLevel: number): number {
  return (
    BASE_PULSE_CHARGE_FILL_PER_SEC +
    fillLevel * PULSE_CHARGE_FILL_STEP_PER_LEVEL
  )
}

export function pulseChargeDrainPerSec(drainLevel: number): number {
  return (
    BASE_PULSE_CHARGE_DRAIN_PER_SEC +
    drainLevel * PULSE_CHARGE_DRAIN_STEP_PER_LEVEL
  )
}
