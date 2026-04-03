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
 * One power pellet in a subset of rooms — placed on an empty grid cell biased “risky”
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
    if (random() > 0.44) continue
    const cell = pickRiskyPowerPelletCell(plan, random)
    if (!cell) continue
    const id = `power_pellet_${roomId}_${cell.row}_${cell.col}`
    const item = createPowerPelletItem(id, roomId)
    itemWorld.spawn(item, cell.x, cell.z, {
      visible: isRoomAccessible(roomId),
    })
  }
}

function pickRiskyPowerPelletCell(
  plan: RoomGridPlan,
  random: () => number,
): { x: number; z: number; row: number; col: number } | null {
  const rows = ROOM_GRID_ROWS
  const cols = ROOM_GRID_COLS
  const occ = new Set<string>()
  for (const w of plan.wisps) occ.add(`${w.row},${w.col}`)
  for (const t of plan.traps) occ.add(`${t.row},${t.col}`)

  const startRow = rows - 1
  const startCol = Math.floor(cols / 2)

  const candidates: { row: number; col: number; score: number }[] = []
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (occ.has(`${r},${c}`)) continue
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
