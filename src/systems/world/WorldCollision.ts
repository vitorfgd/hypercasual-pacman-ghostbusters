import type { AabbXZ } from './collisionXZ.ts'
import { resolveCircleVsAabbs } from './collisionXZ.ts'
import { MANSION_WALL_COLLIDERS } from './mansionWalls.ts'
import { MANSION_WORLD_HALF } from './mansionGeometry.ts'

function aabbListsEqual(
  a: readonly AabbXZ[],
  b: readonly AabbXZ[],
): boolean {
  if (a.length !== b.length) return false
  for (let i = 0; i < a.length; i++) {
    const x = a[i]!
    const y = b[i]!
    if (
      Math.abs(x.minX - y.minX) > 1e-9 ||
      Math.abs(x.maxX - y.maxX) > 1e-9 ||
      Math.abs(x.minZ - y.minZ) > 1e-9 ||
      Math.abs(x.maxZ - y.maxZ) > 1e-9
    ) {
      return false
    }
  }
  return true
}

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
 *
 * Base slabs (`mansionWalls`) include door jambs and corridor sides; those fight the arcade
 * grid inside rooms. The player passes `ignoreBaseWallColliders` while inside a room floor
 * so only **door extras** (locked / swinging leaves) still apply.
 */
export class WorldCollision {
  private readonly base: readonly AabbXZ[]
  private structure: readonly AabbXZ[] = []
  private extra: readonly AabbXZ[] = []
  private allBoxesCache: readonly AabbXZ[]
  private structureAndExtraCache: readonly AabbXZ[] = []

  constructor(boxes: readonly AabbXZ[] = MANSION_WALL_COLLIDERS) {
    this.base = boxes
    this.allBoxesCache = boxes
  }

  /** Door blockers while locked — replaced each sync. */
  setExtraColliders(boxes: AabbXZ[]): void {
    if (aabbListsEqual(this.extra, boxes)) return
    this.extra = boxes
    this.rebuildColliderCaches()
  }

  /** Runtime room structures (for example internal maze walls). */
  setStructureColliders(boxes: AabbXZ[]): void {
    if (aabbListsEqual(this.structure, boxes)) return
    this.structure = boxes
    this.rebuildColliderCaches()
  }

  private allWallBoxes(): readonly AabbXZ[] {
    return this.allBoxesCache
  }

  private nonBaseWallBoxes(): readonly AabbXZ[] {
    return this.structureAndExtraCache
  }

  private rebuildColliderCaches(): void {
    if (this.structure.length === 0 && this.extra.length === 0) {
      this.structureAndExtraCache = []
      this.allBoxesCache = this.base
      return
    }

    const nonBase: AabbXZ[] = []
    if (this.structure.length > 0) nonBase.push(...this.structure)
    if (this.extra.length > 0) nonBase.push(...this.extra)
    this.structureAndExtraCache = nonBase

    const all: AabbXZ[] = [...this.base]
    all.push(...nonBase)
    this.allBoxesCache = all
  }

  /**
   * @param ignoreBaseWallColliders When true, only `extra` (doors) are solid — use on the
   *   player inside `RoomSystem.getRoomAt` so room cells are not nudged by jamb geometry.
   */
  resolveCircleXZ(
    x: number,
    z: number,
    radius: number,
    ignoreBaseWallColliders = false,
  ): { x: number; z: number } {
    const boxes = ignoreBaseWallColliders
      ? this.nonBaseWallBoxes()
      : this.allWallBoxes()
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
    const boxes = this.allWallBoxes()
    return !segmentIntersectWallAabbs(x0, z0, x1, z1, boxes, samples)
  }

  /**
   * True when a circle can move along the segment without being pushed by world colliders.
   * Used by grid-nav so blocked directions do not start a segment and jitter against walls.
   */
  canTraverseCircleXZ(
    x0: number,
    z0: number,
    x1: number,
    z1: number,
    radius: number,
    ignoreBaseWallColliders = false,
    samples = 6,
  ): boolean {
    const n = Math.max(2, Math.floor(samples))
    for (let i = 1; i <= n; i++) {
      const t = i / n
      const px = x0 + (x1 - x0) * t
      const pz = z0 + (z1 - z0) * t
      const resolved = this.resolveCircleXZ(
        px,
        pz,
        radius,
        ignoreBaseWallColliders,
      )
      if (Math.hypot(resolved.x - px, resolved.z - pz) > 1e-3) {
        return false
      }
    }
    return true
  }
}
