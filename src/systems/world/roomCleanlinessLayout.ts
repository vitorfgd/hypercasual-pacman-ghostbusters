import { DOOR_COUNT, roomIndexFromId } from '../doors/doorLayout.ts'
import type { RoomId } from './mansionRoomData.ts'

/**
 * When `ROOM_k` reaches 100% cleanliness, door `k` opens (passage toward `ROOM_{k+1}`).
 * Deepest room has no further gate.
 */
export function doorIndexToOpenWhenRoomCleared(roomId: RoomId): number | null {
  if (roomId === 'SAFE_CENTER') return null
  const idx = roomIndexFromId(roomId)
  if (idx === null || idx < 1) return null
  if (idx >= DOOR_COUNT) return null
  return idx
}
