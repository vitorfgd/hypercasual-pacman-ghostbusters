/** Room clutter — all pieces pre-spawned at session start (`clutterPrefill.ts`). */

/** Pieces per `ROOM_*` (normal rooms only); total ≈ `CLUTTER_PER_ROOM` × room count. */
export const CLUTTER_PER_ROOM = 19

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
