import type { AabbXZ } from './collisionXZ.ts'
import { resolveCircleVsAabbs } from './collisionXZ.ts'
import { MANSION_WALL_COLLIDERS } from './mansionWalls.ts'
import { MANSION_WORLD_HALF } from './mansionGeometry.ts'

/**
 * World wall collision: circle vs static AABBs + soft outer clamp.
 */
export class WorldCollision {
  private readonly base: readonly AabbXZ[]
  private extra: AabbXZ[] = []

  constructor(boxes: readonly AabbXZ[] = MANSION_WALL_COLLIDERS) {
    this.base = boxes
  }

  /** Door blockers while locked — replaced each sync. */
  setExtraColliders(boxes: AabbXZ[]): void {
    this.extra = boxes
  }

  resolveCircleXZ(x: number, z: number, radius: number): { x: number; z: number } {
    const boxes =
      this.extra.length === 0 ? this.base : [...this.base, ...this.extra]
    let o = resolveCircleVsAabbs(x, z, radius, boxes)
    const m = MANSION_WORLD_HALF - radius
    o = {
      x: Math.max(-m, Math.min(m, o.x)),
      z: Math.max(-m, Math.min(m, o.z)),
    }
    return o
  }
}
