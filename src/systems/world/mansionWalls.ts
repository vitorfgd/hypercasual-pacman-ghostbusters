import type { AabbXZ } from './collisionXZ.ts'
import {
  CORRIDOR_DEPTH,
  DOOR_HALF,
  MANSION_OUTER_WALL_THICKNESS,
  ROOM_HALF,
} from './mansionGeometry.ts'
import { roomNorthZ, roomSouthZ } from './mansionRoomData.ts'

const S = ROOM_HALF
const C = CORRIDOR_DEPTH
const D = DOOR_HALF
const t = MANSION_OUTER_WALL_THICKNESS

/** South interior edge of ROOM_5 (deepest room, most negative Z). */
const Z_BOTTOM = roomSouthZ(5)

function hGap(
  minX: number,
  maxX: number,
  minZ: number,
  maxZ: number,
  doorMinX: number,
  doorMaxX: number,
): AabbXZ[] {
  const g: AabbXZ = { minX, maxX, minZ, maxZ }
  const out: AabbXZ[] = []
  if (doorMinX > g.minX) {
    out.push({ minX: g.minX, maxX: doorMinX, minZ: g.minZ, maxZ: g.maxZ })
  }
  if (doorMaxX < g.maxX) {
    out.push({ minX: doorMaxX, maxX: g.maxX, minZ: g.minZ, maxZ: g.maxZ })
  }
  return out
}

function corridorSideBlocks(z0: number, z1: number): AabbXZ[] {
  const lo = Math.min(z0, z1)
  const hi = Math.max(z0, z1)
  return [
    { minX: -S, maxX: -D, minZ: lo, maxZ: hi },
    { minX: D, maxX: S, minZ: lo, maxZ: hi },
  ]
}

export function buildMansionWallColliders(): AabbXZ[] {
  const boxes: AabbXZ[] = []

  // Outer shell: north cap (safe has no door north), full west/east, south cap
  boxes.push({
    minX: -S - t,
    maxX: S + t,
    minZ: S,
    maxZ: S + t,
  })
  boxes.push(
    { minX: -S - t, maxX: -S, minZ: Z_BOTTOM - t, maxZ: S + t },
    { minX: S, maxX: S + t, minZ: Z_BOTTOM - t, maxZ: S + t },
  )
  boxes.push({
    minX: -S - t,
    maxX: S + t,
    minZ: Z_BOTTOM - t,
    maxZ: Z_BOTTOM,
  })

  // Safe south wall — single door to first threshold
  boxes.push(...hGap(-S - t, S + t, -S - t, -S, -D, D))
  boxes.push(...corridorSideBlocks(-S - C, -S))
  // ROOM_1 north face (into first room from threshold)
  const r1North = roomNorthZ(1)
  boxes.push(...hGap(-S - t, S + t, r1North - t, r1North, -D, D))

  // Between rooms: south face of ROOM_k, threshold, north face of ROOM_{k+1}
  for (let k = 1; k <= 4; k++) {
    const southZk = roomSouthZ(k)
    const northNext = roomNorthZ(k + 1)
    boxes.push(...hGap(-S - t, S + t, southZk - t, southZk, -D, D))
    boxes.push(...corridorSideBlocks(northNext, southZk))
    boxes.push(...hGap(-S - t, S + t, northNext, northNext + t, -D, D))
  }

  return boxes
}

export const MANSION_WALL_COLLIDERS: readonly AabbXZ[] = buildMansionWallColliders()
