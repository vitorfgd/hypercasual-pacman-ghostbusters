import type { Vector3 } from 'three'
import type { WorldCollision } from '../world/WorldCollision.ts'

/**
 * Pull camera toward `eye` when `resolveCircleXZ` shows the probe overlaps walls.
 * Cheap alternative to full ray–AABB; keeps camera outside collision volumes.
 */
export function pullCameraTowardEyeIfBlocked(
  worldCollision: WorldCollision,
  eye: Vector3,
  desired: Vector3,
  probeRadius: number,
  out: Vector3,
  maxIter = 14,
): void {
  out.copy(desired)
  for (let i = 0; i < maxIter; i++) {
    const r = worldCollision.resolveCircleXZ(out.x, out.z, probeRadius)
    const dx = r.x - out.x
    const dz = r.z - out.z
    if (dx * dx + dz * dz < 0.012) {
      out.x = r.x
      out.z = r.z
      return
    }
    out.x += (eye.x - out.x) * 0.24
    out.y += (eye.y - out.y) * 0.12
    out.z += (eye.z - out.z) * 0.24
  }
}
