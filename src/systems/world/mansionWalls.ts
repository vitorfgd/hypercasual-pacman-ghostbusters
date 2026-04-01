import type { AabbXZ } from './collisionXZ.ts'
import {
  DOOR_HALF,
  MANSION_OUTER_WALL_THICKNESS,
} from './mansionGeometry.ts'

const D = DOOR_HALF

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

function vGap(
  minX: number,
  maxX: number,
  minZ: number,
  maxZ: number,
  doorMinZ: number,
  doorMaxZ: number,
): AabbXZ[] {
  const g: AabbXZ = { minX, maxX, minZ, maxZ }
  const out: AabbXZ[] = []
  if (doorMinZ > g.minZ) {
    out.push({ minX: g.minX, maxX: g.maxX, minZ: g.minZ, maxZ: doorMinZ })
  }
  if (doorMaxZ < g.maxZ) {
    out.push({ minX: g.minX, maxX: g.maxX, minZ: doorMaxZ, maxZ: g.maxZ })
  }
  return out
}

/**
 * Axis-aligned wall colliders (XZ) — door pillars + outer perimeter.
 * Hub slabs use the full corridor depth (z or x from ±5 to ±7) so N/E/S/W
 * segments share edges at (±5,±5) with no inset gap.
 */
export function buildMansionWallColliders(): AabbXZ[] {
  const boxes: AabbXZ[] = []

  const hubN = hGap(-6, 6, 5, 7, -D, D)
  const hubS = hGap(-6, 6, -7, -5, -D, D)
  const hubE = vGap(5, 7, -6, 6, -D, D)
  const hubW = vGap(-7, -5, -6, 6, -D, D)

  boxes.push(...hubN, ...hubS, ...hubE, ...hubW)

  /** Small corner glue at hub rim (±5,±5) — closes visible seams between N/E/S/W slabs. */
  const g = 0.2
  boxes.push(
    { minX: 5, maxX: 5 + g, minZ: 5, maxZ: 5 + g },
    { minX: -5 - g, maxX: -5, minZ: 5, maxZ: 5 + g },
    { minX: -5 - g, maxX: -5, minZ: -5 - g, maxZ: -5 },
    { minX: 5, maxX: 5 + g, minZ: -5 - g, maxZ: -5 },
  )

  boxes.push(
    ...vGap(-7, -5, 6, 17, 10.5, 13.5),
    ...vGap(5, 7, 6, 17, 10.5, 13.5),
    ...vGap(-7, -5, -17, -6, -13.5, -10.5),
    ...vGap(5, 7, -17, -6, -13.5, -10.5),
  )

  boxes.push(
    ...hGap(-17, -7, 5, 7, -13.5, -10.5),
    ...hGap(-17, -7, -7, -5, -13.5, -10.5),
    ...hGap(7, 17, 5, 7, 10.5, 13.5),
    ...hGap(7, 17, -7, -5, 10.5, 13.5),
  )

  const t = MANSION_OUTER_WALL_THICKNESS
  const e = t * 0.55
  boxes.push(
    { minX: -17.5 - e, maxX: 17.5 + e, minZ: 17, maxZ: 17 + t },
    { minX: -17.5 - e, maxX: 17.5 + e, minZ: -17 - t, maxZ: -17 },
    { minX: 17, maxX: 17 + t, minZ: -17.5 - e, maxZ: 17.5 + e },
    { minX: -17.5 - t, maxX: -17, minZ: -17.5 - e, maxZ: 17.5 + e },
  )

  return boxes
}

export const MANSION_WALL_COLLIDERS: readonly AabbXZ[] = buildMansionWallColliders()
