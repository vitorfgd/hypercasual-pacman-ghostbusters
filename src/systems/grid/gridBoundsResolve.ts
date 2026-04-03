import {
  CORRIDOR_BOUNDS,
  ROOM_LIST,
  ROOMS,
  type RoomBounds,
} from '../world/mansionRoomData.ts'

function distPointToRectBounds(b: RoomBounds, x: number, z: number): number {
  const px = Math.max(b.minX, Math.min(b.maxX, x))
  const pz = Math.max(b.minZ, Math.min(b.maxZ, z))
  return Math.hypot(x - px, z - pz)
}

/**
 * Room / door-corridor `RoomBounds` for grid nav at a world XZ.
 *
 * Always returns a region: strict hit-test first, then **closest** room or corridor AABB by
 * distance to the rectangle. This covers “void” gaps beside door thresholds (full room width vs
 * narrow corridor boxes) so probes and the player never see `null` and stall grid movement.
 */
export function resolveGridBoundsAt(x: number, z: number): RoomBounds {
  for (const r of ROOM_LIST) {
    const b = r.bounds
    if (x >= b.minX && x <= b.maxX && z >= b.minZ && z <= b.maxZ) {
      return b
    }
  }
  for (const b of CORRIDOR_BOUNDS) {
    if (x >= b.minX && x <= b.maxX && z >= b.minZ && z <= b.maxZ) {
      return b
    }
  }

  let best: RoomBounds | null = null
  let bestD = Infinity
  for (const r of ROOM_LIST) {
    const d = distPointToRectBounds(r.bounds, x, z)
    if (d < bestD) {
      bestD = d
      best = r.bounds
    }
  }
  for (const b of CORRIDOR_BOUNDS) {
    const d = distPointToRectBounds(b, x, z)
    if (d < bestD) {
      bestD = d
      best = b
    }
  }
  return best ?? ROOMS.SAFE_CENTER.bounds
}
