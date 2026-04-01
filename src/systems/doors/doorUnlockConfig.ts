/** Gold required to clear one door and open the next area. */
export const DOOR_UNLOCK_COST = 1000

/** Gold per button press / tick toward the current door. */
export const DOOR_PAY_CHUNK = 45

/** 3D arc flight duration — much shorter than wisp deposit (~0.1s). */
export const DOOR_FLIGHT_DURATION_SEC = 0.042

/**
 * Axis-aligned rectangular pay zone (half-extents from zone center on XZ).
 * Wide along X (in front of the door), shallow along Z (snug to the threshold).
 */
export const DOOR_ZONE_HALF_WIDTH = 2.15
export const DOOR_ZONE_HALF_DEPTH = 0.95

/** Vertical door panel size. */
export const DOOR_PANEL_WIDTH = 4.1
export const DOOR_PANEL_HEIGHT = 2.35
