/** Bottom of the occlusion volume (slightly below floor mesh to avoid hairline gaps). */
export const ROOM_LOCK_COVER_FLOOR_Y = -0.04

/**
 * Full vertical extent of the black shell — must exceed plausible camera height and look-down angles
 * so the room cannot be seen over walls or through clipping.
 */
export const ROOM_LOCK_COVER_HEIGHT = 20

/**
 * Expand XZ past `ROOMS[*].bounds` so edges overlap corridor / wall geometry and never leave cracks.
 */
export const ROOM_LOCK_COVER_HORIZONTAL_PAD = 0.12

/**
 * Legacy name — blackout opacity is driven by door swing (`RoomLockCoverSystem`), not sink timing.
 */
export const ROOM_LOCK_COVER_FADE_DELAY_SEC = 0.08
