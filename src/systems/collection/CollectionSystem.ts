import { Vector3 } from 'three'
import type { GameItem } from '../../core/types/GameItem.ts'
import type { CarryStack } from '../stack/CarryStack.ts'
import type { ItemWorld } from '../items/ItemWorld.ts'
import { isWorldPickupInteractable } from '../items/pickupWorldState.ts'
import type { PlayerController } from '../player/PlayerController.ts'
import {
  MAGNET_EXTRA_RADIUS,
  MAGNET_PULL_SPEED,
  PICKUP_EXTRA_RADIUS,
} from '../../juice/juiceConfig.ts'

const p = new Vector3()

/** Run upgrades scale magnet band / pull speed. */
export type MagnetTuning = {
  extraRadiusMul?: number
  pullSpeedMul?: number
  recoverPullMul?: number
}

export type CollectionCallbacks = {
  /** When true (e.g. ghost hit i-frames), ground pickup is skipped. */
  pickupBlocked?: boolean
  /** When true, vacuum pull is skipped (e.g. brief ghost-hit stun). */
  magnetBlocked?: boolean
}

export type CollectedPickup = {
  id: string
  item: GameItem
  /** World XZ at pickup (before detach / collect pop). */
  pickupX: number
  pickupZ: number
}

export class CollectionSystem {
  readonly pickupRadius = PICKUP_EXTRA_RADIUS

  collectScratch: CollectedPickup[] = []

  update(
    player: PlayerController,
    stack: CarryStack,
    itemWorld: ItemWorld,
    dt: number,
    callbacks?: CollectionCallbacks,
    magnet?: MagnetTuning,
  ): CollectedPickup[] {
    this.collectScratch.length = 0

    player.getPosition(p)
    if (!callbacks?.magnetBlocked) {
      const rx = magnet?.extraRadiusMul ?? 1
      const ps = magnet?.pullSpeedMul ?? 1
      itemWorld.applyMagnetPull(
        p,
        player.radius + this.pickupRadius,
        MAGNET_EXTRA_RADIUS * rx,
        MAGNET_PULL_SPEED * ps,
        dt,
        { recoverPullMul: magnet?.recoverPullMul },
      )
    }

    if (callbacks?.pickupBlocked) return this.collectScratch

    const r = player.radius + this.pickupRadius
    const r2 = r * r

    for (const [id, { mesh, item }] of itemWorld.entries()) {
      if (!isWorldPickupInteractable(mesh, item)) continue
      const dx = p.x - mesh.position.x
      const dz = p.z - mesh.position.z
      if (dx * dx + dz * dz > r2) continue

      const pickupX = mesh.position.x
      const pickupZ = mesh.position.z

      const hauntedClutter =
        item.type === 'clutter' && item.haunted === true
      if (hauntedClutter) {
        itemWorld.detachPickupForCollect(id)
        this.collectScratch.push({ id, item, pickupX, pickupZ })
        continue
      }

      if (stack.push(item)) {
        itemWorld.detachPickupForCollect(id)
        this.collectScratch.push({ id, item, pickupX, pickupZ })
      }
    }
    return this.collectScratch
  }
}
