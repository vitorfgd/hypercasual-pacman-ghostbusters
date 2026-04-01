import type { GameItem } from '../../core/types/GameItem.ts'
import type { ItemWorld } from '../items/ItemWorld.ts'
import type { RoomSystem } from '../world/RoomSystem.ts'
import type { WorldCollision } from '../world/WorldCollision.ts'
import {
  WISP_SPAWN_ATTEMPTS,
  WISP_SPAWN_BODY_RADIUS,
  WISP_SPAWN_INTERVAL_MAX_SEC,
  WISP_SPAWN_INTERVAL_MIN_SEC,
  WISP_SPAWN_MAX_ACTIVE,
  WISP_SPAWN_MIN_DIST_FROM_DEPOSIT,
  WISP_SPAWN_RETRY_DELAY_SEC,
  WISP_SPAWN_ROOM_INSET,
} from './wispSpawnConfig.ts'

export type RoomWispSpawnSystemOptions = {
  itemWorld: ItemWorld
  roomSystem: RoomSystem
  worldCollision: WorldCollision
  createWisp: () => GameItem
  random?: () => number
}

/**
 * Timer-driven wisp spawns: each pickup picks a random normal room, valid XZ inside geometry.
 */
export class RoomWispSpawnSystem {
  private readonly itemWorld: ItemWorld
  private readonly roomSystem: RoomSystem
  private readonly worldCollision: WorldCollision
  private readonly createWisp: () => GameItem
  private readonly random: () => number

  private nextSpawnIn = 0

  constructor(opts: RoomWispSpawnSystemOptions) {
    this.itemWorld = opts.itemWorld
    this.roomSystem = opts.roomSystem
    this.worldCollision = opts.worldCollision
    this.createWisp = opts.createWisp
    this.random = opts.random ?? Math.random
    this.scheduleNextInterval()
  }

  update(dt: number, _timeSec: number): void {
    if (this.itemWorld.countWisps() >= WISP_SPAWN_MAX_ACTIVE) {
      return
    }

    this.nextSpawnIn -= dt
    if (this.nextSpawnIn > 0) return

    const ok = this.trySpawnOne()
    if (ok) {
      this.scheduleNextInterval()
    } else {
      this.nextSpawnIn = WISP_SPAWN_RETRY_DELAY_SEC
    }
  }

  private scheduleNextInterval(): void {
    const t =
      WISP_SPAWN_INTERVAL_MIN_SEC +
      this.random() *
        (WISP_SPAWN_INTERVAL_MAX_SEC - WISP_SPAWN_INTERVAL_MIN_SEC)
    this.nextSpawnIn = t
  }

  private trySpawnOne(): boolean {
    const pool = this.roomSystem.getSpawnEligibleRoomIds()
    if (pool.length === 0) return false

    const roomId = pool[Math.floor(this.random() * pool.length)]!
    const b = this.roomSystem.getBounds(roomId)
    const inset = WISP_SPAWN_ROOM_INSET
    const minX = b.minX + inset
    const maxX = b.maxX - inset
    const minZ = b.minZ + inset
    const maxZ = b.maxZ - inset
    if (minX >= maxX || minZ >= maxZ) return false

    const r = WISP_SPAWN_BODY_RADIUS

    for (let a = 0; a < WISP_SPAWN_ATTEMPTS; a++) {
      const x0 = minX + this.random() * (maxX - minX)
      const z0 = minZ + this.random() * (maxZ - minZ)
      const { x, z } = this.worldCollision.resolveCircleXZ(x0, z0, r)
      if (this.roomSystem.getRoomAt(x, z) !== roomId) continue
      if (tooCloseToDeposit(x, z)) continue
      const item = this.createWisp()
      this.itemWorld.spawn(item, x, z)
      return true
    }

    return false
  }
}

function tooCloseToDeposit(x: number, z: number): boolean {
  return Math.hypot(x, z) < WISP_SPAWN_MIN_DIST_FROM_DEPOSIT
}
