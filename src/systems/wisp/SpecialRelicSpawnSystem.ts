import type { ItemWorld } from '../items/ItemWorld.ts'
import type { RoomSystem } from '../world/RoomSystem.ts'
import type { WorldCollision } from '../world/WorldCollision.ts'
import type { RelicItem } from '../../core/types/GameItem.ts'
import {
  SPECIAL_RELIC_INTERVAL_SEC,
  WISP_SPAWN_ATTEMPTS,
  WISP_SPAWN_BODY_RADIUS,
  WISP_SPAWN_MIN_DIST_FROM_DEPOSIT,
  WISP_SPAWN_ROOM_INSET,
} from './wispSpawnConfig.ts'

export type SpecialRelicSpawnSystemOptions = {
  itemWorld: ItemWorld
  roomSystem: RoomSystem
  worldCollision: WorldCollision
  createRelic: () => RelicItem
  random?: () => number
  /** Fired after a relic is successfully placed in the world. */
  onSpawn?: () => void
}

/**
 * Every `SPECIAL_RELIC_INTERVAL_SEC`, spawns one high-value relic in a random room.
 * Removes the previous world relic when a new one is placed.
 */
export class SpecialRelicSpawnSystem {
  private readonly itemWorld: ItemWorld
  private readonly roomSystem: RoomSystem
  private readonly worldCollision: WorldCollision
  private readonly createRelic: () => RelicItem
  private readonly random: () => number
  private readonly onSpawn?: () => void

  private timer = SPECIAL_RELIC_INTERVAL_SEC
  private activeRelicId: string | null = null

  constructor(opts: SpecialRelicSpawnSystemOptions) {
    this.itemWorld = opts.itemWorld
    this.roomSystem = opts.roomSystem
    this.worldCollision = opts.worldCollision
    this.createRelic = opts.createRelic
    this.random = opts.random ?? Math.random
    this.onSpawn = opts.onSpawn
  }

  update(dt: number): void {
    this.timer -= dt
    if (this.timer > 0) return
    this.timer = SPECIAL_RELIC_INTERVAL_SEC
    this.spawnRelic()
  }

  /** World XZ of the active relic pickup, or null if collected / missing. */
  getActiveRelicXZ(): { x: number; z: number } | null {
    if (this.activeRelicId === null) return null
    return this.itemWorld.getPickupXZ(this.activeRelicId)
  }

  private spawnRelic(): void {
    if (this.activeRelicId !== null && this.itemWorld.hasPickup(this.activeRelicId)) {
      this.itemWorld.remove(this.activeRelicId)
    }
    this.activeRelicId = null

    const pool = this.roomSystem.getSpawnEligibleRoomIds()
    if (pool.length === 0) return

    const roomId = pool[Math.floor(this.random() * pool.length)]!
    const b = this.roomSystem.getBounds(roomId)
    const inset = WISP_SPAWN_ROOM_INSET
    const minX = b.minX + inset
    const maxX = b.maxX - inset
    const minZ = b.minZ + inset
    const maxZ = b.maxZ - inset
    if (minX >= maxX || minZ >= maxZ) return

    const r = WISP_SPAWN_BODY_RADIUS

    for (let a = 0; a < WISP_SPAWN_ATTEMPTS; a++) {
      const x0 = minX + this.random() * (maxX - minX)
      const z0 = minZ + this.random() * (maxZ - minZ)
      const { x, z } = this.worldCollision.resolveCircleXZ(x0, z0, r)
      if (this.roomSystem.getRoomAt(x, z) !== roomId) continue
      if (Math.hypot(x, z) < WISP_SPAWN_MIN_DIST_FROM_DEPOSIT) continue

      const item = this.createRelic()
      this.itemWorld.spawn(item, x, z)
      this.activeRelicId = item.id
      this.onSpawn?.()
      return
    }
  }
}
