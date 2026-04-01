import {
  CORRIDOR_BOUNDS,
  ROOMS,
  ROOM_CONNECTIONS,
  ROOM_LIST,
  roomCenter as roomCenterFromData,
  type RoomBounds,
  type RoomDef,
  type RoomId,
} from './mansionRoomData.ts'

export type AreaId = RoomId | 'CORRIDOR'

/**
 * Single entry point for room/area queries (player, enemies, spawning, AI).
 * Stateless except optional RNG for random room picks.
 */
export class RoomSystem {
  private readonly random: () => number

  constructor(random: () => number = Math.random) {
    this.random = random
  }

  /** Room interior hit-test; corridors return null. */
  getRoomAt(x: number, z: number): RoomId | null {
    for (const r of ROOM_LIST) {
      const b = r.bounds
      if (x >= b.minX && x <= b.maxX && z >= b.minZ && z <= b.maxZ) {
        return r.id
      }
    }
    return null
  }

  /** Room if inside an interior, else `CORRIDOR` if in a door gap, else null. */
  getAreaAt(x: number, z: number): AreaId | null {
    const room = this.getRoomAt(x, z)
    if (room !== null) return room
    for (const b of CORRIDOR_BOUNDS) {
      if (x >= b.minX && x <= b.maxX && z >= b.minZ && z <= b.maxZ) {
        return 'CORRIDOR'
      }
    }
    return null
  }

  getRoomForPlayer(x: number, z: number): RoomId | null {
    return this.getRoomAt(x, z)
  }

  getRoomForEnemy(x: number, z: number): RoomId | null {
    return this.getRoomAt(x, z)
  }

  getRoomForPoint(x: number, z: number): RoomId | null {
    return this.getRoomAt(x, z)
  }

  pointInRoomBounds(roomId: RoomId, x: number, z: number): boolean {
    const b = ROOMS[roomId].bounds
    return x >= b.minX && x <= b.maxX && z >= b.minZ && z <= b.maxZ
  }

  getConnectedRooms(roomId: RoomId): readonly RoomId[] {
    return ROOM_CONNECTIONS[roomId] ?? []
  }

  getNeighbors(roomId: RoomId): readonly RoomId[] {
    return this.getConnectedRooms(roomId)
  }

  getRoomDef(roomId: RoomId): RoomDef {
    return ROOMS[roomId]
  }

  getBounds(roomId: RoomId): RoomBounds {
    return ROOMS[roomId].bounds
  }

  roomCenter(roomId: RoomId): { x: number; z: number } {
    return roomCenterFromData(roomId)
  }

  isSafeRoom(roomId: RoomId): boolean {
    return ROOMS[roomId].type === 'safe'
  }

  /** Wisps only in `normal` rooms (not safe center). */
  allowsWispSpawns(roomId: RoomId): boolean {
    return ROOMS[roomId].type === 'normal'
  }

  /** Enemies only outside the safe room. */
  allowsEnemySpawns(roomId: RoomId): boolean {
    return ROOMS[roomId].type === 'normal'
  }

  /** All non-safe room ids (wisps, enemies). */
  getSpawnEligibleRoomIds(): RoomId[] {
    return ROOM_LIST.filter((r) => r.type === 'normal').map((r) => r.id)
  }

  pickRandomSpawnRoom(): RoomId {
    const ids = this.getSpawnEligibleRoomIds()
    return ids[Math.floor(this.random() * ids.length)]!
  }

  /**
   * Random subset of spawn-eligible rooms. If `count` exceeds unique normals, repeats with replacement.
   */
  pickRandomSpawnRooms(count: number, unique = true): RoomId[] {
    const pool = this.getSpawnEligibleRoomIds()
    if (count <= 0) return []
    const out: RoomId[] = []
    if (unique && count <= pool.length) {
      const copy = [...pool]
      for (let i = 0; i < count; i++) {
        const j = Math.floor(this.random() * copy.length)
        out.push(copy[j]!)
        copy.splice(j, 1)
      }
      return out
    }
    for (let i = 0; i < count; i++) {
      out.push(pool[Math.floor(this.random() * pool.length)]!)
    }
    return out
  }
}
