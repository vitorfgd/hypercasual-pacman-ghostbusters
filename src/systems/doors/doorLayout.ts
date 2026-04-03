import { ROOM_HALF } from '../world/mansionGeometry.ts'
import { roomNorthZ, roomSouthZ } from '../world/mansionRoomData.ts'
import type { RoomId } from '../world/mansionRoomData.ts'

export const DOOR_COUNT = 5

const S = ROOM_HALF

/**
 * World Z of each door plane (blocker / collision). Door 0 = safe south wall.
 * Door k>0 = south edge of ROOM_k (passage toward ROOM_{k+1}).
 */
export function getDoorBlockerZ(doorIndex: number): number {
  if (doorIndex === 0) return -S
  return roomSouthZ(doorIndex)
}

/** Legacy helper — unused (gates open from room cleanliness). */
export function getDoorZoneCenter(doorIndex: number): { x: number; z: number } {
  if (doorIndex === 0) {
    /** Hub: just north of the hub↔ROOM_1 door line (z = −ROOM_HALF). */
    return { x: 0, z: -7.15 }
  }
  const rN = roomNorthZ(doorIndex)
  const rS = roomSouthZ(doorIndex)
  /** Move toward south door (rS); higher t = closer to the door line. */
  const t = 0.91
  return { x: 0, z: rN + (rS - rN) * t }
}

/** ROOM_k is explorable only if doors 0..k-1 are passable. */
export function roomIndexFromId(id: RoomId): number | null {
  if (id === 'SAFE_CENTER') return 0
  const m = /^ROOM_(\d+)$/.exec(id)
  return m ? Number(m[1]) : null
}
