/**
 * Authoritative mansion room definitions (bounds + connectivity).
 * Geometry constants live in `mansionGeometry.ts`; queries in `RoomSystem.ts`.
 */

import { ROOM_HALF } from './mansionGeometry.ts'

export type RoomId =
  | 'SAFE_CENTER'
  | 'NORTH'
  | 'SOUTH'
  | 'EAST'
  | 'WEST'
  | 'NORTHWEST'
  | 'NORTHEAST'
  | 'SOUTHWEST'
  | 'SOUTHEAST'

export type RoomBounds = {
  minX: number
  maxX: number
  minZ: number
  maxZ: number
}

export type RoomDef = {
  id: RoomId
  bounds: RoomBounds
  /** `safe` = hub (deposit / upgrades); no wisp or enemy spawns. */
  type: 'safe' | 'normal'
}

const HR = ROOM_HALF

/** Interior AABBs — gaps between rooms are corridors, not listed here. */
export const ROOMS: Record<RoomId, RoomDef> = {
  SAFE_CENTER: {
    id: 'SAFE_CENTER',
    type: 'safe',
    bounds: { minX: -HR, maxX: HR, minZ: -HR, maxZ: HR },
  },
  NORTH: {
    id: 'NORTH',
    type: 'normal',
    bounds: { minX: -HR, maxX: HR, minZ: HR + 2, maxZ: HR + 2 + 10 },
  },
  SOUTH: {
    id: 'SOUTH',
    type: 'normal',
    bounds: { minX: -HR, maxX: HR, minZ: -HR - 2 - 10, maxZ: -HR - 2 },
  },
  EAST: {
    id: 'EAST',
    type: 'normal',
    bounds: { minX: HR + 2, maxX: HR + 2 + 10, minZ: -HR, maxZ: HR },
  },
  WEST: {
    id: 'WEST',
    type: 'normal',
    bounds: { minX: -HR - 2 - 10, maxX: -HR - 2, minZ: -HR, maxZ: HR },
  },
  NORTHEAST: {
    id: 'NORTHEAST',
    type: 'normal',
    bounds: { minX: HR + 2, maxX: HR + 2 + 10, minZ: HR + 2, maxZ: HR + 2 + 10 },
  },
  NORTHWEST: {
    id: 'NORTHWEST',
    type: 'normal',
    bounds: { minX: -HR - 2 - 10, maxX: -HR - 2, minZ: HR + 2, maxZ: HR + 2 + 10 },
  },
  SOUTHEAST: {
    id: 'SOUTHEAST',
    type: 'normal',
    bounds: { minX: HR + 2, maxX: HR + 2 + 10, minZ: -HR - 2 - 10, maxZ: -HR - 2 },
  },
  SOUTHWEST: {
    id: 'SOUTHWEST',
    type: 'normal',
    bounds: { minX: -HR - 2 - 10, maxX: -HR - 2, minZ: -HR - 2 - 10, maxZ: -HR - 2 },
  },
}

export const ROOM_LIST = Object.values(ROOMS)

/** Undirected adjacency (doors). */
export const ROOM_CONNECTIONS: Record<RoomId, readonly RoomId[]> = {
  SAFE_CENTER: ['NORTH', 'SOUTH', 'EAST', 'WEST'],
  NORTH: ['SAFE_CENTER', 'NORTHWEST', 'NORTHEAST'],
  SOUTH: ['SAFE_CENTER', 'SOUTHWEST', 'SOUTHEAST'],
  EAST: ['SAFE_CENTER', 'NORTHEAST', 'SOUTHEAST'],
  WEST: ['SAFE_CENTER', 'NORTHWEST', 'SOUTHWEST'],
  NORTHWEST: ['NORTH', 'WEST'],
  NORTHEAST: ['NORTH', 'EAST'],
  SOUTHWEST: ['SOUTH', 'WEST'],
  SOUTHEAST: ['SOUTH', 'EAST'],
}

/** Door gaps (walkable). */
export const CORRIDOR_BOUNDS: readonly RoomBounds[] = [
  { minX: -HR, maxX: HR, minZ: HR, maxZ: HR + 2 },
  { minX: -HR, maxX: HR, minZ: -HR - 2, maxZ: -HR },
  { minX: HR, maxX: HR + 2, minZ: -HR, maxZ: HR },
  { minX: -HR - 2, maxX: -HR, minZ: -HR, maxZ: HR },
  /** Cross corners: cardinal strips only touch at edges; these tiles cover the 2×2 junctions. */
  { minX: HR, maxX: HR + 2, minZ: HR, maxZ: HR + 2 },
  { minX: -HR - 2, maxX: -HR, minZ: HR, maxZ: HR + 2 },
  { minX: HR, maxX: HR + 2, minZ: -HR - 2, maxZ: -HR },
  { minX: -HR - 2, maxX: -HR, minZ: -HR - 2, maxZ: -HR },
  { minX: -HR - 2, maxX: -HR, minZ: HR + 2, maxZ: HR + 2 + 10 },
  { minX: HR, maxX: HR + 2, minZ: HR + 2, maxZ: HR + 2 + 10 },
  { minX: -HR - 2, maxX: -HR, minZ: -HR - 2 - 10, maxZ: -HR - 2 },
  { minX: HR, maxX: HR + 2, minZ: -HR - 2 - 10, maxZ: -HR - 2 },
  { minX: -HR - 2 - 10, maxX: -HR - 2, minZ: HR, maxZ: HR + 2 },
  { minX: -HR - 2 - 10, maxX: -HR - 2, minZ: -HR - 2, maxZ: -HR },
  { minX: HR + 2, maxX: HR + 2 + 10, minZ: HR, maxZ: HR + 2 },
  { minX: HR + 2, maxX: HR + 2 + 10, minZ: -HR - 2, maxZ: -HR },
]

export function roomCenter(id: RoomId): { x: number; z: number } {
  const b = ROOMS[id].bounds
  return { x: (b.minX + b.maxX) * 0.5, z: (b.minZ + b.maxZ) * 0.5 }
}

/** @deprecated Use `room.type === 'safe'` or `RoomSystem.isSafeRoom` */
export function isSafeCenter(id: RoomId): boolean {
  return id === 'SAFE_CENTER'
}
