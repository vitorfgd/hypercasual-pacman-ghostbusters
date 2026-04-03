import { ROOM_GRID_COLS, ROOM_GRID_ROWS } from './gridConfig.ts'
import type { RoomGridPlan } from './planRoomGrids.ts'
import { cellCenterWorld } from './roomGridGeometry.ts'

/**
 * Pick a random non-trap grid cell center, preferring cells at least `minDistFromPlayer`
 * from the player. If none qualify, biases toward farther cells.
 */
export function pickGridGhostSpawnXZ(
  plan: RoomGridPlan,
  playerX: number,
  playerZ: number,
  minDistFromPlayer: number,
  random: () => number,
): { x: number; z: number } | null {
  const rows = ROOM_GRID_ROWS
  const cols = ROOM_GRID_COLS
  const trapSet = new Set(plan.traps.map((t) => `${t.row},${t.col}`))
  const cells: { x: number; z: number; d: number }[] = []
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (trapSet.has(`${r},${c}`)) continue
      const { x, z } = cellCenterWorld(plan.bounds, r, c, rows, cols)
      const d = Math.hypot(x - playerX, z - playerZ)
      cells.push({ x, z, d })
    }
  }
  if (cells.length === 0) return null

  const farEnough = cells.filter((o) => o.d >= minDistFromPlayer)
  if (farEnough.length > 0) {
    const pick = farEnough[Math.floor(random() * farEnough.length)]!
    return { x: pick.x, z: pick.z }
  }

  cells.sort((a, b) => b.d - a.d)
  const topN = Math.max(1, Math.ceil(cells.length * 0.45))
  const slice = cells.slice(0, topN)
  const pick = slice[Math.floor(random() * slice.length)]!
  return { x: pick.x, z: pick.z }
}
