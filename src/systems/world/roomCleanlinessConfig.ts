import { clutterPiecesForRoom } from '../clutter/clutterSpawnConfig.ts'

/**
 * Each clutter pickup in `ROOM_k` adds this fraction toward 100% (piece count may vary by depth).
 */
export function cleanlinessPercentPerClutter(roomIndex: number): number {
  const n = clutterPiecesForRoom(roomIndex)
  if (n <= 0) return 0
  return 100 / n
}
