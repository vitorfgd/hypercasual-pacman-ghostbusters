/** Timed room wisp spawning — tune here */

/** Set to 0 when clutter is the primary room fodder; `RoomWispSpawnSystem` stays wired. */
export const WISP_SPAWN_MAX_ACTIVE = 0

/** Next spawn delay is random in [min, max] seconds (when under cap). */
export const WISP_SPAWN_INTERVAL_MIN_SEC = 0.82
export const WISP_SPAWN_INTERVAL_MAX_SEC = 1.55

/** Inset from room AABB so pickups stay off walls and away from door strips. */
export const WISP_SPAWN_ROOM_INSET = 1.15

/** Circle-vs-wall resolution radius (matches pickup footprint). */
export const WISP_SPAWN_BODY_RADIUS = 0.42

export const WISP_SPAWN_ATTEMPTS = 18

/** Keep wisps out of the central deposit disc (other rooms only, but south is close). */
export const WISP_SPAWN_MIN_DIST_FROM_DEPOSIT = 2.65

/** If placement fails, retry after this delay (seconds). */
export const WISP_SPAWN_RETRY_DELAY_SEC = 0.28

/** @deprecated Relics spawn from haunted clutter only (`SpecialRelicSpawnSystem`). */
export const SPECIAL_RELIC_INTERVAL_SEC = 30
