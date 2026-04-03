import type { DoorUnlockSystem } from '../doors/DoorUnlockSystem.ts'
import { roomIndexFromId } from '../doors/doorLayout.ts'
import type { RoomId } from '../world/mansionRoomData.ts'

function prereqSouthernAccessForRoom(
  roomIdx: number,
  doorUnlock: DoorUnlockSystem,
): boolean {
  if (roomIdx <= 1) return true
  const lastDoor = roomIdx - 1
  for (let d = 0; d < lastDoor; d++) {
    if (!doorUnlock.isDoorSouthernAccessGranted(d)) return false
  }
  return true
}

function smoothstep(t: number): number {
  const u = Math.max(0, Math.min(1, t))
  return u * u * (3 - 2 * u)
}

/**
 * 0 = hidden, 1 = fully shown. Uses swing progress on the door that first opens `spawnRoomId`
 * (ROOM_n → door n−1), or full opacity once that door is one-way passed.
 */
export function computeClutterRevealOpacity(
  spawnRoomId: RoomId,
  doorUnlock: DoorUnlockSystem,
): number {
  const roomIdx = roomIndexFromId(spawnRoomId)
  if (roomIdx === null || roomIdx <= 1) return 1

  if (!prereqSouthernAccessForRoom(roomIdx, doorUnlock)) return 0

  const doorIndex = roomIdx - 1
  if (doorUnlock.isDoorSouthernAccessGranted(doorIndex)) return 1

  const u = doorUnlock.getDoorSwingOpen01(doorIndex)
  return smoothstep(u)
}
