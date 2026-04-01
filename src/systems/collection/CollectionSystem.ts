import { Vector3 } from 'three'
import type { GameItem } from '../../core/types/GameItem.ts'
import type { CarryStack } from '../stack/CarryStack.ts'
import type { ItemWorld } from '../items/ItemWorld.ts'
import type { PlayerController } from '../player/PlayerController.ts'
import {
  MAGNET_EXTRA_RADIUS,
  MAGNET_PULL_SPEED,
  PICKUP_EXTRA_RADIUS,
} from '../../juice/juiceConfig.ts'

const p = new Vector3()

export type CollectionCallbacks = {
  /** When true (e.g. ghost hit i-frames), magnet + pickup are skipped. */
  pickupBlocked?: boolean
}

export class CollectionSystem {
  readonly pickupRadius = PICKUP_EXTRA_RADIUS

  collectScratch: { id: string; item: GameItem }[] = []

  update(
    player: PlayerController,
    stack: CarryStack,
    itemWorld: ItemWorld,
    dt: number,
    callbacks?: CollectionCallbacks,
  ): { id: string; item: GameItem }[] {
    this.collectScratch.length = 0
    if (callbacks?.pickupBlocked) return this.collectScratch

    player.getPosition(p)
    itemWorld.applyMagnetPull(
      p,
      player.radius + this.pickupRadius,
      MAGNET_EXTRA_RADIUS,
      MAGNET_PULL_SPEED,
      dt,
    )

    const r = player.radius + this.pickupRadius
    const r2 = r * r

    for (const [id, { mesh, item }] of itemWorld.entries()) {
      const dx = p.x - mesh.position.x
      const dz = p.z - mesh.position.z
      if (dx * dx + dz * dz > r2) continue

      if (stack.push(item)) {
        itemWorld.detachPickupForCollect(id)
        this.collectScratch.push({ id, item })
      }
    }
    return this.collectScratch
  }
}
