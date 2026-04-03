import { roomCenter } from '../world/mansionRoomData.ts'
import type { RoomId } from '../world/mansionRoomData.ts'

/**
 * Portal XZ offset from `roomCenter(roomId)` — one disposal portal per explorable room.
 */
const OFFSET_XZ: Record<RoomId, { ox: number; oz: number }> = {
  SAFE_CENTER: { ox: 0, oz: -5.35 },
  ROOM_1: { ox: 2.35, oz: 0.55 },
  ROOM_2: { ox: -2.2, oz: -0.45 },
  ROOM_3: { ox: 1.85, oz: 0.65 },
  ROOM_4: { ox: -2.45, oz: 0.35 },
  ROOM_5: { ox: 0.35, oz: -1.1 },
}

export function getTrashPortalXZ(roomId: RoomId): { x: number; z: number } {
  const c = roomCenter(roomId)
  const o = OFFSET_XZ[roomId]
  return { x: c.x + o.ox, z: c.z + o.oz }
}
