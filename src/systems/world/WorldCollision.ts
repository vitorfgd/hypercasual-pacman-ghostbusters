import type { AabbXZ } from './collisionXZ.ts'
import { resolveCircleVsAabbs } from './collisionXZ.ts'
import { MANSION_WALL_COLLIDERS } from './mansionWalls.ts'
import { MANSION_WORLD_HALF } from './mansionGeometry.ts'

/**
 * World wall collision: circle vs static AABBs + soft outer clamp.
 */
export class WorldCollision {
  private readonly boxes: readonly AabbXZ[]

  constructor(boxes: readonly AabbXZ[] = MANSION_WALL_COLLIDERS) {
    this.boxes = boxes
  }

  resolveCircleXZ(x: number, z: number, radius: number): { x: number; z: number } {
    let o = resolveCircleVsAabbs(x, z, radius, this.boxes)
    const m = MANSION_WORLD_HALF - radius
    o = {
      x: Math.max(-m, Math.min(m, o.x)),
      z: Math.max(-m, Math.min(m, o.z)),
    }
    return o
  }
}
