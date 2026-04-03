import type { ClutterVariant, GameItem } from '../../core/types/GameItem.ts'
import { roomIndexFromId } from '../doors/doorLayout.ts'
import type { ItemWorld } from '../items/ItemWorld.ts'
import type { RoomSystem } from '../world/RoomSystem.ts'
import type { WorldCollision } from '../world/WorldCollision.ts'
import type { RoomId } from '../world/mansionRoomData.ts'
import {
  CLUTTER_SPAWN_ATTEMPTS,
  CLUTTER_SPAWN_BODY_RADIUS,
  CLUTTER_SPAWN_MIN_DIST_FROM_DEPOSIT,
  CLUTTER_SPAWN_ROOM_INSET,
  clutterPiecesForRoom,
  CLUTTER_CLUSTER_COUNT,
  CLUTTER_CLUSTER_JITTER,
  CLUTTER_CLUSTER_ORBIT_MIN,
  CLUTTER_CLUSTER_ORBIT_SPREAD,
} from './clutterSpawnConfig.ts'

export type PrefillClutterPlacement = {
  roomId: RoomId
  index: number
  x: number
  z: number
  variant: ClutterVariant
  value: number
  haunted: boolean
}

function tooCloseToDeposit(x: number, z: number): boolean {
  return Math.hypot(x, z) < CLUTTER_SPAWN_MIN_DIST_FROM_DEPOSIT
}

/**
 * Find a valid floor position inside `roomId` (same rules as legacy runtime spawner, no player exclusion).
 */
export function tryFindClutterPosition(
  roomId: RoomId,
  roomSystem: RoomSystem,
  worldCollision: WorldCollision,
  random: () => number,
): { x: number; z: number } | null {
  const b = roomSystem.getBounds(roomId)
  const inset = CLUTTER_SPAWN_ROOM_INSET
  const minX = b.minX + inset
  const maxX = b.maxX - inset
  const minZ = b.minZ + inset
  const maxZ = b.maxZ - inset
  if (minX >= maxX || minZ >= maxZ) return null

  const r = CLUTTER_SPAWN_BODY_RADIUS

  for (let a = 0; a < CLUTTER_SPAWN_ATTEMPTS; a++) {
    const x0 = minX + random() * (maxX - minX)
    const z0 = minZ + random() * (maxZ - minZ)
    const { x, z } = worldCollision.resolveCircleXZ(x0, z0, r)
    if (roomSystem.getRoomAt(x, z) !== roomId) continue
    if (tooCloseToDeposit(x, z)) continue
    return { x, z }
  }
  return null
}

function tryFindClutterPositionNear(
  roomId: RoomId,
  roomSystem: RoomSystem,
  worldCollision: WorldCollision,
  random: () => number,
  centerX: number,
  centerZ: number,
): { x: number; z: number } | null {
  const b = roomSystem.getBounds(roomId)
  const inset = CLUTTER_SPAWN_ROOM_INSET
  const minX = b.minX + inset
  const maxX = b.maxX - inset
  const minZ = b.minZ + inset
  const maxZ = b.maxZ - inset
  if (minX >= maxX || minZ >= maxZ) return null

  const r = CLUTTER_SPAWN_BODY_RADIUS
  const j = CLUTTER_CLUSTER_JITTER

  for (let a = 0; a < CLUTTER_SPAWN_ATTEMPTS; a++) {
    const x0 = Math.max(
      minX,
      Math.min(maxX, centerX + (random() - 0.5) * 2 * j),
    )
    const z0 = Math.max(
      minZ,
      Math.min(maxZ, centerZ + (random() - 0.5) * 2 * j),
    )
    const { x, z } = worldCollision.resolveCircleXZ(x0, z0, r)
    if (roomSystem.getRoomAt(x, z) !== roomId) continue
    if (tooCloseToDeposit(x, z)) continue
    return { x, z }
  }
  return null
}

/**
 * Precompute placements for every normal room in the chain.
 */
export function precomputeAllClutterPlacements(
  roomSystem: RoomSystem,
  worldCollision: WorldCollision,
  random: () => number,
): PrefillClutterPlacement[] {
  const rooms = roomSystem.getSpawnEligibleRoomIds()
  const out: PrefillClutterPlacement[] = []

  for (const roomId of rooms) {
    const roomIdx = roomIndexFromId(roomId) ?? 1
    const pieceCount = clutterPiecesForRoom(roomIdx)
    const b = roomSystem.getBounds(roomId)
    const cx = (b.minX + b.maxX) * 0.5
    const cz = (b.minZ + b.maxZ) * 0.5
    const centers: { x: number; z: number }[] = []
    for (let c = 0; c < CLUTTER_CLUSTER_COUNT; c++) {
      const t = ((c + random() * 0.35) / CLUTTER_CLUSTER_COUNT) * Math.PI * 2
      const rad =
        CLUTTER_CLUSTER_ORBIT_MIN + random() * CLUTTER_CLUSTER_ORBIT_SPREAD
      centers.push({
        x: cx + Math.cos(t) * rad,
        z: cz + Math.sin(t) * rad,
      })
    }

    for (let i = 0; i < pieceCount; i++) {
      const cc = centers[i % CLUTTER_CLUSTER_COUNT]!
      const pos =
        tryFindClutterPositionNear(
          roomId,
          roomSystem,
          worldCollision,
          random,
          cc.x,
          cc.z,
        ) ??
        tryFindClutterPosition(roomId, roomSystem, worldCollision, random)
      if (!pos) continue
      const variant = Math.floor(random() * 7) as ClutterVariant
      /** ~1–2 haunted pieces per room on average; ghost spawn is further throttled in Game. */
      const haunted = random() < 0.092
      out.push({
        roomId,
        index: i,
        x: pos.x,
        z: pos.z,
        variant,
        value: 4 + Math.floor(random() * 12),
        haunted,
      })
    }
  }
  return out
}

export type CreateClutterFn = (
  variant: ClutterVariant,
  value: number,
  spawnRoomId: RoomId,
  haunted: boolean,
  stableId: string,
) => GameItem

/**
 * Spawn all precomputed clutter; visibility/interaction follow `isRoomAccessible` (locked rooms hidden).
 */
export function instantiatePrefilledClutter(
  placements: readonly PrefillClutterPlacement[],
  itemWorld: ItemWorld,
  createClutter: CreateClutterFn,
  isRoomAccessible: (roomId: RoomId) => boolean,
): void {
  for (const p of placements) {
    const id = `clutter_${p.roomId}_${p.index}`
    const item = createClutter(
      p.variant,
      p.value,
      p.roomId,
      p.haunted,
      id,
    )
    itemWorld.spawn(item, p.x, p.z, {
      visible: isRoomAccessible(p.roomId),
    })
  }
}
