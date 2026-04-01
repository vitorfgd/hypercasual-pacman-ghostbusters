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

/** North interior edge of ROOM_5 (top of last room). */
const Z_TOP = roomNorthZ(5)

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

/** Left / right of a narrow door threshold (blocks full room width except door lane). */
function corridorSideBlocks(z0: number, z1: number): AabbXZ[] {
  return [
    { minX: -S, maxX: -D, minZ: z0, maxZ: z1 },
    { minX: D, maxX: S, minZ: z0, maxZ: z1 },
  ]
}

export function buildMansionWallColliders(): AabbXZ[] {
  const boxes: AabbXZ[] = []

  // --- Outer shell (continuous east/west; south; north) ---
  boxes.push({
    minX: -S - t,
    maxX: S + t,
    minZ: -S - t,
    maxZ: -S,
  })
  boxes.push(
    { minX: -S - t, maxX: -S, minZ: -S, maxZ: Z_TOP + t },
    { minX: S, maxX: S + t, minZ: -S, maxZ: Z_TOP + t },
  )
  boxes.push({
    minX: -S - t,
    maxX: S + t,
    minZ: Z_TOP,
    maxZ: Z_TOP + t,
  })

  // --- Safe: north wall with single door ---
  boxes.push(...hGap(-S - t, S + t, S, S + t, -D, D))
  boxes.push(...corridorSideBlocks(S, S + C))
  // South wall of ROOM_1 (threshold → room) — same door width as safe exit
  const r1South = roomSouthZ(1)
  boxes.push(...hGap(-S - t, S + t, r1South - t, r1South, -D, D))

  // --- Between each pair of rooms: door walls + side blocks in the threshold ---
  for (let k = 1; k <= 4; k++) {
    const northZk = roomNorthZ(k)
    const southNext = roomSouthZ(k + 1)
    // North face of room k (door)
    boxes.push(...hGap(-S - t, S + t, northZk, northZk + t, -D, D))
    // Threshold (narrow walk)
    boxes.push(...corridorSideBlocks(northZk, southNext))
    // South face of room k+1 (door)
    boxes.push(...hGap(-S - t, S + t, southNext - t, southNext, -D, D))
  }

  return boxes
}

export const MANSION_WALL_COLLIDERS: readonly AabbXZ[] = buildMansionWallColliders()
