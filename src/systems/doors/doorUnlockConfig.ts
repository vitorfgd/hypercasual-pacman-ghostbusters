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
export const GATE_OPEN_DELAY_SEC = 0.2

/** Small horizontal shake window before the sink. */
export const GATE_ANTICIPATION_SEC = 0.14

/**
 * Main vertical drop — slower, readable sink (~1.2–1.8s total sequence with delay + shake).
 * Easing: `easeInOutCubic` in `DoorUnlockSystem`.
 */
export const GATE_SINK_DURATION_SEC = 1.38

/** Full gate open sequence (delay + shake + sink) — matches `DoorUnlockSystem` animation length. */
export const GATE_OPEN_TOTAL_SEC =
  GATE_OPEN_DELAY_SEC + GATE_ANTICIPATION_SEC + GATE_SINK_DURATION_SEC

/** Gate-opening cinematic: pull camera back / up before watching the gate. */
export const GATE_CINE_ZOOM_OUT_SEC = 0.42

/** After the gate finishes lowering, hold the shot briefly. */
export const GATE_CINE_HOLD_AFTER_OPEN_SEC = 0.38

/** Smooth blend back to the normal follow camera. */
export const GATE_CINE_RETURN_TO_PLAYER_SEC = 0.52

/** Total time the cinematic blocks follow-cam = gate + hold + return (zoom overlaps gate start). */
export const GATE_CINE_TOTAL_SEC =
  GATE_OPEN_TOTAL_SEC +
  GATE_CINE_HOLD_AFTER_OPEN_SEC +
  GATE_CINE_RETURN_TO_PLAYER_SEC

export const GATE_SHAKE_AMPLITUDE = 0.056
export const GATE_SHAKE_FREQ = 48

/** Hub → ROOM_1 starts passable so the safe center remains playable. */
export const DOOR_HUB_STARTS_FULLY_OPEN = true
