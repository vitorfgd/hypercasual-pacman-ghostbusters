import type { GameItem } from '../core/types/GameItem.ts'
import type { ItemWorld } from '../systems/items/ItemWorld.ts'
import {
  GHOST_HIT_DROP_KICK_H_MIN,
  GHOST_HIT_DROP_KICK_H_SPREAD,
  GHOST_HIT_DROP_POP_VY_MIN,
  GHOST_HIT_DROP_POP_VY_SPREAD,
  GHOST_HIT_SCATTER_R_MIN,
  GHOST_HIT_SCATTER_R_SPREAD,
} from '../systems/ghost/ghostConfig.ts'

const GOLDEN = 2.39996322972865332

/**
 * Drops every lost stack item into the world in a tight burst (chaotic arcs).
 * All items use recover TTL — none are silently deleted.
 */
export function spawnGhostHitDroppedItems(
  itemWorld: ItemWorld,
  px: number,
  pz: number,
  items: readonly GameItem[],
  ttlSec: number,
): void {
  const n = items.length
  for (let i = 0; i < n; i++) {
    const it = items[i]!
    const ring = GHOST_HIT_SCATTER_R_MIN + Math.random() * GHOST_HIT_SCATTER_R_SPREAD
    const ang = i * GOLDEN + (Math.random() - 0.5) * 1.15
    const jitterR = (Math.random() - 0.5) * 0.35
    const x = px + Math.cos(ang) * (ring + jitterR)
    const z = pz + Math.sin(ang) * (ring + jitterR)
    const hk =
      GHOST_HIT_DROP_KICK_H_MIN + Math.random() * GHOST_HIT_DROP_KICK_H_SPREAD
    const vy =
      GHOST_HIT_DROP_POP_VY_MIN + Math.random() * GHOST_HIT_DROP_POP_VY_SPREAD
    const kickScale = 0.92 + Math.random() * 0.2
    itemWorld.spawnRecoverable(it, x, z, ttlSec, {
      horizontalKick: hk * kickScale,
      popVy: vy * (0.88 + Math.random() * 0.24),
    })
  }
}
