import { DEFAULT_PLAYER_MOVE_SPEED } from '../player/PlayerController.ts'

/** Starting stack slots before any capacity pad purchase */
export const INITIAL_STACK_CAPACITY = 10

/**
 * Hub upgrade pad offset from origin on XZ (meters). Must match `SceneSetup` pad placement.
 */
export const UPGRADE_PAD_HUB_OFFSET = 4.95

/**
 * Rectangular upgrade pad half-extents (XZ).
 */
export const UPGRADE_PAD_HALF_WIDTH = 1.38
export const UPGRADE_PAD_HALF_DEPTH = 1.06

export const MAX_CAPACITY_UPGRADE_LEVELS = 12
export const MAX_SPEED_UPGRADE_LEVELS = 12

/** Gold per tick toward the next upgrade level. */
export const UPGRADE_PAY_CHUNK = 45

/** 3D arc duration for gold chip flights into upgrade pads. */
export const UPGRADE_SPEND_FLIGHT_DURATION_SEC = 0.042

/** Slots = INITIAL_STACK_CAPACITY + purchased levels */
export function capacityUpgradeCost(currentUpgradeLevel: number): number {
  return 45 + currentUpgradeLevel * 35
}

export function speedUpgradeCost(currentUpgradeLevel: number): number {
  return 35 + currentUpgradeLevel * 28
}

export function speedForLevel(upgradeLevels: number): number {
  return DEFAULT_PLAYER_MOVE_SPEED + upgradeLevels * 0.68
}
