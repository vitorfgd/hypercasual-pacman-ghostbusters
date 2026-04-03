/**
 * Each grid wisp in a room adds this fraction toward 100% (`totalWisps` from `planAllRoomGrids`).
 */
export function cleanlinessPercentPerGridWisp(totalWispsInRoom: number): number {
  const n = Math.max(0, Math.floor(totalWispsInRoom))
  if (n <= 0) return 0
  return 100 / n
}
