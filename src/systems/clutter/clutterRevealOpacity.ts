import type { DoorUnlockSystem } from '../doors/DoorUnlockSystem.ts'
import {
  GATE_ANTICIPATION_SEC,
  GATE_OPEN_DELAY_SEC,
  GATE_SINK_DURATION_SEC,
} from '../doors/doorUnlockConfig.ts'
import { roomIndexFromId } from '../doors/doorLayout.ts'
import type { RoomId } from '../world/mansionRoomData.ts'

/**
 * Fade begins this many seconds after the gate **sink** starts (vertical lowering).
 * Clutter stays fully hidden during delay + shake and for this window after sink starts.
 */
export const CLUTTER_REVEAL_FADE_START_AFTER_SINK_SEC = 0.1

const SINK_T0 = GATE_OPEN_DELAY_SEC + GATE_ANTICIPATION_SEC
const OPEN_TOTAL =
  GATE_OPEN_DELAY_SEC + GATE_ANTICIPATION_SEC + GATE_SINK_DURATION_SEC

function prereqDoorsOpenForRoom(
  roomIdx: number,
  doorUnlock: DoorUnlockSystem,
): boolean {
  if (roomIdx <= 1) return true
  const lastDoor = roomIdx - 1
  for (let d = 0; d < lastDoor; d++) {
    if (!doorUnlock.isDoorUnlocked(d)) return false
  }
  return true
}

function smoothstep(t: number): number {
  const u = Math.max(0, Math.min(1, t))
  return u * u * (3 - 2 * u)
}

/**
 * 0 = hidden, 1 = fully shown. Uses the door that first opens `spawnRoomId` (ROOM_n → door n−1).
 * No respawn — only for driving opacity / visibility on existing meshes.
 */
export function computeClutterRevealOpacity(
  spawnRoomId: RoomId,
  doorUnlock: DoorUnlockSystem,
): number {
  const roomIdx = roomIndexFromId(spawnRoomId)
  if (roomIdx === null || roomIdx <= 1) return 1

  if (!prereqDoorsOpenForRoom(roomIdx, doorUnlock)) return 0

  const doorIndex = roomIdx - 1
  if (doorUnlock.isDoorUnlocked(doorIndex)) return 1

  const el = doorUnlock.getDoorOpeningElapsed(doorIndex)
  if (el === null) return 0

  const fadeStart = SINK_T0 + CLUTTER_REVEAL_FADE_START_AFTER_SINK_SEC
  if (el < fadeStart) return 0

  const u = Math.min(1, (el - fadeStart) / (OPEN_TOTAL - fadeStart))
  return smoothstep(u)
}
