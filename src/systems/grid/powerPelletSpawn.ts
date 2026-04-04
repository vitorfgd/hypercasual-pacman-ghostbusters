import type { ItemWorld } from '../items/ItemWorld.ts'
import {
  FINAL_NORMAL_ROOM_ID,
  type NormalRoomId,
} from '../world/mansionRoomData.ts'
import { ROOM_GRID_COLS, ROOM_GRID_ROWS } from './gridConfig.ts'
import type { RoomGridPlan } from './planRoomGrids.ts'
import { cellCenterWorld } from './roomGridGeometry.ts'
import { createPowerPelletItem } from '../../themes/wisp/itemFactory.ts'

/**
 * One power pellet in every planned room — placed on an empty grid cell biased “risky”
 * (northern rows + slight lateral offset from center).
 */
export function spawnPowerPelletsForRun(
  plans: ReadonlyMap<NormalRoomId, RoomGridPlan>,
  itemWorld: ItemWorld,
  isRoomAccessible: (roomId: NormalRoomId) => boolean,
  random: () => number,
): void {
  for (const [roomId, plan] of plans) {
    if (roomId === FINAL_NORMAL_ROOM_ID) continue
    const cell = pickRiskyPowerPelletCell(plan, random)
    if (!cell) continue
    const id = `power_pellet_${roomId}_${cell.row}_${cell.col}`
    const item = createPowerPelletItem(id, roomId)
    itemWorld.spawn(item, cell.x, cell.z, {
      visible: isRoomAccessible(roomId),
    })
  }
}

export function pickRiskyPowerPelletCell(
  plan: RoomGridPlan,
  random: () => number,
): { x: number; z: number; row: number; col: number } | null {
  const rows = ROOM_GRID_ROWS
  const cols = ROOM_GRID_COLS
  const occ = new Set<string>()
  for (const w of plan.wisps) occ.add(`${w.row},${w.col}`)
  for (const t of plan.traps) occ.add(`${t.row},${t.col}`)
  for (const wall of plan.walls) occ.add(`${wall.row},${wall.col}`)

  const startRow = rows - 1
  const startCol = Math.floor(cols / 2)
  const reachable = collectReachableCells(rows, cols, startRow, startCol, occ)

  const candidates: { row: number; col: number; score: number }[] = []
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (occ.has(`${r},${c}`)) continue
      if (!reachable.has(`${r},${c}`)) continue
      if (r === startRow && c === startCol) continue
      const score =
        r * 1.15 + Math.abs(c - cols * 0.5) * 0.35 + random() * 0.12
      candidates.push({ row: r, col: c, score })
    }
  }
  if (candidates.length === 0) return null
  candidates.sort((a, b) => b.score - a.score)
  const topN = Math.min(4, candidates.length)
  const pick = candidates[Math.floor(random() * topN)]!
  const { x, z } = cellCenterWorld(
    plan.bounds,
    pick.row,
    pick.col,
    rows,
    cols,
  )
  return { x, z, row: pick.row, col: pick.col }
}

function collectReachableCells(
  rows: number,
  cols: number,
  startRow: number,
  startCol: number,
  blocked: ReadonlySet<string>,
): Set<string> {
  const seen = new Set<string>()
  const q: [number, number][] = [[startRow, startCol]]
  const key = (r: number, c: number) => `${r},${c}`
  seen.add(key(startRow, startCol))
  while (q.length > 0) {
    const [r, c] = q.pop()!
    const dirs = [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ] as const
    for (const [dr, dc] of dirs) {
      const nr = r + dr
      const nc = c + dc
      if (nr < 0 || nr >= rows || nc < 0 || nc >= cols) continue
      const k = key(nr, nc)
      if (seen.has(k) || blocked.has(k)) continue
      seen.add(k)
      q.push([nr, nc])
    }
  }
  return seen
}
