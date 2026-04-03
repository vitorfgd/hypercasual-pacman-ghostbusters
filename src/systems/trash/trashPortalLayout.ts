import { roomCenter } from '../world/mansionRoomData.ts'
import type { RoomId } from '../world/mansionRoomData.ts'

/** Hub portal — fixed offset from safe center. */
const SAFE_OFFSET = { ox: 0, oz: -5.35 }

/**
 * Repeating pattern for normal rooms (cycles for ROOM_6+).
 * Portal XZ offset from `roomCenter(roomId)` — one disposal portal per explorable room.
 */
const NORMAL_OFFSET_PATTERN: readonly { ox: number; oz: number }[] = [
  { ox: 2.35, oz: 0.55 },
  { ox: -2.2, oz: -0.45 },
  { ox: 1.85, oz: 0.65 },
  { ox: -2.45, oz: 0.35 },
  { ox: 0.35, oz: -1.1 },
]

function normalRoomIndex(roomId: RoomId): number {
  const m = /^ROOM_(\d+)$/.exec(roomId)
  return m ? Number(m[1]) : 1
}

export function getTrashPortalXZ(roomId: RoomId): { x: number; z: number } {
  const c = roomCenter(roomId)
  if (roomId === 'SAFE_CENTER') {
    return { x: c.x + SAFE_OFFSET.ox, z: c.z + SAFE_OFFSET.oz }
  }
  const idx = (normalRoomIndex(roomId) - 1) % NORMAL_OFFSET_PATTERN.length
  const o = NORMAL_OFFSET_PATTERN[idx]!
  return { x: c.x + o.ox, z: c.z + o.oz }
}
