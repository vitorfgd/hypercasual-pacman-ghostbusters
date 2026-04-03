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

/** Gate-opening cinematic — zoom back from player (wall-clock). */
export const GATE_CINE_ZOOM_OUT_SEC = 0.4

/** Slow-motion window after zoom (world sim scaled; ghosts fade during this + zoom). */
export const GATE_CINE_SLOW_MO_SEC = 1.0

/** Sim `dt` multiplier while `GATE_CINE_SLOW_MO_SEC` is active (~0.3–0.5). */
export const GATE_CINE_SLOW_SIM_SCALE = 0.42

/** Dolly from wide shot toward the gate before `openDoorFully` runs. */
export const GATE_CINE_APPROACH_GATE_SEC = 1.15

/** Ghosts in the cleared room fade over zoom + slow-mo (real seconds). */
export const GATE_CINE_GHOST_FADE_SEC =
  GATE_CINE_ZOOM_OUT_SEC + GATE_CINE_SLOW_MO_SEC

/** After the gate finishes lowering, hold the shot briefly. */
export const GATE_CINE_HOLD_AFTER_OPEN_SEC = 0.4

/** Smooth blend back to the normal follow camera. */
export const GATE_CINE_RETURN_TO_PLAYER_SEC = 0.55

/**
 * Full cinematic: zoom → slow-mo → approach → gate anim (real-time) → hold → return.
 * Door opens only after approach; gate animation uses unchanged `GATE_OPEN_*` timing.
 */
export const GATE_CINE_TOTAL_SEC =
  GATE_CINE_ZOOM_OUT_SEC +
  GATE_CINE_SLOW_MO_SEC +
  GATE_CINE_APPROACH_GATE_SEC +
  GATE_OPEN_TOTAL_SEC +
  GATE_CINE_HOLD_AFTER_OPEN_SEC +
  GATE_CINE_RETURN_TO_PLAYER_SEC

export const GATE_SHAKE_AMPLITUDE = 0.056
export const GATE_SHAKE_FREQ = 48

/** Hub → ROOM_1 starts passable so the safe center remains playable. */
export const DOOR_HUB_STARTS_FULLY_OPEN = true
