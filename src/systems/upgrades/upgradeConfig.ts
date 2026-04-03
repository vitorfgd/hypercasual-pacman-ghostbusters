import { DEFAULT_PLAYER_MOVE_SPEED } from '../player/PlayerController.ts'

export const MAX_SPEED_UPGRADE_LEVELS = 12

/** Max horizontal speed at full stick for a given number of speed upgrades. */
export function speedForLevel(upgradeLevels: number): number {
  return DEFAULT_PLAYER_MOVE_SPEED + upgradeLevels * 0.68
}
