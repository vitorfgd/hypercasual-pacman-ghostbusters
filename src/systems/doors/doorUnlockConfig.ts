/**
 * Gates open when a room reaches full cleanliness (`RoomCleanlinessSystem` + `openDoorFully`).
 * Visual: vertical sink into the ground (no swing).
 */

/** Fallback procedural gate height when GLB is missing. */
export const GATE_PANEL_HEIGHT = 2.4

/**
 * How far the gate travels (Y) when fully lowered — must clear the passage visually.
 */
export const GATE_SINK_DEPTH = 2.9

/** Pause before movement starts (anticipation). */
export const GATE_OPEN_DELAY_SEC = 0.18

/** Small horizontal shake window before the sink. */
export const GATE_ANTICIPATION_SEC = 0.12

/** Main vertical drop duration. */
export const GATE_SINK_DURATION_SEC = 0.72

/** Full gate open sequence (delay + shake + sink) — matches `DoorUnlockSystem` animation length. */
export const GATE_OPEN_TOTAL_SEC =
  GATE_OPEN_DELAY_SEC + GATE_ANTICIPATION_SEC + GATE_SINK_DURATION_SEC

export const GATE_SHAKE_AMPLITUDE = 0.056
export const GATE_SHAKE_FREQ = 48

/** Hub → ROOM_1 starts passable so the safe center remains playable. */
export const DOOR_HUB_STARTS_FULLY_OPEN = true
