/**
 * Mansion: safe hub + five north rooms — all same square size; only north exit from safe;
 * each link is a narrow door + short threshold (see `CORRIDOR_BOUNDS`).
 */

import { CORRIDOR_DEPTH, DOOR_HALF, ROOM_HALF } from './mansionGeometry.ts'

export type RoomId =
  | 'SAFE_CENTER'
  | 'ROOM_1'
  | 'ROOM_2'
  | 'ROOM_3'
  | 'ROOM_4'
  | 'ROOM_5'

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

/** South Z of ROOM_k interior (after its south door threshold). */
export function roomSouthZ(roomIndex: number): number {
  if (roomIndex === 1) return S + C
  return roomNorthZ(roomIndex - 1) + C
}

export function roomNorthZ(roomIndex: number): number {
  return roomSouthZ(roomIndex) + 2 * S
}

const xb = { minX: -S, maxX: S }

export const ROOMS: Record<RoomId, RoomDef> = {
  SAFE_CENTER: {
    id: 'SAFE_CENTER',
    type: 'safe',
    bounds: { minX: -S, maxX: S, minZ: -S, maxZ: S },
  },
  ROOM_1: {
    id: 'ROOM_1',
    type: 'normal',
    bounds: {
      minX: xb.minX,
      maxX: xb.maxX,
      minZ: roomSouthZ(1),
      maxZ: roomNorthZ(1),
    },
  },
  ROOM_2: {
    id: 'ROOM_2',
    type: 'normal',
    bounds: {
      minX: xb.minX,
      maxX: xb.maxX,
      minZ: roomSouthZ(2),
      maxZ: roomNorthZ(2),
    },
  },
  ROOM_3: {
    id: 'ROOM_3',
    type: 'normal',
    bounds: {
      minX: xb.minX,
      maxX: xb.maxX,
      minZ: roomSouthZ(3),
      maxZ: roomNorthZ(3),
    },
  },
  ROOM_4: {
    id: 'ROOM_4',
    type: 'normal',
    bounds: {
      minX: xb.minX,
      maxX: xb.maxX,
      minZ: roomSouthZ(4),
      maxZ: roomNorthZ(4),
    },
  },
  ROOM_5: {
    id: 'ROOM_5',
    type: 'normal',
    bounds: {
      minX: xb.minX,
      maxX: xb.maxX,
      minZ: roomSouthZ(5),
      maxZ: roomNorthZ(5),
    },
  },
}

export const ROOM_LIST = Object.values(ROOMS)

const D = DOOR_HALF

/** Narrow door thresholds only (walkable X matches door width). */
export const CORRIDOR_BOUNDS: readonly RoomBounds[] = [
  { minX: -D, maxX: D, minZ: S, maxZ: S + C },
  { minX: -D, maxX: D, minZ: roomNorthZ(1), maxZ: roomNorthZ(1) + C },
  { minX: -D, maxX: D, minZ: roomNorthZ(2), maxZ: roomNorthZ(2) + C },
  { minX: -D, maxX: D, minZ: roomNorthZ(3), maxZ: roomNorthZ(3) + C },
  { minX: -D, maxX: D, minZ: roomNorthZ(4), maxZ: roomNorthZ(4) + C },
]

export const ROOM_CONNECTIONS: Record<RoomId, readonly RoomId[]> = {
  SAFE_CENTER: ['ROOM_1'],
  ROOM_1: ['SAFE_CENTER', 'ROOM_2'],
  ROOM_2: ['ROOM_1', 'ROOM_3'],
  ROOM_3: ['ROOM_2', 'ROOM_4'],
  ROOM_4: ['ROOM_3', 'ROOM_5'],
  ROOM_5: ['ROOM_4'],
}

export function roomCenter(id: RoomId): { x: number; z: number } {
  const b = ROOMS[id].bounds
  return { x: (b.minX + b.maxX) * 0.5, z: (b.minZ + b.maxZ) * 0.5 }
}

/** @deprecated Use `room.type === 'safe'` or `RoomSystem.isSafeRoom` */
export function isSafeCenter(id: RoomId): boolean {
  return id === 'SAFE_CENTER'
}
