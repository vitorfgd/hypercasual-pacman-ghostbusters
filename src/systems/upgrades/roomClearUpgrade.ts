import type { PlayerController } from '../player/PlayerController.ts'
import type { CarryStack } from '../stack/CarryStack.ts'
import {
  INITIAL_STACK_CAPACITY,
  MAX_CAPACITY_UPGRADE_LEVELS,
  MAX_SPEED_UPGRADE_LEVELS,
  speedForLevel,
} from './upgradeConfig.ts'

export type RoomClearUpgradeKind = 'capacity' | 'speed'

export type RoomClearUpgradeResult = {
  kind: RoomClearUpgradeKind
  /** 1-based tier count for that stat (same meaning as former pad levels). */
  newLevel: number
}

/**
 * Odd room index → prefer +1 bag capacity; even → prefer +1 speed.
 * If the preferred stat is maxed, grants the other when possible.
 */
export function applyUpgradeForRoomClear(
  roomIndex: number,
  stack: CarryStack,
  player: PlayerController,
  levels: { capacityLevel: number; speedLevel: number },
): RoomClearUpgradeResult | null {
  const preferCapacity = roomIndex % 2 === 1

  const grantCapacity = (): RoomClearUpgradeResult | null => {
    if (levels.capacityLevel >= MAX_CAPACITY_UPGRADE_LEVELS) return null
    levels.capacityLevel += 1
    stack.setMaxCapacity(INITIAL_STACK_CAPACITY + levels.capacityLevel)
    return { kind: 'capacity', newLevel: levels.capacityLevel }
  }

  const grantSpeed = (): RoomClearUpgradeResult | null => {
    if (levels.speedLevel >= MAX_SPEED_UPGRADE_LEVELS) return null
    levels.speedLevel += 1
    player.setMaxSpeed(speedForLevel(levels.speedLevel))
    return { kind: 'speed', newLevel: levels.speedLevel }
  }

  if (preferCapacity) {
    const c = grantCapacity()
    if (c) return c
    return grantSpeed()
  }
  const s = grantSpeed()
  if (s) return s
  return grantCapacity()
}
