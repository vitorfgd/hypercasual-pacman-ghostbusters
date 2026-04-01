/**
 * Mansion: safe hub + five rooms — all same square size; single exit from safe
 * toward **−Z** (screen‑"north" with this camera: forward = −Z).
 * Each link: door + short threshold (`CORRIDOR_BOUNDS`).
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

/** Narrow door thresholds (walkable X matches door width). */
export const CORRIDOR_BOUNDS: readonly RoomBounds[] = [
  { minX: -D, maxX: D, minZ: -S - C, maxZ: -S },
  { minX: -D, maxX: D, minZ: roomSouthZ(1) - C, maxZ: roomSouthZ(1) },
  { minX: -D, maxX: D, minZ: roomSouthZ(2) - C, maxZ: roomSouthZ(2) },
  { minX: -D, maxX: D, minZ: roomSouthZ(3) - C, maxZ: roomSouthZ(3) },
  { minX: -D, maxX: D, minZ: roomSouthZ(4) - C, maxZ: roomSouthZ(4) },
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
