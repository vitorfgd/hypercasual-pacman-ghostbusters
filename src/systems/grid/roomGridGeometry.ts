import type { RoomBounds } from '../world/mansionRoomData.ts'
import { GRID_ROOM_INSET, ROOM_GRID_COLS, ROOM_GRID_ROWS } from './gridConfig.ts'

/** World center of grid cell — matches `planRoomGrids` / pickups. */
export function cellCenterWorld(
  b: RoomBounds,
  row: number,
  col: number,
  rows: number = ROOM_GRID_ROWS,
  cols: number = ROOM_GRID_COLS,
): { x: number; z: number } {
  const spanX = b.maxX - b.minX - 2 * GRID_ROOM_INSET
  const spanZ = b.maxZ - b.minZ - 2 * GRID_ROOM_INSET
  const u = (col + 0.5) / cols
  const v = (row + 0.5) / rows
  return {
    x: b.minX + GRID_ROOM_INSET + u * spanX,
    z: b.minZ + GRID_ROOM_INSET + v * spanZ,
  }
}

export function cellSizeWorld(
  b: RoomBounds,
  rows: number = ROOM_GRID_ROWS,
  cols: number = ROOM_GRID_COLS,
): { width: number; depth: number } {
  return {
    width: (b.maxX - b.minX - 2 * GRID_ROOM_INSET) / cols,
    depth: (b.maxZ - b.minZ - 2 * GRID_ROOM_INSET) / rows,
  }
}

/** Which cell contains this world point (clamped to grid). */
export function worldToCellIndex(
  b: RoomBounds,
  x: number,
  z: number,
  rows: number = ROOM_GRID_ROWS,
  cols: number = ROOM_GRID_COLS,
): { row: number; col: number } {
  const spanX = b.maxX - b.minX - 2 * GRID_ROOM_INSET
  const spanZ = b.maxZ - b.minZ - 2 * GRID_ROOM_INSET
  const u = (x - b.minX - GRID_ROOM_INSET) / spanX
  const v = (z - b.minZ - GRID_ROOM_INSET) / spanZ
  const col = Math.max(0, Math.min(cols - 1, Math.floor(u * cols)))
  const row = Math.max(0, Math.min(rows - 1, Math.floor(v * rows)))
  return { row, col }
}

export function boundsKey(b: RoomBounds): string {
  return `${b.minX},${b.maxX},${b.minZ},${b.maxZ}`
}
