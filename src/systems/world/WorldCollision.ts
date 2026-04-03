import type { AabbXZ } from './collisionXZ.ts'
import { resolveCircleVsAabbs } from './collisionXZ.ts'
import { MANSION_WALL_COLLIDERS } from './mansionWalls.ts'
import { MANSION_WORLD_HALF } from './mansionGeometry.ts'

function pointInsideAabbXZ(px: number, pz: number, b: AabbXZ): boolean {
  return px >= b.minX && px <= b.maxX && pz >= b.minZ && pz <= b.maxZ
}

/**
 * True if the open segment (x0,z0)→(x1,z1) intersects interior of any AABB (wall slab).
 */
export function segmentIntersectWallAabbs(
  x0: number,
  z0: number,
  x1: number,
  z1: number,
  boxes: readonly AabbXZ[],
  samples: number,
): boolean {
  const n = Math.max(2, Math.floor(samples))
  for (let i = 0; i <= n; i++) {
    const t = i / n
    const px = x0 + (x1 - x0) * t
    const pz = z0 + (z1 - z0) * t
    for (const b of boxes) {
      if (pointInsideAabbXZ(px, pz, b)) return true
    }
  }
  return false
}

/**
 * World wall collision: circle vs static AABBs + soft outer clamp.
 */
export class WorldCollision {
  private readonly base: readonly AabbXZ[]
  /** Built in `setExtraColliders` — avoids per-entity `[...base, ...extra]` allocs in hot paths. */
  private mergedForResolve: readonly AabbXZ[] | null = null

  constructor(boxes: readonly AabbXZ[] = MANSION_WALL_COLLIDERS) {
    this.base = boxes
  }

  /** Door blockers while locked — replaced each sync. */
  setExtraColliders(boxes: AabbXZ[]): void {
    this.mergedForResolve =
      boxes.length === 0 ? this.base : [...this.base, ...boxes]
  }

  resolveCircleXZ(x: number, z: number, radius: number): { x: number; z: number } {
    const boxes = this.mergedForResolve ?? this.base
    let o = resolveCircleVsAabbs(x, z, radius, boxes)
    const m = MANSION_WORLD_HALF - radius
    o = {
      x: Math.max(-m, Math.min(m, o.x)),
      z: Math.max(-m, Math.min(m, o.z)),
    }
    return o
  }

  /** Ghost vision LOS: unobstructed segment through walkable plane (wall AABBs as blockers). */
  lineOfSightClearXZ(
    x0: number,
    z0: number,
    x1: number,
    z1: number,
    samples = 10,
  ): boolean {
    const boxes = this.mergedForResolve ?? this.base
    return !segmentIntersectWallAabbs(x0, z0, x1, z1, boxes, samples)
  }
}
