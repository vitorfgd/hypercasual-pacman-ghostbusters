/**
 * Mansion: safe hub + `NORMAL_ROOM_COUNT` rooms — same square size; exit from safe
 * toward **−Z**. Each link: door + short threshold (`CORRIDOR_BOUNDS`).
 */

import { CORRIDOR_DEPTH, DOOR_HALF, ROOM_HALF } from './mansionGeometry.ts'

/** Explorable chain length (ROOM_1 … ROOM_N). */
export const NORMAL_ROOM_COUNT = 10

export const NORMAL_ROOM_IDS = [
  'ROOM_1',
  'ROOM_2',
  'ROOM_3',
  'ROOM_4',
  'ROOM_5',
  'ROOM_6',
  'ROOM_7',
  'ROOM_8',
  'ROOM_9',
  'ROOM_10',
] as const

/** Last room in the north chain (boss). */
export const FINAL_NORMAL_ROOM_ID =
  NORMAL_ROOM_IDS[NORMAL_ROOM_COUNT - 1]!

export type NormalRoomId = (typeof NORMAL_ROOM_IDS)[number]
export type RoomId = 'SAFE_CENTER' | NormalRoomId

export type RoomBounds = {
  minX: number
  maxX: number
  minZ: number
  maxZ: number
}

export type RoomDef = {
  id: RoomId
  bounds: RoomBounds
  type: 'safe' | 'normal'
}

const S = ROOM_HALF
const C = CORRIDOR_DEPTH
const D = DOOR_HALF

/**
 * North edge of ROOM_k (toward safe, larger Z) — first room touches the south threshold.
 */
export function roomNorthZ(roomIndex: number): number {
  if (roomIndex === 1) return -S - C
  return roomSouthZ(roomIndex - 1) - C
}

/** South edge of ROOM_k (deeper into the chain, more negative Z). */
export function roomSouthZ(roomIndex: number): number {
  return roomNorthZ(roomIndex) - 2 * S
}

const xb = { minX: -S, maxX: S }

function buildNormalRooms(): Record<NormalRoomId, RoomDef> {
  const out = {} as Record<NormalRoomId, RoomDef>
  for (let i = 1; i <= NORMAL_ROOM_COUNT; i++) {
    const id = `ROOM_${i}` as NormalRoomId
    out[id] = {
      id,
      type: 'normal',
      bounds: {
        minX: xb.minX,
        maxX: xb.maxX,
        minZ: roomSouthZ(i),
        maxZ: roomNorthZ(i),
      },
    }
  }
  return out
}

export const ROOMS: Record<RoomId, RoomDef> = {
  SAFE_CENTER: {
    id: 'SAFE_CENTER',
    type: 'safe',
    bounds: { minX: -S, maxX: S, minZ: -S, maxZ: S },
  },
  ...buildNormalRooms(),
}

export const ROOM_LIST: readonly RoomDef[] = [
  ROOMS.SAFE_CENTER,
  ...NORMAL_ROOM_IDS.map((id) => ROOMS[id]),
]

function buildRoomConnections(): Record<RoomId, readonly RoomId[]> {
  const conn: Partial<Record<RoomId, RoomId[]>> = {
    SAFE_CENTER: ['ROOM_1'],
  }
  for (let i = 1; i <= NORMAL_ROOM_COUNT; i++) {
    const id = `ROOM_${i}` as NormalRoomId
    const prev: RoomId = i === 1 ? 'SAFE_CENTER' : (`ROOM_${i - 1}` as NormalRoomId)
    const next: RoomId[] =
      i < NORMAL_ROOM_COUNT ? [`ROOM_${i + 1}` as NormalRoomId] : []
    conn[id] = [prev, ...next]
  }
  return conn as Record<RoomId, readonly RoomId[]>
}

export const ROOM_CONNECTIONS: Record<RoomId, readonly RoomId[]> =
  buildRoomConnections()

/** Narrow door thresholds (walkable X matches door width). Hub + south of ROOM_1…ROOM_{N-1}. */
export const CORRIDOR_BOUNDS: readonly RoomBounds[] = [
  { minX: -D, maxX: D, minZ: -S - C, maxZ: -S },
  ...Array.from({ length: NORMAL_ROOM_COUNT - 1 }, (_, i) => {
    const k = i + 1
    return {
      minX: -D,
      maxX: D,
      minZ: roomSouthZ(k) - C,
      maxZ: roomSouthZ(k),
    }
  }),
]

export function roomCenter(id: RoomId): { x: number; z: number } {
  const b = ROOMS[id].bounds
  return { x: (b.minX + b.maxX) * 0.5, z: (b.minZ + b.maxZ) * 0.5 }
}

/** @deprecated Use `room.type === 'safe'` or `RoomSystem.isSafeRoom` */
export function isSafeCenter(id: RoomId): boolean {
  return id === 'SAFE_CENTER'
}
