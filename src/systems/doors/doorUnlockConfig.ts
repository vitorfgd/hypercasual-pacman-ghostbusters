/**
 * Double doors: rooms unlock the **next** threshold when cleanliness hits 100%.
 * Contact in the push band triggers one smooth eased open. Values below tune timing & collision.
 */

import { GRID_ROOM_INSET, ROOM_GRID_ROWS } from '../grid/gridConfig.ts'
import { ROOM_HALF } from '../world/mansionGeometry.ts'

/** Fallback procedural door panel height when GLB is missing. */
export const GATE_PANEL_HEIGHT = 2.4

/**
 * Applied to the loaded double-door GLB root only (walkable gap & door AABBs use `DOOR_HALF`).
 * >1 lets the mesh overlap wall trim slightly (wider read).
 */
export const DOUBLE_DOOR_VISUAL_SCALE_XZ = 1.48
export const DOUBLE_DOOR_VISUAL_SCALE_Y = 1.14
/** Procedural fallback leaves scale vs this prior XZ scale. */
export const DOUBLE_DOOR_VISUAL_BASELINE_XZ = 1.3

/**
 * Nudges the GLB toward the next room (−Z) so the panel sits deeper in the jamb.
 * Collision / push still use `getDoorBlockerZ` (unchanged).
 */
export const DOUBLE_DOOR_VISUAL_Z_NUDGE = -0.36

/**
 * Focused door spotlight — narrow cone, aimed at threshold + ground in front (local door space).
 * Communicates locked / unlocked / passed + push feedback; range keeps beam off far walls.
 */
export const DOOR_SPOT_POS_X = 0
export const DOOR_SPOT_POS_Y = 2.92
/** Slightly “in front” of the plane (toward +Z local = hub / approach side). */
export const DOOR_SPOT_POS_Z = 0.72
/** Aim: doorway center horizontally, low for floor catch, forward into threshold. */
export const DOOR_SPOT_TARGET_X = 0
export const DOOR_SPOT_TARGET_Y = 0.2
export const DOOR_SPOT_TARGET_Z = 0.4
/** Full cone apex angle (radians); medium-narrow beam. */
export const DOOR_SPOT_ANGLE = Math.PI / 6.2
export const DOOR_SPOT_PENUMBRA = 0.38
export const DOOR_SPOT_DISTANCE = 12
export const DOOR_SPOT_DECAY = 2
/**
 * Only enable the fixture when the player is within this corridor band (cheap culling).
 */
export const DOOR_SPOT_ACTIVE_Z_HALF = 16
export const DOOR_SPOT_ACTIVE_X_HALF = 7.5
/** Default off — N doors × shadow maps is costly. When true, small maps + soft radius. */
export const DOOR_SPOT_SHADOW_ENABLED = false
export const DOOR_SPOT_SHADOW_MAP_SIZE = 512

/** Subtle warm neutral mixed into unlocked state for readability (0 = off). */
export const DOOR_LIGHT_BASE_WARM_MIX = 0.12
export const DOOR_LIGHT_BASE_WARM_COLOR = 0xffe8d4

/** Locked: key not available (or boss seal). */
export const DOOR_LIGHT_LOCKED_COLOR = 0x8f3d48
export const DOOR_LIGHT_LOCKED_INTENSITY = 2.4
export const DOOR_LIGHT_LOCKED_FLICKER_AMP = 0.08
export const DOOR_LIGHT_LOCKED_FLICKER_HZ = 2.6

/** Unlocked: room cleared — ectoplasm green. */
export const DOOR_LIGHT_UNLOCKED_COLOR = 0x56f0b8
export const DOOR_LIGHT_UNLOCKED_INTENSITY = 5.2

/** Red → green when `unlockDoor` runs (seconds). */
export const DOOR_LIGHT_UNLOCK_TRANSITION_SEC = 0.42

export const DOOR_LIGHT_PUSH_PULSE_SEC = 0.12
export const DOOR_LIGHT_PUSH_PULSE_MUL = 1.32
export const DOOR_LIGHT_PUSH_VEL_THRESHOLD = 0.14

/** Max swing angle (radians) when open amount = 1. */
export const DOOR_MAX_SWING_RAD = 1.12

/** One-shot open: optional hold, then full swing over this duration (ease-out cubic). */
export const DOOR_AUTO_OPEN_ANTICIPATE_SEC = 0
/** One-shot open swing duration — also sets how fast room blackout fades with reveal. */
export const DOOR_AUTO_OPEN_DURATION_SEC = 1.6

/**
 * Normalized swing (0…1) at which passage counts as clear for spawns, clutter, and collision gap.
 * Kept moderate so it matches when sliced leaf colliders no longer block the center.
 */
export const DOOR_PASSAGE_CLEAR_SWING = 0.52

/**
 * Each door leaf is approximated by N thin slabs for collision — one big AABB per leaf falsely
 * blocks the doorway center when the door is only partly open.
 */
export const DOOR_LEAF_COLLIDER_SLICES = 6

/** Ghost fade duration after room clear (no gate cinematic). */
export const ROOM_CLEAR_GHOST_FADE_SEC = 1.35

// --- Room-clear cinematics (intro + post-upgrade door beat) ---

export const ROOM_CLEAR_CINE_ZOOM_OUT_SEC = 0.4
export const ROOM_CLEAR_CINE_SLOW_MO_SEC = 1.0
export const ROOM_CLEAR_CINE_SLOW_SIM_SCALE = 0.42
/** Brief hold on the wide shot before the upgrade picker opens. */
export const ROOM_CLEAR_CINE_POST_SLOW_HOLD_SEC = 0.45

/** Ghost fade window: covers zoom + slow-mo + hold (intro). */
export const ROOM_CLEAR_INTRO_GHOST_FADE_SEC =
  ROOM_CLEAR_CINE_ZOOM_OUT_SEC +
  ROOM_CLEAR_CINE_SLOW_MO_SEC +
  ROOM_CLEAR_CINE_POST_SLOW_HOLD_SEC

/** After upgrade: dolly toward the unlocked door, then hold, then return to player. */
export const ROOM_CLEAR_DOOR_CINE_APPROACH_SEC = 1.05
export const ROOM_CLEAR_DOOR_CINE_HOLD_SEC = 1.05
export const ROOM_CLEAR_DOOR_CINE_RETURN_SEC = 0.55

/** ~One grid step (room interior) — prefetch open when facing door from this far out. */
export const DOOR_APPROACH_CELL_WORLD =
  (2 * ROOM_HALF - 2 * GRID_ROOM_INSET) / ROOM_GRID_ROWS

/** How close to “exactly one cell” counts (world Z). */
export const DOOR_APPROACH_ONE_CELL_BAND = 0.38

/** Must be looking toward the doorway (unit forward · toward-door). */
export const DOOR_PREFETCH_FACE_DOT_MIN = 0.86

/** Stay near center line when prefetching (world X). */
export const DOOR_PREFETCH_MAX_ABS_X = 1.85

/** Half-width (X) and depth (Z) — player enters this band to trigger one-shot open. */
export const DOOR_PUSH_ZONE_HALF_X = 1.05
export const DOOR_PUSH_ZONE_HALF_Z = 0.55

/** Boss / progression seal: same door plane thickness as collider slab. */
export const DOOR_COLLIDER_THICKNESS = 0.2

// --- Forward crossing (trigger volumes, one-way lock) ---

/** Door plane crossing test — avoids jitter at z = zDoor. */
export const DOOR_CROSS_Z_EPS = 0.04

/**
 * Axis-aligned trigger straddling the door plane (Z half-depth each side of `zDoor`).
 * Used to detect “fully exited” the doorway after a forward cross.
 */
export const DOOR_TRIGGER_HALF_X = 2.35
export const DOOR_TRIGGER_HALF_Z = 1.22

/** Player center must be at least this far south of the door plane after leaving trigger. */
export const DOOR_EXIT_SOUTH_MARGIN = 0.26

/** Delay after valid exit before the door slams and becomes one-way locked. */
export const DOOR_PASS_CLOSE_DELAY_SEC = 0.16

/** If the player retreats north past this margin before the delay elapses, cancel the close. */
export const DOOR_RETREAT_CANCEL_MARGIN = 0.42

/** Minimum swing (0…1) to count a forward plane cross as intentional (not clipping). */
export const DOOR_MIN_SWING_TO_REGISTER_CROSS = 0.38

/** Visual slam duration after delay — panels snap shut (collision is already full). */
export const DOOR_SLAM_SHUT_SEC = 0.1
