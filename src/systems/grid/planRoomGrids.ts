import type { RoomBounds } from '../world/mansionRoomData.ts'
import {
  FINAL_NORMAL_ROOM_ID,
  NORMAL_ROOM_IDS,
  type NormalRoomId,
  type RoomId,
} from '../world/mansionRoomData.ts'
import type { RoomSystem } from '../world/RoomSystem.ts'
import {
  GRID_PLAN_MAX_ATTEMPTS,
  GRID_TRAP_FRACTION_MAX,
  GRID_TRAP_FRACTION_MIN,
  GRID_WALL_FRACTION_MAX,
  GRID_WALL_FRACTION_MIN,
  GRID_WISP_FRACTION_MAX,
  GRID_WISP_FRACTION_MIN,
  ROOM_GRID_COLS,
  ROOM_GRID_ROWS,
} from './gridConfig.ts'
import { cellCenterWorld, cellSizeWorld } from './roomGridGeometry.ts'
import type { TrapPlacement } from '../traps/TrapFieldSystem.ts'

export type GridWispSpawn = {
  /** Stable id for item + debug */
  id: string
  x: number
  z: number
  row: number
  col: number
}

export type GridTrapSpawn = {
  x: number
  z: number
  row: number
  col: number
}

export type GridWallSpawn = {
  x: number
  z: number
  row: number
  col: number
  width: number
  depth: number
}

export type RoomGridPlan = {
  roomId: NormalRoomId
  bounds: RoomBounds
  wisps: readonly GridWispSpawn[]
  traps: readonly GridTrapSpawn[]
  walls: readonly GridWallSpawn[]
}

type Cell = 'empty' | 'wisp' | 'trap' | 'wall'

/** BFS from `start` — traps block; wisps and empty are walkable. */
function allWispsReachable(
  grid: Cell[][],
  rows: number,
  cols: number,
  startR: number,
  startC: number,
  wispPositions: Set<string>,
): boolean {
  const key = (r: number, c: number) => `${r},${c}`
  const q: [number, number][] = [[startR, startC]]
  const seen = new Set<string>([key(startR, startC)])
  const dirs = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ] as const

  while (q.length > 0) {
    const [r, c] = q.pop()!
    for (const [dr, dc] of dirs) {
      const nr = r + dr
      const nc = c + dc
      if (nr < 0 || nr >= rows || nc < 0 || nc >= cols) continue
      const k = key(nr, nc)
      if (seen.has(k)) continue
      const cell = grid[nr]![nc]!
      if (cell === 'trap' || cell === 'wall') continue
      seen.add(k)
      q.push([nr, nc])
    }
  }

  for (const w of wispPositions) {
    if (!seen.has(w)) return false
  }
  return true
}

function planOneRoom(
  roomId: NormalRoomId,
  bounds: RoomBounds,
  random: () => number,
  rows: number,
  cols: number,
): RoomGridPlan | null {
  const totalCells = rows * cols
  const startRow = rows - 1
  const startCol = Math.floor(cols / 2)

  for (let attempt = 0; attempt < GRID_PLAN_MAX_ATTEMPTS; attempt++) {
    const wispFrac =
      GRID_WISP_FRACTION_MIN +
      random() * (GRID_WISP_FRACTION_MAX - GRID_WISP_FRACTION_MIN)
    const trapFrac =
      GRID_TRAP_FRACTION_MIN +
      random() * (GRID_TRAP_FRACTION_MAX - GRID_TRAP_FRACTION_MIN)
    const wallFrac =
      GRID_WALL_FRACTION_MIN +
      random() * (GRID_WALL_FRACTION_MAX - GRID_WALL_FRACTION_MIN)

    let targetW = Math.max(2, Math.floor(totalCells * wispFrac))
    let targetT = Math.max(1, Math.floor(totalCells * trapFrac))
    let targetWall = Math.max(2, Math.floor(totalCells * wallFrac))
    targetW = Math.max(2, Math.min(targetW, totalCells - 4))
    targetWall = Math.max(1, Math.min(targetWall, totalCells - 1 - targetW - targetT))
    targetT = Math.max(1, Math.min(targetT, totalCells - 1 - targetW - targetWall))

    const indices: number[] = []
    for (let i = 0; i < totalCells; i++) indices.push(i)
    for (let i = indices.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1))
      ;[indices[i], indices[j]] = [indices[j]!, indices[i]!]
    }

    const grid: Cell[][] = Array.from({ length: rows }, () =>
      Array.from({ length: cols }, (): Cell => 'empty'),
    )

    const wispKeys = new Set<string>()
    let placed = 0
    for (const idx of indices) {
      if (placed >= targetW) break
      const r = Math.floor(idx / cols)
      const c = idx % cols
      if (r === startRow && c === startCol) continue
      grid[r]![c] = 'wisp'
      wispKeys.add(`${r},${c}`)
      placed++
    }

    const wallCandidates: [number, number][] = []
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (grid[r]![c] !== 'empty') continue
        if (r === startRow && c === startCol) continue
        if (r >= rows - 2 && Math.abs(c - startCol) <= 1) continue
        wallCandidates.push([r, c])
      }
    }
    for (let i = wallCandidates.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1))
      ;[wallCandidates[i], wallCandidates[j]] = [
        wallCandidates[j]!,
        wallCandidates[i]!,
      ]
    }
    let wallsPlaced = 0
    for (const [r, c] of wallCandidates) {
      if (wallsPlaced >= targetWall) break
      grid[r]![c] = 'wall'
      if (
        allWispsReachable(grid, rows, cols, startRow, startCol, wispKeys)
      ) {
        wallsPlaced++
      } else {
        grid[r]![c] = 'empty'
      }
    }

    const trapCandidates: [number, number][] = []
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (grid[r]![c] !== 'empty') continue
        if (r === startRow && c === startCol) continue
        trapCandidates.push([r, c])
      }
    }
    for (let i = trapCandidates.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1))
      ;[trapCandidates[i], trapCandidates[j]] = [
        trapCandidates[j]!,
        trapCandidates[i]!,
      ]
    }
    let tPlaced = 0
    for (const [r, c] of trapCandidates) {
      if (tPlaced >= targetT) break
      grid[r]![c] = 'trap'
      tPlaced++
    }

    if (
      !allWispsReachable(grid, rows, cols, startRow, startCol, wispKeys)
    ) {
      continue
    }

    const wisps: GridWispSpawn[] = []
    let wi = 0
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (grid[r]![c] !== 'wisp') continue
        const { x, z } = cellCenterWorld(bounds, r, c, rows, cols)
        wisps.push({
          id: `grid_wisp_${roomId}_${r}_${c}_${wi++}`,
          x,
          z,
          row: r,
          col: c,
        })
      }
    }

    const traps: GridTrapSpawn[] = []
    const walls: GridWallSpawn[] = []
    const cellSize = cellSizeWorld(bounds, rows, cols)
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const cell = grid[r]![c]
        if (cell === 'trap') {
          const { x, z } = cellCenterWorld(bounds, r, c, rows, cols)
          traps.push({ x, z, row: r, col: c })
          continue
        }
        if (cell !== 'wall') continue
        const { x, z } = cellCenterWorld(bounds, r, c, rows, cols)
        walls.push({
          x,
          z,
          row: r,
          col: c,
          width: cellSize.width * 0.78,
          depth: cellSize.depth * 0.78,
        })
      }
    }

    return { roomId, bounds, wisps, traps, walls }
  }

  return null
}

export type MazeWallPlacement = {
  x: number
  z: number
  width: number
  depth: number
}

/**
 * Builds a grid plan per normal room (boss / last room skipped — no arcade grid there).
 */
export function planAllRoomGrids(
  roomSystem: RoomSystem,
  random: () => number,
): {
  plans: Map<NormalRoomId, RoomGridPlan>
  wispTotals: Map<RoomId, number>
} {
  const plans = new Map<NormalRoomId, RoomGridPlan>()
  const wispTotals = new Map<RoomId, number>()

  for (const roomId of NORMAL_ROOM_IDS) {
    if (roomId === FINAL_NORMAL_ROOM_ID) {
      wispTotals.set(roomId, 0)
      continue
    }
    const bounds = roomSystem.getBounds(roomId)
    const plan = planOneRoom(roomId, bounds, random, ROOM_GRID_ROWS, ROOM_GRID_COLS)
    if (!plan) {
      console.warn(`[grid] Failed to plan ${roomId} — empty plan`)
      wispTotals.set(roomId, 0)
      continue
    }
    plans.set(roomId, plan)
    wispTotals.set(roomId, plan.wisps.length)
  }

  return { plans, wispTotals }
}

/** Flatten trap positions for `TrapFieldSystem` (all normal rooms with a plan). */
export function flattenTrapPlacements(
  plans: ReadonlyMap<NormalRoomId, RoomGridPlan>,
): TrapPlacement[] {
  const out: TrapPlacement[] = []
  for (const plan of plans.values()) {
    for (const t of plan.traps) {
      out.push({ x: t.x, z: t.z })
    }
  }
  return out
}

export function flattenMazeWallPlacements(
  plans: ReadonlyMap<NormalRoomId, RoomGridPlan>,
): MazeWallPlacement[] {
  const out: MazeWallPlacement[] = []
  for (const plan of plans.values()) {
    for (const wall of plan.walls) {
      out.push({
        x: wall.x,
        z: wall.z,
        width: wall.width,
        depth: wall.depth,
      })
    }
  }
  return out
}
