/** Room clutter — all pieces pre-spawned at session start (`clutterPrefill.ts`). */

import { NORMAL_ROOM_COUNT } from '../world/mansionRoomData.ts'

/** Base pieces per room; deeper rooms add a few (see `clutterPiecesForRoom`). */
export const CLUTTER_PER_ROOM_BASE = 19

/** @deprecated Use `clutterPiecesForRoom` — kept for docs / approximate totals. */
export const CLUTTER_PER_ROOM = CLUTTER_PER_ROOM_BASE

/** Slightly more clutter in deeper rooms (ramps ~+6 pieces by last room). */
export function clutterPiecesForRoom(roomIndex: number): number {
  const idx = Math.max(1, Math.min(NORMAL_ROOM_COUNT, roomIndex))
  if (idx === NORMAL_ROOM_COUNT) return 0
  if (NORMAL_ROOM_COUNT <= 1) return CLUTTER_PER_ROOM_BASE
  return (
    CLUTTER_PER_ROOM_BASE +
    Math.floor(((idx - 1) * 6) / (NORMAL_ROOM_COUNT - 1))
  )
}

export const CLUTTER_SPAWN_ROOM_INSET = 1.05

/** Clearance for floor clutter placement — scale with `CLUTTER_PICKUP_TARGET_MAX_DIM`. */
export const CLUTTER_SPAWN_BODY_RADIUS = 0.52

export const CLUTTER_SPAWN_ATTEMPTS = 36

export const CLUTTER_SPAWN_MIN_DIST_FROM_DEPOSIT = 2.65

/** Cluster centers per room (props group around a few spots). */
export const CLUTTER_CLUSTER_COUNT = 3

/** Offset of each cluster center from room center (meters), before jitter. */
export const CLUTTER_CLUSTER_ORBIT_MIN = 1.85
export const CLUTTER_CLUSTER_ORBIT_SPREAD = 2.35

/** Random spread around a cluster center when placing a piece. */
export const CLUTTER_CLUSTER_JITTER = 2.15
