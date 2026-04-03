import { CLUTTER_PER_ROOM } from '../clutter/clutterSpawnConfig.ts'

/**
 * Each clutter pickup adds this much to that room’s cleanliness (0–100).
 * Matches `CLUTTER_PER_ROOM` so collecting **all** clutter in a room reaches 100%.
 */
export const CLEANLINESS_PERCENT_PER_CLUTTER = 100 / CLUTTER_PER_ROOM
