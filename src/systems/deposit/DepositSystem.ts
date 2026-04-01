import { Vector3 } from 'three'
import type { Group } from 'three'
import type { GameItem } from '../../core/types/GameItem.ts'
import type { CarryStack } from '../stack/CarryStack.ts'
import type { Economy } from '../economy/Economy.ts'
import type { PlayerController } from '../player/PlayerController.ts'
import { DEFAULT_DEPOSIT_ZONE_RADIUS } from './DepositZone.ts'

const p = new Vector3()
const center = new Vector3()

export type DepositSystemOptions = {
  zoneRadius?: number
  /**
   * Called after a successful deposit (stack drained, money added).
   * Use for VFX; do not branch on item.type here — keep that in ItemValueResolver.
   */
  onDeposited?: (items: GameItem[], creditsEarned: number) => void
}

/**
 * Generic deposit: overlap circle vs player XZ, edge-trigger, drains stack into Economy.
 * Does not inspect item subtypes — only `GameItem[]` and payout resolver.
 */
export class DepositSystem {
  private wasInside = false
  private readonly depositRoot: Group
  private readonly zoneRadius: number
  private readonly onDeposited?: DepositSystemOptions['onDeposited']

  constructor(depositRoot: Group, options: DepositSystemOptions = {}) {
    this.depositRoot = depositRoot
    this.zoneRadius = options.zoneRadius ?? DEFAULT_DEPOSIT_ZONE_RADIUS
    this.onDeposited = options.onDeposited
  }

  update(
    player: PlayerController,
    stack: CarryStack,
    economy: Economy,
  ): void {
    this.depositRoot.getWorldPosition(center)
    player.getPosition(p)
    const dx = p.x - center.x
    const dz = p.z - center.z
    const inside = dx * dx + dz * dz <= this.zoneRadius * this.zoneRadius

    if (inside && !this.wasInside && stack.count > 0) {
      const items = stack.drain()
      const credits = economy.payout(items)
      this.onDeposited?.(items, credits)
    }
    this.wasInside = inside
  }
}
