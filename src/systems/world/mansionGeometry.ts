/** Shared layout constants for collision, walls, and floor. */

/**
 * Half-extent on XZ for every room (safe hub + the five north rooms).
 * All are the same square: side length = 2 × ROOM_HALF.
 */
export const ROOM_HALF = 8

/** Walkable depth of each door threshold (between rooms). */
export const CORRIDOR_DEPTH = 2

/** Half-width of each door opening in X (narrow passage, not full room width). */
export const DOOR_HALF = 2

/** Outer clamp & vignette — must cover full north extent + margin. */
export const MANSION_WORLD_HALF = 102

/** Outer perimeter wall thickness (XZ). */
export const MANSION_OUTER_WALL_THICKNESS = 0.28
