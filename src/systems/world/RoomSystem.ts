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
import { resolveGridBoundsAt } from '../grid/gridBoundsResolve.ts'
import { ROOM_GRID_COLS, ROOM_GRID_ROWS } from '../grid/gridConfig.ts'
import { boundsKey, cellCenterWorld } from '../grid/roomGridGeometry.ts'

function findBoundsByKey(key: string): RoomBounds | null {
  for (const r of ROOM_LIST) {
    if (boundsKey(r.bounds) === key) return r.bounds
  }
  for (const b of CORRIDOR_BOUNDS) {
    if (boundsKey(b) === key) return b
  }
  return null
}

/** Previous-frame grid cell; used so nav bounds match room grid when physics nudges into a door strip. */
export type GridNavContext = {
  boundsKey: string
  atRow: number
  atCol: number
}

export type AreaId = RoomId | 'CORRIDOR'

export class RoomSystem {
  private readonly random: () => number
  private roomAccess: ((roomId: RoomId) => boolean) | null = null

  constructor(random: () => number = Math.random) {
    this.random = random
  }

  configureRoomAccess(canEnterRoom: (roomId: RoomId) => boolean): void {
    this.roomAccess = canEnterRoom
  }

  isRoomAccessibleForGameplay(roomId: RoomId): boolean {
    if (this.roomAccess === null) {
      return !roomId.startsWith('ROOM_')
    }
    return this.roomAccess(roomId)
  }

  getRoomAt(x: number, z: number): RoomId | null {
    for (const r of ROOM_LIST) {
      const b = r.bounds
      if (x >= b.minX && x <= b.maxX && z >= b.minZ && z <= b.maxZ) {
        return r.id
      }
    }
    return null
  }

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

  getGridBoundsAt(x: number, z: number): RoomBounds {
    return resolveGridBoundsAt(x, z)
  }

  getNavGridBounds(
    x: number,
    z: number,
    nav: GridNavContext | null,
  ): RoomBounds {
    const primary = this.getGridBoundsAt(x, z)
    const sticky =
      nav !== null && nav.boundsKey !== ''
        ? findBoundsByKey(nav.boundsKey)
        : null

    const stickyCC =
      sticky !== null && nav !== null
        ? cellCenterWorld(
            sticky,
            nav.atRow,
            nav.atCol,
            ROOM_GRID_ROWS,
            ROOM_GRID_COLS,
          )
        : null

    const distToSticky =
      stickyCC !== null
        ? Math.hypot(x - stickyCC.x, z - stickyCC.z)
        : Infinity

    const narrow = (b: RoomBounds) => b.maxX - b.minX < 7
    const full = (b: RoomBounds) => !narrow(b)

    const STICKY_R = 3.35
    const HARD_SWITCH_R = 4.25

    if (sticky !== null && nav !== null && stickyCC !== null) {
      // Prefer the current logical region while still reasonably near its cell center.
      if (distToSticky <= STICKY_R) {
        return sticky
      }

      // If raw says corridor / narrow strip, keep sticky unless we've clearly moved away.
      if (narrow(primary) && distToSticky <= HARD_SWITCH_R) {
        return sticky
      }

      // Only switch to another full room once we're clearly away from the old logical cell.
      if (
        full(primary) &&
        boundsKey(primary) !== nav.boundsKey &&
        distToSticky >= HARD_SWITCH_R
      ) {
        return primary
      }

      // Default to sticky while in the ambiguous zone.
      if (distToSticky < HARD_SWITCH_R) {
        return sticky
      }
    }

    return primary
  }

  roomCenter(roomId: RoomId): { x: number; z: number } {
    return roomCenterFromData(roomId)
  }

  isSafeRoom(roomId: RoomId): boolean {
    return ROOMS[roomId].type === 'safe'
  }

  allowsWispSpawns(roomId: RoomId): boolean {
    return ROOMS[roomId].type === 'normal'
  }

  allowsEnemySpawns(roomId: RoomId): boolean {
    return ROOMS[roomId].type === 'normal'
  }

  getSpawnEligibleRoomIds(): RoomId[] {
    return ROOM_LIST.filter((r) => r.type === 'normal').map((r) => r.id)
  }

  pickRandomSpawnRoom(): RoomId {
    const ids = this.getSpawnEligibleRoomIds()
    return ids[Math.floor(this.random() * ids.length)]!
  }

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