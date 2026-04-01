export type AabbXZ = {
  minX: number
  maxX: number
  minZ: number
  maxZ: number
}

function clamp(v: number, a: number, b: number): number {
  return Math.max(a, Math.min(b, v))
}

/**
 * Circle vs axis-aligned rectangles — iterative separation (solid walls).
 */
export function resolveCircleVsAabbs(
  px: number,
  pz: number,
  r: number,
  boxes: readonly AabbXZ[],
): { x: number; z: number } {
  let x = px
  let z = pz
  for (let iter = 0; iter < 8; iter++) {
    let moved = false
    for (const b of boxes) {
      const qx = clamp(x, b.minX, b.maxX)
      const qz = clamp(z, b.minZ, b.maxZ)
      let dx = x - qx
      let dz = z - qz
      let d2 = dx * dx + dz * dz
      if (d2 >= r * r - 1e-8) continue

      if (d2 < 1e-10) {
        const dl = x - b.minX
        const dr = b.maxX - x
        const db = z - b.minZ
        const dt = b.maxZ - z
        const m = Math.min(dl, dr, db, dt)
        if (m === dl) x = b.minX - r - 0.02
        else if (m === dr) x = b.maxX + r + 0.02
        else if (m === db) z = b.minZ - r - 0.02
        else z = b.maxZ + r + 0.02
        moved = true
        continue
      }

      const d = Math.sqrt(d2)
      dx /= d
      dz /= d
      x = qx + dx * (r + 0.02)
      z = qz + dz * (r + 0.02)
      moved = true
    }
    if (!moved) break
  }
  return { x, z }
}
