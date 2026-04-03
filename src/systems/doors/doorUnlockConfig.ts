/**
 * Double doors: rooms unlock the **next** threshold when cleanliness hits 100%.
 * Doors do not auto-open — the player pushes them. Values below tune swing feel.
 */

/** Fallback procedural door panel height when GLB is missing. */
export const GATE_PANEL_HEIGHT = 2.4

/**
 * Applied to the loaded double-door GLB root only (walkable gap & door AABBs use `DOOR_HALF`).
 * Slightly >1 lets the mesh read larger and overlap wall trim.
 */
export const DOUBLE_DOOR_VISUAL_SCALE_XZ = 1.3
export const DOUBLE_DOOR_VISUAL_SCALE_Y = 1.1

/**
 * Nudges the GLB toward the next room (−Z) so the panel sits deeper in the jamb.
 * Collision / push still use `getDoorBlockerZ` (unchanged).
 */
export const DOUBLE_DOOR_VISUAL_Z_NUDGE = -0.36

/**
 * Stylized door frame point light (one per door, no shadows, short range).
 * Communicates locked / unlocked / passed + push feedback without darkening the scene.
 */
export const DOOR_LIGHT_POS_Y = 2.52
export const DOOR_LIGHT_POS_Z = 0.1
/** Tight falloff — doorway only, not whole rooms. */
export const DOOR_LIGHT_DISTANCE = 9

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

/** After player crosses — one-way; dim cool neutral. */
export const DOOR_LIGHT_PASSED_COLOR = 0xaab8cc
export const DOOR_LIGHT_PASSED_INTENSITY = 1.5

export const DOOR_LIGHT_PUSH_PULSE_SEC = 0.12
export const DOOR_LIGHT_PUSH_PULSE_MUL = 1.32
export const DOOR_LIGHT_PUSH_VEL_THRESHOLD = 0.14

/** Max swing angle (radians) when open amount = 1. */
export const DOOR_MAX_SWING_RAD = 1.12

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

/** Push strength: how fast normalized swing accelerates from player movement into the door. */
export const DOOR_PUSH_STRENGTH = 2.45

/** Angular damping per second (heavy doors). */
export const DOOR_SWING_DAMPING = 5.2

/**
 * Below this normalized swing, extra “static friction” must be overcome before the door budges.
 */
export const DOOR_STATIC_FRICTION_THRESHOLD = 0.045

/** Minimum push impulse (combined axes) to overcome static friction. */
export const DOOR_STATIC_BREAK_SPEED = 0.65

/** Half-width (X) and depth (Z) of the region where door reacts to the player body. */
export const DOOR_PUSH_ZONE_HALF_X = 1.05
export const DOOR_PUSH_ZONE_HALF_Z = 0.55

/** Optional extra resistance near 0 swing (multiplier on effective push). */
export const DOOR_OPENING_RESISTANCE = 0.42

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
